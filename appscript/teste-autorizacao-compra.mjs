// Testa autorizacao-compra.gs (identidade + compra num só gate).
//
// O que importa aqui: um token de sessão VÁLIDO (identidade provada) não
// basta mais para usar ações pagas — o e-mail também precisa estar
// aprovado em Alunos_Hotmart. É exatamente o buraco que este arquivo fecha:
// antes dele, qualquer e-mail que pedisse e confirmasse um código de OTP
// tinha acesso total, comprador ou não.

import fs from 'fs'
import vm from 'vm'

const ARQ = new URL('./autorizacao-compra.gs', import.meta.url).pathname

// ── Ambiente simulado ───────────────────────────────────────────────────────
// emailAutenticado e verificarAcessoAluno são dublês simples: o objetivo não
// é retestar OTP (já coberto por teste-autenticacao.mjs) nem a leitura da
// planilha (não há Sheets aqui) — é só provar que
// emailAutenticadoEAutorizado exige as DUAS coisas antes de devolver um
// e-mail, e propaga a mensagem certa quando falha.
function montar(opcoes = {}) {
  const chamadasAcesso = []  // { email, curso }

  const sandbox = {
    normalizarTexto: (v) => String(v === undefined || v === null ? '' : v).trim(),
    emailAutenticado: (payload) => {
      if (!payload || !payload.token) throw new Error('Sessão ausente. Faça login novamente.')
      if (payload.token === 'token-invalido') throw new Error('Sessão inválida. Faça login novamente.')
      // token de teste no formato "email:validade" — não precisa ser HMAC de
      // verdade aqui, isso já é responsabilidade de autenticacao.gs.
      return String(payload.token).split(':')[0]
    },
    verificarAcessoAluno: (email, curso) => {
      chamadasAcesso.push({ email, curso })
      const base = (opcoes.alunos || {})[email]
      if (!base) return { liberado: false, mensagem: 'E-mail não encontrado na base de compradores.' }
      if (base.status !== 'APPROVED') return { liberado: false, mensagem: 'Acesso bloqueado. Status da compra: ' + base.status }
      return { liberado: true, nome: base.nome || '', mensagem: 'Acesso autorizado.' }
    },
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(ARQ, 'utf8'), sandbox)
  return { sandbox, chamadasAcesso }
}

let falhas = 0
function checar(nome, ok, detalhe) {
  if (!ok) falhas++
  console.log(`${ok ? 'PASS' : 'FALHA'} — ${nome}${detalhe ? '\n   ' + detalhe : ''}`)
}

// ── 1) comprador aprovado: token válido + compra aprovada → libera ─────────
{
  const t = montar({ alunos: { 'aluno@exemplo.com': { status: 'APPROVED', nome: 'Aluno' } } })
  const email = t.sandbox.emailAutenticadoEAutorizado({ token: 'aluno@exemplo.com:x', curso: 'Practitioner' })
  checar('devolve o e-mail quando identidade e compra estão OK', email === 'aluno@exemplo.com')
  checar('consulta verificarAcessoAluno com o curso do payload',
    t.chamadasAcesso.length === 1 && t.chamadasAcesso[0].curso === 'Practitioner')
}

// ── 2) identidade válida, mas e-mail nunca comprou nada ─────────────────────
// Este é o caso central: hoje qualquer e-mail passa pelo OTP normalmente
// (solicitar código + confirmar código funcionam para QUALQUER endereço, de
// propósito). O gate tem que estar aqui, depois da identidade — nunca antes.
{
  const t = montar({ alunos: {} })
  let msg = ''
  try { t.sandbox.emailAutenticadoEAutorizado({ token: 'estranho@exemplo.com:x', curso: 'Practitioner' }) }
  catch (e) { msg = e.message }
  checar('e-mail identificado mas não comprador é recusado', /não encontrado na base de compradores/i.test(msg), msg)
}

// ── 3) identidade válida, compra reembolsada/cancelada ──────────────────────
{
  const t = montar({ alunos: { 'exaluno@exemplo.com': { status: 'REFUNDED' } } })
  let msg = ''
  try { t.sandbox.emailAutenticadoEAutorizado({ token: 'exaluno@exemplo.com:x', curso: 'Practitioner' }) }
  catch (e) { msg = e.message }
  checar('compra reembolsada é recusada mesmo com token válido', /bloqueado.*REFUNDED/i.test(msg), msg)
}

// ── 4) sem token — falha na camada de identidade, nunca chega a checar compra ─
{
  const t = montar({ alunos: { 'aluno@exemplo.com': { status: 'APPROVED' } } })
  let msg = ''
  try { t.sandbox.emailAutenticadoEAutorizado({ curso: 'Practitioner' }) }
  catch (e) { msg = e.message }
  checar('sem token, erro é de sessão — não revela nada sobre a base de compradores',
    /sessão ausente/i.test(msg), msg)
  checar('verificarAcessoAluno nem chega a ser chamado', t.chamadasAcesso.length === 0)
}

// ── 5) funciona também no formato usado por avaliar/tutor/plantao_avaliar ───
// Esses três chamam emailAutenticado(payload.dados), não emailAutenticado
// (payload) — curso e token vêm de dentro de `dados`. A função precisa
// funcionar igual nos dois formatos, porque em ambos curso/token estão no
// topo do objeto recebido.
{
  const t = montar({ alunos: { 'aluno@exemplo.com': { status: 'APPROVED' } } })
  const dados = { token: 'aluno@exemplo.com:x', curso: 'Practitioner', resposta: 'texto qualquer' }
  const email = t.sandbox.emailAutenticadoEAutorizado(dados)
  checar('funciona chamado com o objeto "dados" de avaliar/tutor/plantao_avaliar', email === 'aluno@exemplo.com')
}

console.log(falhas === 0 ? '\nTodos os testes passaram.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)

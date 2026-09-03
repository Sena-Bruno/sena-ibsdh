// Testa as funções migradas para o núcleo da Groq (migracao-groq.gs).
//
// O foco não é o texto que a IA devolve — isso não dá para testar. É o
// CONTRATO: mesmo formato de retorno da versão antiga, parâmetros certos
// chegando ao núcleo, e falha da IA não derrubando o que não depende dela.

import fs from 'fs'
import vm from 'vm'

const ARQ = new URL('./migracao-groq.gs', import.meta.url).pathname

function carregar(opcoes = {}) {
  const chamadas = []
  const logs = []

  const sandbox = {
    buscarProgressoAluno: () => opcoes.progresso || {},
    buscarBaseAula: () => {
      if (opcoes.baseAulaFalha) throw new Error('Aula não encontrada')
      return { titulo: opcoes.tituloAula || 'O CÓDIGO DA EXCELÊNCIA' }
    },
    chamarGroqTexto: (prompt, op) => {
      chamadas.push({ prompt, op })
      if (opcoes.iaFalha) throw new Error(opcoes.iaFalha)
      return opcoes.respostaIA === undefined
        ? '  Você já dominou o rapport; agora observe o que o silêncio revela.  '
        : opcoes.respostaIA
    },
    registrarLog: (tipo, email, curso, aula, mensagem) => logs.push({ tipo, mensagem }),
    Object, String, Number, JSON, Date, Math,
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(ARQ, 'utf8'), sandbox)
  return { sandbox, chamadas, logs }
}

let falhas = 0
function checar(nome, ok, detalhe) {
  if (!ok) falhas++
  console.log(`${ok ? 'PASS' : 'FALHA'} — ${nome}${detalhe ? '\n   ' + detalhe : ''}`)
}

console.log('=== gerarBoasVindas ===')

// ── contrato de retorno ─────────────────────────────────────────────────────
{
  const t = carregar({ progresso: { Aula_1: { aprovado: 'SIM' }, Aula_2: { aprovado: 'SIM' }, Aula_3: { aprovado: 'NAO' } } })
  const r = t.sandbox.gerarBoasVindas('ana@t.com', 'Practitioner', 'Aula_4', 'Ana')

  checar('devolve as três chaves de sempre',
    JSON.stringify(Object.keys(r).sort()) === '["aulas_aprovadas","mensagem","primeiro_acesso"]',
    Object.keys(r).join(','))
  checar('conta só as aulas aprovadas', r.aulas_aprovadas === 2, 'veio ' + r.aulas_aprovadas)
  checar('primeiro_acesso false quando já há aprovadas', r.primeiro_acesso === false)
  checar('mensagem vem sem espaços nas pontas',
    r.mensagem === 'Você já dominou o rapport; agora observe o que o silêncio revela.',
    JSON.stringify(r.mensagem))
}

// ── primeiro acesso ─────────────────────────────────────────────────────────
{
  const t = carregar({ progresso: {} })
  const r = t.sandbox.gerarBoasVindas('ana@t.com', 'Practitioner', 'Aula_1', 'Ana')
  checar('primeiro_acesso true sem nenhuma aprovada', r.primeiro_acesso === true)
  checar('o contexto do prompt reflete o primeiro acesso',
    /primeiro acesso/i.test(t.chamadas[0].prompt))
}

// ── parâmetros que chegam ao núcleo ─────────────────────────────────────────
//
// É o coração desta migração: max_tokens 120 era o bug que devolvia mensagem
// vazia. Se alguém baixar isso de novo, este teste cai.
{
  const t = carregar({ progresso: {} })
  t.sandbox.gerarBoasVindas('ana@t.com', 'Practitioner', 'Aula_1', 'Ana')
  const op = t.chamadas[0].op

  checar('pede 600 tokens, não 120', op.maxTokens === 600, 'maxTokens: ' + op.maxTokens)
  checar('mantém a temperatura alta da versão antiga (0.8)', op.temperature === 0.8)
  checar('usa system prompt próprio, não o de tutor',
    /SENA/.test(op.sistema) && /sem JSON/i.test(op.sistema), op.sistema)
}

// ── nome do aluno ───────────────────────────────────────────────────────────
{
  const t = carregar({ progresso: {} })
  t.sandbox.gerarBoasVindas('bruno.sena@hotmail.com', 'Practitioner', 'Aula_1', '')
  checar('sem nome, usa a parte do e-mail antes do @',
    /bruno\.sena/.test(t.chamadas[0].prompt) && !/hotmail/.test(t.chamadas[0].prompt.split('\n')[0]),
    t.chamadas[0].prompt.slice(0, 120))
}

// ── falha da IA não derruba o aluno ─────────────────────────────────────────
//
// A mensagem é decorativa. O que NÃO pode acontecer é o aluno ficar sem
// entrar na aula porque a Groq caiu.
{
  const t = carregar({ progresso: { Aula_1: { aprovado: 'SIM' } }, iaFalha: 'Nenhum modelo da Groq respondeu.' })
  let r, estourou = false
  try { r = t.sandbox.gerarBoasVindas('ana@t.com', 'Practitioner', 'Aula_2', 'Ana') }
  catch (e) { estourou = true }

  checar('não propaga a exceção da IA', estourou === false)
  checar('devolve mensagem vazia (a tela usa o texto padrão)', r && r.mensagem === '')
  checar('mas o resto do retorno continua correto',
    r && r.aulas_aprovadas === 1 && r.primeiro_acesso === false)
  // O ponto da migração: antes essa falha não aparecia em lugar nenhum.
  checar('registra a falha, que antes era silenciosa',
    t.logs.some(l => l.tipo === 'BOAS_VINDAS_ERROR'), JSON.stringify(t.logs))
}

// ── bordas ──────────────────────────────────────────────────────────────────
{
  const semTitulo = carregar({ progresso: {}, baseAulaFalha: true })
  const r1 = semTitulo.sandbox.gerarBoasVindas('ana@t.com', 'Practitioner', 'Aula_1', 'Ana')
  checar('aula sem título não impede a mensagem', r1.mensagem.length > 0)

  const vazia = carregar({ progresso: {}, respostaIA: '   ' })
  const r2 = vazia.sandbox.gerarBoasVindas('ana@t.com', 'Practitioner', 'Aula_1', 'Ana')
  checar('resposta só com espaços vira string vazia, não quebra', r2.mensagem === '')
}

console.log(falhas === 0 ? '\nTodos os testes passaram.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)

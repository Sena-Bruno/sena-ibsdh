// Testa chamarGroqAPI (groq-resiliente.gs) simulando UrlFetchApp.
//
// O que importa aqui não é "chamou a API", é a classificação do erro: cada
// tipo de falha exige uma ação diferente (repetir, pular o modelo ou abortar),
// e é aí que uma implementação errada custa caro — insistir num modelo morto
// atrasa o aluno, e mascarar chave inválida manda você caçar o problema no
// lugar errado.

import fs from 'fs'
import vm from 'vm'

const ARQ = new URL('./groq-resiliente.gs', import.meta.url).pathname

// ── Ambiente simulado ───────────────────────────────────────────────────────
function montar(respostas, opcoes = {}) {
  const chamadas = []       // { modelo }
  const esperas = []        // ms de cada Utilities.sleep
  const logs = []           // { tipo, mensagem, detalhes }
  const emails = []         // { para, assunto }
  const props = Object.assign({}, opcoes.props || {})

  const sandbox = {
    CONFIG: { MODEL_NAME: 'openai/gpt-oss-120b' },
    getGroqApiKey: () => 'chave-falsa',
    registrarLog: (tipo, e, c, a, mensagem, detalhes) => logs.push({ tipo, mensagem, detalhes }),
    enviarEmailZoho: (para, assunto) => emails.push({ para, assunto }),
    UrlFetchApp: {
      fetch: (url, options) => {
        const modelo = JSON.parse(options.payload).model
        chamadas.push({ modelo })
        const r = respostas(modelo, chamadas.filter(c => c.modelo === modelo).length)
        if (r.lancar) throw new Error(r.lancar)
        return { getResponseCode: () => r.code, getContentText: () => r.body }
      }
    },
    Utilities: {
      sleep: (ms) => esperas.push(ms),
      formatDate: () => opcoes.hoje || '2026-09-03'
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in props ? props[k] : null),
        setProperty: (k, v) => { props[k] = v }
      })
    },
    Logger: { log: () => {} },
    Math, Object, String, Number, JSON, Date, RegExp,
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(ARQ, 'utf8'), sandbox)
  return { sandbox, chamadas, esperas, logs, emails, props }
}

const okBody = JSON.stringify({ choices: [{ message: { content: '{"nota": 8}' } }] })
const sucesso = { code: 200, body: okBody }

let falhas = 0
function checar(nome, ok, detalhe) {
  if (!ok) falhas++
  console.log(`${ok ? 'PASS' : 'FALHA'} — ${nome}${detalhe ? '\n   ' + detalhe : ''}`)
}

// ── 1) caminho feliz ────────────────────────────────────────────────────────
{
  const t = montar(() => sucesso)
  const r = t.sandbox.chamarGroqAPI('oi')
  checar('primeiro modelo responde e o conteúdo volta igual', r === '{"nota": 8}')
  checar('não tenta outros modelos', t.chamadas.length === 1)
  checar('não espera nem loga quando dá certo de primeira',
    t.esperas.length === 0 && t.logs.length === 0)
  checar('não manda e-mail quando não houve fallback', t.emails.length === 0)
}

// ── 2) modelo descontinuado (o caso que aconteceu de verdade) ───────────────
{
  const t = montar((modelo) => modelo === 'openai/gpt-oss-120b'
    ? { code: 404, body: '{"error":{"code":"model_not_found"}}' }
    : sucesso)
  const r = t.sandbox.chamarGroqAPI('oi')
  checar('404 no principal → o segundo modelo atende', r === '{"nota": 8}')
  checar('não insiste num modelo morto (1 chamada nele, não 2)',
    t.chamadas.filter(c => c.modelo === 'openai/gpt-oss-120b').length === 1,
    'chamadas: ' + JSON.stringify(t.chamadas))
  checar('não perde tempo esperando antes de pular', t.esperas.length === 0)
  checar('registra GROQ_FALLBACK no log',
    t.logs.some(l => l.tipo === 'GROQ_FALLBACK'), JSON.stringify(t.logs))
}

// ── 3) 429: repete no mesmo modelo antes de desistir ────────────────────────
{
  const t = montar((modelo, tentativa) => {
    if (modelo === 'openai/gpt-oss-120b') return { code: 429, body: 'rate limit' }
    if (modelo === 'openai/gpt-oss-20b' && tentativa === 1) return { code: 429, body: 'rate limit' }
    return sucesso
  })
  const r = t.sandbox.chamarGroqAPI('oi')
  checar('429 transitório: repete e consegue na segunda tentativa', r === '{"nota": 8}')
  checar('tentou 2x no primeiro modelo antes de pular',
    t.chamadas.filter(c => c.modelo === 'openai/gpt-oss-120b').length === 2)
  checar('esperou entre as tentativas', t.esperas.length > 0,
    'esperas: ' + JSON.stringify(t.esperas))
}

// ── 4) 200 com conteúdo vazio conta como falha ──────────────────────────────
{
  const vazio = { code: 200, body: JSON.stringify({ choices: [{ message: { content: '   ' } }] }) }
  const t = montar((modelo) => modelo === 'openai/gpt-oss-120b' ? vazio : sucesso)
  const r = t.sandbox.chamarGroqAPI('oi')
  checar('200 com content vazio não é tratado como sucesso', r === '{"nota": 8}')
  checar('registra o motivo "resposta vazia"',
    t.logs.some(l => String(l.detalhes).includes('vazia')), JSON.stringify(t.logs))
}

// ── 5) chave inválida aborta na hora ────────────────────────────────────────
{
  const t = montar(() => ({ code: 401, body: 'invalid api key' }))
  let msg = ''
  try { t.sandbox.chamarGroqAPI('oi') } catch (e) { msg = e.message }
  checar('401 lança erro apontando a chave', /chave/i.test(msg) && /GROQ_API_KEY/.test(msg), msg)
  checar('não sai tentando os outros modelos com a mesma chave ruim',
    t.chamadas.length === 1, 'chamadas: ' + t.chamadas.length)
}

// ── 6) todos fora do ar ─────────────────────────────────────────────────────
{
  const t = montar(() => ({ code: 503, body: 'unavailable' }))
  let msg = ''
  try { t.sandbox.chamarGroqAPI('oi') } catch (e) { msg = e.message }
  checar('erro final nomeia os modelos tentados',
    msg.includes('openai/gpt-oss-120b') && msg.includes('qwen/qwen3.8-27b'), msg)
  checar('tentou 2x cada um dos 3 modelos', t.chamadas.length === 6,
    'chamadas: ' + t.chamadas.length)
}

// ── 7) falha de rede é tratada como transitória ─────────────────────────────
{
  const t = montar((modelo, tentativa) =>
    (modelo === 'openai/gpt-oss-120b' && tentativa === 1)
      ? { lancar: 'DNS error' } : sucesso)
  const r = t.sandbox.chamarGroqAPI('oi')
  checar('exceção do UrlFetchApp não derruba: repete e funciona', r === '{"nota": 8}')
  checar('nem chegou a trocar de modelo', t.chamadas.every(c => c.modelo === 'openai/gpt-oss-120b'))
}

// ── 8) e-mail de aviso ──────────────────────────────────────────────────────
{
  const cai = (modelo) => modelo === 'openai/gpt-oss-120b' ? { code: 404, body: 'x' } : sucesso

  const semAdmin = montar(cai)
  semAdmin.sandbox.chamarGroqAPI('oi')
  checar('sem EMAIL_ADMIN não tenta enviar e-mail', semAdmin.emails.length === 0)
  checar('mas ainda registra no log',
    semAdmin.logs.some(l => l.tipo === 'GROQ_FALLBACK'))

  const comAdmin = montar(cai, { props: { EMAIL_ADMIN: 'bruno@ibsdh.com' } })
  comAdmin.sandbox.chamarGroqAPI('oi')
  checar('com EMAIL_ADMIN envia o aviso', comAdmin.emails.length === 1,
    JSON.stringify(comAdmin.emails))
  checar('assunto nomeia o modelo que caiu',
    comAdmin.emails[0].assunto.includes('openai/gpt-oss-120b'))

  // segunda falha no mesmo dia, mesmo estado de propriedades
  comAdmin.sandbox.chamarGroqAPI('oi')
  checar('não repete o e-mail no mesmo dia', comAdmin.emails.length === 1,
    'e-mails: ' + comAdmin.emails.length)
  checar('mas continua registrando cada ocorrência no log',
    comAdmin.logs.filter(l => l.tipo === 'GROQ_FALLBACK').length === 2)

  // no dia seguinte volta a avisar
  const outroDia = montar(cai, {
    props: { EMAIL_ADMIN: 'bruno@ibsdh.com', 'GROQ_AVISO_openai/gpt-oss-120b': '2026-09-02' },
    hoje: '2026-09-03'
  })
  outroDia.sandbox.chamarGroqAPI('oi')
  checar('volta a avisar no dia seguinte', outroDia.emails.length === 1)
}

// ── 9) o log nunca pode derrubar a avaliação do aluno ───────────────────────
{
  const t = montar((modelo) => modelo === 'openai/gpt-oss-120b' ? { code: 404, body: 'x' } : sucesso)
  t.sandbox.registrarLog = () => { throw new Error('planilha indisponível') }
  const r = t.sandbox.chamarGroqAPI('oi')
  checar('falha ao gravar log não impede a resposta', r === '{"nota": 8}')
}

console.log(falhas === 0 ? '\nTodos os testes passaram.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)

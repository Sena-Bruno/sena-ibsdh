// Testa autenticacao.gs (OTP + token de sessão assinado).
//
// O que importa aqui: (1) só quem recebe o código no e-mail consegue um
// token; (2) o token não pode ser forjado nem adulterado; (3) força bruta no
// código de 6 dígitos e spam de pedidos de código são bloqueados — sem isso
// o próprio mecanismo de login vira a vulnerabilidade.

import fs from 'fs'
import vm from 'vm'
import crypto from 'crypto'

const ARQ = new URL('./autenticacao.gs', import.meta.url).pathname

function paraBytesComSinal(buffer) {
  return Array.from(buffer, b => (b > 127 ? b - 256 : b))
}
function paraBufferSemSinal(bytes) {
  return Buffer.from(bytes.map(b => (b < 0 ? b + 256 : b)))
}

// ── Ambiente simulado ───────────────────────────────────────────────────────
function montar(opcoes = {}) {
  const emails = []   // { para, assunto, corpo }
  const logs = []     // { tipo, email }
  const cacheStore = new Map()
  const props = Object.assign({ SESSION_SECRET: 'segredo-de-teste-bem-longo' }, opcoes.props || {})

  const cache = {
    get: (k) => (cacheStore.has(k) ? cacheStore.get(k) : null),
    put: (k, v) => cacheStore.set(k, v),
    remove: (k) => cacheStore.delete(k)
  }

  const sandbox = {
    normalizarTexto: (v) => String(v === undefined || v === null ? '' : v).trim(),
    registrarLog: (tipo, email) => logs.push({ tipo, email }),
    enviarEmailZoho: (para, assunto, corpo) => emails.push({ para, assunto, corpo }),
    CacheService: { getScriptCache: () => cache },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in props ? props[k] : null)
      })
    },
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
      newBlob: (bytes) => ({ getDataAsString: () => paraBufferSemSinal(bytes).toString('utf8') })
    },
    Date, Math, String, Number, JSON, RegExp, Object,
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(ARQ, 'utf8'), sandbox)
  return { sandbox, emails, logs, cache, props }
}

let falhas = 0
function checar(nome, ok, detalhe) {
  if (!ok) falhas++
  console.log(`${ok ? 'PASS' : 'FALHA'} — ${nome}${detalhe ? '\n   ' + detalhe : ''}`)
}

function codigoEnviadoPara(t, email) {
  const chave = 'otp_' + email
  // O código real só existe no corpo do e-mail — o cache guarda o hash.
  const corpoEmail = t.emails.find(e => e.para === email).corpo
  return corpoEmail.match(/(\d{6})/)[1]
}

// ── 1) solicitar código: caminho feliz ──────────────────────────────────────
{
  const t = montar()
  const r = t.sandbox.solicitarAcesso('Aluno@Exemplo.com')
  checar('devolve sucesso', r.sucesso === true)
  checar('envia e-mail para o endereço normalizado (minúsculo)',
    t.emails.length === 1 && t.emails[0].para === 'aluno@exemplo.com')
  checar('o código no e-mail tem 6 dígitos', /^\d{6}$/.test(codigoEnviadoPara(t, 'aluno@exemplo.com')))
  checar('registra o envio no log', t.logs.some(l => l.tipo === 'AUTH_OTP_ENVIADO'))
}

// ── 2) solicitar código: e-mail inválido nunca gera nem envia nada ──────────
{
  const t = montar()
  let msg = ''
  try { t.sandbox.solicitarAcesso('nao-e-email') } catch (e) { msg = e.message }
  checar('rejeita e-mail sem formato válido', /inválido/i.test(msg))
  checar('não manda e-mail nenhum', t.emails.length === 0)
}

// ── 3) solicitar código: limite de pedidos por e-mail ───────────────────────
{
  const t = montar()
  t.sandbox.solicitarAcesso('aluno@exemplo.com')
  t.sandbox.solicitarAcesso('aluno@exemplo.com')
  t.sandbox.solicitarAcesso('aluno@exemplo.com')
  let msg = ''
  try { t.sandbox.solicitarAcesso('aluno@exemplo.com') } catch (e) { msg = e.message }
  checar('a 4ª solicitação na janela é bloqueada', /muitas solicitações/i.test(msg))
  checar('só 3 e-mails foram realmente enviados', t.emails.length === 3)
}

// ── 4) confirmar código: caminho feliz ──────────────────────────────────────
{
  const t = montar()
  t.sandbox.solicitarAcesso('aluno@exemplo.com')
  const codigo = codigoEnviadoPara(t, 'aluno@exemplo.com')
  const r = t.sandbox.confirmarAcesso('aluno@exemplo.com', codigo)
  checar('devolve um token no formato corpo.assinatura', typeof r.token === 'string' && r.token.split('.').length === 2)
  checar('devolve o e-mail normalizado', r.email === 'aluno@exemplo.com')
  checar('o código não pode ser reutilizado', (() => {
    try { t.sandbox.confirmarAcesso('aluno@exemplo.com', codigo); return false }
    catch (e) { return /expirado ou não solicitado/i.test(e.message) }
  })())
}

// ── 5) confirmar código: código errado não gera token, e some após N tentativas ─
{
  const t = montar()
  t.sandbox.solicitarAcesso('aluno@exemplo.com')
  let ultimaMsg = ''
  for (let i = 0; i < 5; i++) {
    try { t.sandbox.confirmarAcesso('aluno@exemplo.com', '000000') } catch (e) { ultimaMsg = e.message }
  }
  checar('5 tentativas erradas consomem o limite', /incorreto|muitas tentativas/i.test(ultimaMsg))
  let msgFinal = ''
  try { t.sandbox.confirmarAcesso('aluno@exemplo.com', '000000') } catch (e) { msgFinal = e.message }
  checar('a 6ª tentativa já nem tenta comparar — código foi invalidado',
    /muitas tentativas/i.test(msgFinal), msgFinal)

  const codigoCerto = codigoEnviadoPara(t, 'aluno@exemplo.com')
  let conseguiuComOCertoDepoisDeInvalidado = true
  try { t.sandbox.confirmarAcesso('aluno@exemplo.com', codigoCerto) } catch (e) { conseguiuComOCertoDepoisDeInvalidado = false }
  checar('nem o código certo funciona depois de invalidado por força bruta',
    !conseguiuComOCertoDepoisDeInvalidado)
}

// ── 6) emailAutenticado: token válido devolve o e-mail certo ────────────────
{
  const t = montar()
  t.sandbox.solicitarAcesso('aluno@exemplo.com')
  const codigo = codigoEnviadoPara(t, 'aluno@exemplo.com')
  const { token } = t.sandbox.confirmarAcesso('aluno@exemplo.com', codigo)
  const email = t.sandbox.emailAutenticado({ token })
  checar('devolve o e-mail correspondente ao token', email === 'aluno@exemplo.com')
}

// ── 7) emailAutenticado: sem token, token adulterado ou de outro segredo ────
{
  const t = montar()
  let msg = ''
  try { t.sandbox.emailAutenticado({}) } catch (e) { msg = e.message }
  checar('sem token: erro claro de sessão ausente', /sessão ausente/i.test(msg))

  t.sandbox.solicitarAcesso('vitima@exemplo.com')
  const codigo = codigoEnviadoPara(t, 'vitima@exemplo.com')
  const { token } = t.sandbox.confirmarAcesso('vitima@exemplo.com', codigo)

  // Ataque: pegar o token de outro e-mail e trocar só o corpo (mantendo a
  // assinatura antiga), tentando se passar por "atacante@exemplo.com".
  const [corpoOriginal, assinatura] = token.split('.')
  const corpoForjado = t.sandbox.Utilities
    ? null // (não usado; mantido por clareza do teste)
    : null
  const corpoFalso = Buffer.from('atacante@exemplo.com|' + (Date.now() + 999999))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  let msgForjado = ''
  try { t.sandbox.emailAutenticado({ token: corpoFalso + '.' + assinatura }) } catch (e) { msgForjado = e.message }
  checar('token com corpo trocado (assinatura não bate) é rejeitado',
    /sessão inválida/i.test(msgForjado), msgForjado)

  let msgOutroSegredo = ''
  const t2 = montar({ props: { SESSION_SECRET: 'outro-segredo-completamente-diferente' } })
  try { t2.sandbox.emailAutenticado({ token }) } catch (e) { msgOutroSegredo = e.message }
  checar('token assinado com outro SESSION_SECRET é rejeitado',
    /sessão inválida/i.test(msgOutroSegredo), msgOutroSegredo)
}

// ── 8) emailAutenticado: token expirado ─────────────────────────────────────
{
  const t = montar()
  // Emite um token já expirado, chamando a função interna diretamente com
  // clock manipulado não é viável aqui, então construímos um token expirado
  // à mão com a MESMA assinatura HMAC que o código produziria.
  const emailExpirado = 'aluno@exemplo.com'
  const expPassado = Date.now() - 1000
  const corpo = Buffer.from(emailExpirado + '|' + expPassado)
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const assinatura = crypto.createHmac('sha256', t.props.SESSION_SECRET).update(corpo, 'utf8').digest()
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  let msg = ''
  try { t.sandbox.emailAutenticado({ token: corpo + '.' + assinatura }) } catch (e) { msg = e.message }
  checar('token com validade no passado é rejeitado', /sessão expirada/i.test(msg), msg)
}

// ── 9) sem SESSION_SECRET configurado, falha alto em vez de aceitar tudo ────
{
  const t = montar({ props: { SESSION_SECRET: null } })
  let msg = ''
  try { t.sandbox.solicitarAcesso('aluno@exemplo.com'); t.sandbox.emitirTokenSessao('aluno@exemplo.com') }
  catch (e) { msg = e.message }
  checar('sem SESSION_SECRET, emitir token lança erro claro', /SESSION_SECRET/.test(msg), msg)
}

console.log(falhas === 0 ? '\nTodos os testes passaram.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)

// Autenticação por código (OTP) — ver appscript/autenticacao.gs.
//
// Antes, a "sessão" do aluno era só um e-mail guardado em localStorage, sem
// nenhuma prova de que quem o digitou é o dono dele — qualquer pessoa que
// soubesse ou adivinhasse o e-mail de um aluno conseguia ver os dados dele
// (achado F1 da auditoria de segurança). Agora o cliente troca um código
// recebido por e-mail por um token assinado pelo servidor, e é esse token —
// nunca mais um e-mail cru — que acompanha toda chamada ao backend.

const APPS_SCRIPT_URL = '/api'
const CHAVE_TOKEN = 'sena_token'
const CHAVE_EMAIL = 'sena_email' // só para exibição na tela; o backend nunca confia nele

function lerStorage(chave) {
  try { return localStorage.getItem(chave) } catch (e) { return null }
}
function escreverStorage(chave, valor) {
  try {
    if (valor === null || valor === undefined) localStorage.removeItem(chave)
    else localStorage.setItem(chave, valor)
  } catch (e) { /* modo privado / storage bloqueado: segue sem persistir */ }
}

export function getToken() {
  return lerStorage(CHAVE_TOKEN)
}

// Só para mostrar "Olá, fulano@..." na tela. NUNCA usar este valor para
// decidir de quem são os dados pedidos — isso é sempre o token.
export function getEmailExibicao() {
  return lerStorage(CHAVE_EMAIL)
}

export function estaAutenticado() {
  return !!getToken()
}

export function limparSessao() {
  escreverStorage(CHAVE_TOKEN, null)
  escreverStorage(CHAVE_EMAIL, null)
}

async function post(payload) {
  const res = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) })
  if (!res.ok) throw new Error('Servidor indisponível. Tente novamente.')
  return await res.json()
}

export async function solicitarCodigo(email) {
  const data = await post({ action: 'solicitar_codigo', email })
  if (!data || data.erro) throw new Error((data && data.mensagem) || 'Não foi possível enviar o código.')
  return data
}

export async function confirmarCodigo(email, codigo) {
  const data = await post({ action: 'confirmar_codigo', email, codigo })
  if (!data || data.erro || !data.token) throw new Error((data && data.mensagem) || 'Código incorreto.')
  escreverStorage(CHAVE_TOKEN, data.token)
  escreverStorage(CHAVE_EMAIL, data.email || email)
  return data
}

// Chame quando uma chamada autenticada vier com erro de sessão (token
// ausente/inválido/expirado — mensagens de emailAutenticado() no backend),
// para forçar o aluno a logar de novo em vez de continuar tentando com um
// token morto.
export function pareceErroDeSessao(mensagem) {
  return /sessão (ausente|inválida|expirada)/i.test(String(mensagem || ''))
}

export function useAuth() {
  return {
    getToken, getEmailExibicao, estaAutenticado, limparSessao,
    solicitarCodigo, confirmarCodigo, pareceErroDeSessao
  }
}

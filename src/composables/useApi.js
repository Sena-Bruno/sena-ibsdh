// Centraliza as chamadas ao backend (Apps Script, via proxy Netlify /api).
// Antes, cada página (index.html, dashboard.html, mentor.html, ranking.html,
// desafio.html) tinha sua própria cópia quase idêntica de fetch(...).
// Agora todas usam esta única função.

const APPS_SCRIPT_URL = '/api'
const TIMEOUT_MS = 20000

// Chamadas que passam por um modelo de IA no backend (avaliação, tutor) demoram
// bem mais que uma consulta a planilha, e ainda somam o overhead do proxy.
export const TIMEOUT_IA_MS = 60000

// `fetch` rejeita com TypeError quando a requisição nem chegou a acontecer:
// sem conexão, DNS, o CSP barrando o destino, um bloqueador do navegador. A
// mensagem nativa desse caso é "Failed to fetch" — em inglês, e sem nenhuma
// pista do que o aluno deveria fazer. Como ela é jogada direto na tela (ver
// LoginModal.vue), traduzimos aqui, antes que chegue lá.
export const MSG_FALHA_REDE =
  'Não foi possível falar com o servidor. Verifique sua conexão e tente novamente.'

/**
 * Distingue "a resposta veio e não prestou" de "a requisição não saiu do
 * navegador". Só o segundo caso é um TypeError — erros de HTTP viram Error
 * comum aqui, e um JSON quebrado vira SyntaxError.
 */
export function ehFalhaDeRede(e) {
  return e instanceof TypeError
}

/**
 * Chama o backend (Apps Script via proxy /api) com uma action e payload.
 * @param {object} payload - deve conter pelo menos { action: '...' }
 * @param {object} [opcoes] - { timeoutMs } para sobrescrever o tempo limite
 * @returns {Promise<any>} resposta já parseada como JSON
 */
export async function callApi(payload, opcoes) {
  const limite = (opcoes && opcoes.timeoutMs) || TIMEOUT_MS
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), limite)
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    if (!res.ok) {
      throw new Error('Servidor respondeu com erro ' + res.status)
    }
    return await res.json()
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error('O servidor demorou demais para responder. Tente novamente.')
    }
    if (ehFalhaDeRede(e)) throw new Error(MSG_FALHA_REDE)
    throw e
  } finally {
    clearTimeout(timeoutId)
  }
}

export function useApi() {
  return { callApi }
}

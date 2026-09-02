// Centraliza as chamadas ao backend (Apps Script, via proxy Netlify /api).
// Antes, cada página (index.html, dashboard.html, mentor.html, ranking.html,
// desafio.html) tinha sua própria cópia quase idêntica de fetch(...).
// Agora todas usam esta única função.

const APPS_SCRIPT_URL = '/api'
const TIMEOUT_MS = 20000
// Chamadas que passam por um modelo de IA no backend (avaliação, tutor) demoram
// bem mais que uma consulta a planilha, e ainda somam o overhead do proxy.
export const TIMEOUT_IA_MS = 60000

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
    throw e
  } finally {
    clearTimeout(timeoutId)
  }
}

export function useApi() {
  return { callApi }
}

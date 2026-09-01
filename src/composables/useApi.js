// Centraliza as chamadas ao backend (Apps Script, via proxy Netlify /api).
// Antes, cada página (index.html, dashboard.html, mentor.html, ranking.html,
// desafio.html) tinha sua própria cópia quase idêntica de fetch(...).
// Agora todas usam esta única função.

const APPS_SCRIPT_URL = '/api'

/**
 * Chama o backend (Apps Script via proxy /api) com uma action e payload.
 * @param {object} payload - deve conter pelo menos { action: '...' }
 * @returns {Promise<any>} resposta já parseada como JSON
 */
export async function callApi(payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    throw new Error('Servidor respondeu com erro ' + res.status)
  }
  return res.json()
}

export function useApi() {
  return { callApi }
}

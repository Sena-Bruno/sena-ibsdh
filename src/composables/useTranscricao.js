// Junção de texto da transcrição por voz.
//
// Por que isso existe: o motor de reconhecimento de voz do navegador (em
// especial o do Chrome no Android) não entrega os trechos de forma
// previsível. Ele pode:
//   - reemitir como "final" um trecho que já tinha sido reportado antes;
//   - entregar trechos CUMULATIVOS em índices crescentes, ou seja, cada
//     novo resultado contém tudo o que já foi dito mais uma palavra
//     ("estou" → "estou testando" → "estou testando minha"...);
//   - reprocessar a cauda do áudio quando a sessão é reiniciada.
//
// Qualquer lógica baseada em índice (ex: "só concatena índice novo") falha
// em pelo menos um desses casos. Por isso a decisão aqui é sempre pelo
// CONTEÚDO do texto, o que funciona independente do padrão que o motor use.

const MIN_PALAVRAS_SOBREPOSICAO = 2

function normalizar(texto) {
  return (texto || '').replace(/\s+/g, ' ').trim()
}

function palavras(texto) {
  return texto ? texto.split(' ') : []
}

/**
 * Junta dois trechos de transcrição evitando duplicação.
 *
 * @param {string} base - texto já acumulado
 * @param {string} novo - trecho novo vindo do reconhecimento
 * @returns {string} texto combinado, sem repetir o que já estava em `base`
 */
export function juntarSemDuplicar(base, novo) {
  const b = normalizar(base)
  const n = normalizar(novo)
  if (!b) return n
  if (!n) return b

  const bLower = b.toLowerCase()
  const nLower = n.toLowerCase()

  // Trecho cumulativo: o novo já contém tudo o que tínhamos e cresceu.
  // Exige ser estritamente maior para não engolir uma repetição legítima
  // de mesmo tamanho (ex: "sim" seguido de "sim").
  if (nLower.startsWith(bLower) && n.length > b.length) return n

  // Reemissão do mesmo trecho que já está no fim do texto acumulado.
  // Só vale a partir de 2 palavras, senão uma repetição real e curta
  // ("sim sim", "não não") seria descartada por engano.
  const pn = palavras(n)
  if (pn.length >= MIN_PALAVRAS_SOBREPOSICAO && bLower.endsWith(nLower)) return b

  // Sobreposição na fronteira: o fim do acumulado é igual ao começo do novo
  // (típico quando a sessão reinicia e a cauda do áudio é reprocessada).
  const pb = palavras(b)
  const maxSobreposicao = Math.min(pb.length, pn.length)
  for (let k = maxSobreposicao; k >= MIN_PALAVRAS_SOBREPOSICAO; k--) {
    const fimDaBase = pb.slice(-k).join(' ').toLowerCase()
    const inicioDoNovo = pn.slice(0, k).join(' ').toLowerCase()
    if (fimDaBase === inicioDoNovo) {
      return pb.concat(pn.slice(k)).join(' ')
    }
  }

  return b + ' ' + n
}

/**
 * Monta o texto final de uma sessão de reconhecimento a partir da lista
 * completa de resultados do evento.
 *
 * É reconstruído do zero a cada evento (nunca acumulado incrementalmente),
 * o que torna a função idempotente: não importa quantas vezes o motor
 * reemita ou revise os resultados, o texto é sempre derivado do array
 * autoritativo que o navegador entrega.
 *
 * @param {SpeechRecognitionResultList|Array} results - event.results
 * @returns {{ final: string, interim: string }}
 */
export function montarTextoDaSessao(results) {
  let final = ''
  let interim = ''
  for (let i = 0; i < results.length; i++) {
    const trecho = results[i][0].transcript
    if (results[i].isFinal) {
      final = juntarSemDuplicar(final, trecho)
    } else {
      interim = juntarSemDuplicar(interim, trecho)
    }
  }
  return { final, interim }
}

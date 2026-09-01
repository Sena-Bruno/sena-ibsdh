// Controla tema claro/escuro, alto contraste e "reduzir movimento".
// As classes são aplicadas em document.body (fora da árvore do Vue),
// exatamente como no HTML original, então o CSS de cada página
// (body.tema-claro, body.alto-contraste, body.reduzir-movimento) continua
// funcionando sem alterações.
//
// Chaves de localStorage unificadas entre Dashboard e Simulador
// ('sena_tema' / 'sena_alto_contraste' / 'sena_reduzir_movimento'): antes o
// dashboard.html e o index.html usavam prefixos diferentes ('sena_' vs
// 'sen-'), então a preferência escolhida numa tela não valia na outra.

export function useAccessibility(keys) {
  const storageKeys = {
    tema: keys?.tema || 'sena_tema',
    altoContraste: keys?.altoContraste || 'sena_alto_contraste',
    reduzirMovimento: keys?.reduzirMovimento || 'sena_reduzir_movimento'
  }

  function carregarPreferencias() {
    if (localStorage.getItem(storageKeys.tema) === 'claro') {
      document.body.classList.add('tema-claro')
    }
    if (localStorage.getItem(storageKeys.altoContraste) === 'true') {
      document.body.classList.add('alto-contraste')
    }
    if (localStorage.getItem(storageKeys.reduzirMovimento) === 'true') {
      document.body.classList.add('reduzir-movimento')
    }
  }

  function toggleTema() {
    document.body.classList.toggle('tema-claro')
    const isClaro = document.body.classList.contains('tema-claro')
    localStorage.setItem(storageKeys.tema, isClaro ? 'claro' : 'escuro')
  }

  function toggleAltoContraste() {
    document.body.classList.toggle('alto-contraste')
    localStorage.setItem(storageKeys.altoContraste, document.body.classList.contains('alto-contraste'))
  }

  function toggleReduzirMovimento() {
    document.body.classList.toggle('reduzir-movimento')
    localStorage.setItem(storageKeys.reduzirMovimento, document.body.classList.contains('reduzir-movimento'))
  }

  // Limpa as classes do body quando o componente que chamou isso for desmontado
  // (evita "vazar" tema-claro/alto-contraste para outra view na SPA).
  function limparClasses() {
    document.body.classList.remove('tema-claro', 'alto-contraste', 'reduzir-movimento')
  }

  return {
    carregarPreferencias,
    toggleTema,
    toggleAltoContraste,
    toggleReduzirMovimento,
    limparClasses
  }
}

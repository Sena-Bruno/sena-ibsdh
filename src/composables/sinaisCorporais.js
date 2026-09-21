// Sinais corporais do paciente — a ponte entre o estado emocional e o
// avatar visual.
//
// ┌───────────────────────────────────────────────────────────────────────┐
// │  A MESMA REGRA DE `nucleo/sena_nucleo/corpo.py`                       │
// │                                                                       │
// │  OS SINAIS SÃO EXIBIDOS. A LEITURA DELES NUNCA É.                     │
// │                                                                       │
// │  O avatar não desenha uma cara triste para "fechado" nem um sorriso   │
// │  para "aberto" — isso entregaria pronta a interpretação que é o       │
// │  trabalho do aluno fazer. Ele mostra sinais BRUTOS: para onde o olhar │
// │  vai, quanto a respiração acelera, se o corpo "parece longe" (via     │
// │  desfoque, o equivalente visual de "o corpo está na cadeira, mas      │
// │  parece longe" que `corpo.descrever()` já escreve em texto). A boca   │
// │  só se move quando HÁ FALA — nunca se curva para expressar humor.     │
// └───────────────────────────────────────────────────────────────────────┘
//
// ── Por que isto existe como adaptador, e não como o motor de verdade ──
//
// O simulador ao vivo (este arquivo) não roda o motor Python — ele infere
// um estado aproximado (aberto/engajado/neutro/resistente/fechado, com um
// `pct`) por palavra-chave sobre o texto que a Groq gera, em
// `inferirEstadoPaciente` (SimuladorView.vue). É bem mais pobre que as
// sete dimensões contínuas de `nucleo/sena_nucleo/estado.py`.
//
// `inferirSinaisCorporais` aqui é a ponte HONESTA entre os dois mundos: um
// preset por estado, escolhido por coerência (não extraído de dado
// nenhum — mesmo status de "hipótese pedagógica" que várias constantes do
// motor Python, ver nucleo/FUNDAMENTACAO.md). Quando a etapa 4 conectar o
// backend real (`sena_servico`), troque a CHAMADA a esta função pela
// leitura de `abertura_completa(...).sinais` — o formato de saída já é o
// mesmo (respiracaoPorMinuto, contatoVisual, microTensao, presenca,
// velocidadeDaFala), então `AvatarPaciente.vue` não muda nada.

/** As cinco leituras que `inferirEstadoPaciente` (SimuladorView.vue) produz. */
export const ESTADOS_CONHECIDOS = ['aberto', 'engajado', 'neutro', 'resistente', 'fechado']

// Um preset por estado — não uma interpolação linear de um único eixo.
// "Resistente" e "fechado" são qualitativamente diferentes (fricção ativa
// vs. retraimento), não dois pontos da mesma reta, e um preset por estado
// deixa isso representável.
const PRESETS = Object.freeze({
  aberto: { contatoVisual: 0.80, microTensao: 0.15, presenca: 0.85, respiracaoPorMinuto: 15, velocidadeDaFala: 150 },
  engajado: { contatoVisual: 0.70, microTensao: 0.20, presenca: 0.80, respiracaoPorMinuto: 16, velocidadeDaFala: 160 },
  neutro: { contatoVisual: 0.55, microTensao: 0.30, presenca: 0.65, respiracaoPorMinuto: 16, velocidadeDaFala: 150 },
  resistente: { contatoVisual: 0.45, microTensao: 0.55, presenca: 0.60, respiracaoPorMinuto: 19, velocidadeDaFala: 165 },
  fechado: { contatoVisual: 0.20, microTensao: 0.40, presenca: 0.35, respiracaoPorMinuto: 14, velocidadeDaFala: 110 },
})

/**
 * Traduz o estado emocional (string) em sinais corporais.
 *
 * Nome desconhecido cai em "neutro" — nunca lança erro. Um valor de estado
 * inesperado (ex.: typo numa edição futura de `inferirEstadoPaciente`) é
 * um problema de outro arquivo; o avatar não deveria quebrar por causa
 * disso, só mostrar um paciente neutro até o typo ser corrigido.
 */
export function inferirSinaisCorporais(estado) {
  const preset = PRESETS[estado] || PRESETS.neutro
  return { ...preset }
}

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

/**
 * Converte sinais corporais em valores de CSS prontos para usar — durações,
 * pixels, opacidades. Toda saída é clampada: um `NaN` ou `undefined` vindo
 * de um `estado` malformado não pode virar `animation-duration: NaNs`, que
 * quebraria a animação em silêncio (sem erro no console, sem sintoma óbvio
 * — só o avatar parado, e ninguém saberia por quê).
 */
export function calcularEstilosAvatar(sinais) {
  const s = sinais && typeof sinais === 'object' ? sinais : PRESETS.neutro

  const rpm = Number.isFinite(s.respiracaoPorMinuto) ? s.respiracaoPorMinuto : 16
  const contato = clamp01(Number.isFinite(s.contatoVisual) ? s.contatoVisual : 0.55)
  const tensao = clamp01(Number.isFinite(s.microTensao) ? s.microTensao : 0.3)
  const presenca = clamp01(Number.isFinite(s.presenca) ? s.presenca : 0.65)
  const velocidadeFalaBase = Number.isFinite(s.velocidadeDaFala) ? s.velocidadeDaFala : 150

  // 60/rpm = segundos por ciclo respiratório. Limitado a uma faixa que lê
  // como respiração humana em qualquer velocidade do preset (14–19 rpm no
  // conjunto acima já cabe folgado, a faixa é para blindar entradas fora
  // da tabela).
  const duracaoRespiracaoS = clamp(60 / (rpm || 16), 2.6, 5.5)

  // Quanto o olhar se desvia do centro, em px. 0 = olho no aluno; no
  // máximo, "o olhar fica na janela" (o mesmo texto de corpo.descrever()).
  const desvioOlharPx = Math.round((1 - contato) * 6)

  // Multiplicador de velocidade da boca ao falar: quem fala mais rápido no
  // texto (velocidadeDaFala mais alta) tem o ciclo de abrir/fechar mais
  // curto. Faixa limitada para nunca virar um tremor rápido demais
  // (epilepsia fotossensível é um risco real em animação rápida e
  // repetitiva — 0.5s é o piso).
  const duracaoFalaS = clamp(0.34 * (150 / (velocidadeFalaBase || 150)), 0.2, 0.5)

  return {
    duracaoRespiracao: `${duracaoRespiracaoS.toFixed(2)}s`,
    desvioOlhar: `${desvioOlharPx}px`,
    tensao: tensao.toFixed(2),
    // Nunca chega a 100% de desfoque: "parece longe" é uma leitura, não
    // "sumiu". O piso de opacidade (0.6) e o teto de desfoque (1.6px)
    // mantêm o paciente sempre legível, mesmo no presença mais baixo do
    // conjunto de presets (0.35, no "fechado").
    desfoquePresenca: `${(clamp01(1 - presenca) * 1.6).toFixed(2)}px`,
    opacidadePresenca: (0.6 + presenca * 0.4).toFixed(2),
    duracaoFala: `${duracaoFalaS.toFixed(2)}s`,
  }
}

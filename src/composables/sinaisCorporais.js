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
// O simulador ao vivo do texto-livre (SimuladorView.vue, /index.html) não
// roda o motor Python — ele infere um estado aproximado
// (aberto/engajado/neutro/resistente/fechado, com um `pct`) por
// palavra-chave sobre o texto que a Groq gera, em `inferirEstadoPaciente`.
// É bem mais pobre que as sete dimensões contínuas de
// `nucleo/sena_nucleo/estado.py`.
//
// `inferirSinaisCorporais` aqui é a ponte HONESTA entre os dois mundos: um
// preset por estado, escolhido por coerência (não extraído de dado
// nenhum — mesmo status de "hipótese pedagógica" que várias constantes do
// motor Python, ver nucleo/FUNDAMENTACAO.md).
//
// O Paciente Vivo (PacienteVivoView.vue, etapa 4) NÃO usa este adaptador —
// ele já tem os números de verdade, saídos do motor via
// `AberturaSaida.sinais` (ver `sena_servico/api.py`). Para esse caso, use
// `sinaisReaisParaAvatar` logo abaixo, que só traduz nome de campo
// (snake_case do Python → camelCase daqui) — o mesmo formato de saída
// (respiracaoPorMinuto, contatoVisual, microTensao, presenca,
// velocidadeDaFala) que `inferirSinaisCorporais` já produzia, então
// `AvatarPaciente.vue` e `calcularEstilosAvatar` não mudam nada com a
// troca de origem.

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

/**
 * Traduz `AberturaSaida.sinais` (o dicionário snake_case que
 * `SinaisCorporais.como_dicionario()` — nucleo/sena_nucleo/corpo.py —
 * devolve pela API do Paciente Vivo) para o formato camelCase que
 * `calcularEstilosAvatar` espera.
 *
 * `latencia_de_resposta` e `variabilidade_respiratoria` não têm
 * equivalente visual no avatar ainda — ficam de fora do retorno de
 * propósito, não por esquecimento (ver o cabeçalho deste arquivo).
 *
 * Nunca lança erro: entrada ausente ou malformada cai no preset "neutro",
 * pela mesma razão de `inferirSinaisCorporais` — um dado ruim não pode
 * travar o avatar, só deixá-lo neutro até a causa ser corrigida.
 */
export function sinaisReaisParaAvatar(sinaisDoBackend) {
  if (!sinaisDoBackend || typeof sinaisDoBackend !== 'object') {
    return { ...PRESETS.neutro }
  }
  return {
    respiracaoPorMinuto: sinaisDoBackend.respiracao_por_minuto,
    contatoVisual: sinaisDoBackend.contato_visual,
    microTensao: sinaisDoBackend.micro_tensao,
    presenca: sinaisDoBackend.presenca,
    velocidadeDaFala: sinaisDoBackend.velocidade_da_fala,
  }
}

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

// ── amplificação em torno do neutro ─────────────────────────────────────
//
// Achado ao vivo: com o Paciente Vivo conectado (ideia #2), sessões reais
// raramente produzem contatoVisual/microTensao/presenca perto dos extremos
// 0 ou 1 — ficam a maior parte do tempo a 0,1–0,2 do neutro. Numa escala
// linear direta, essa diferença virava 1–2px de olhar desviado ou uma
// fração de px de desfoque: tecnicamente correto, praticamente invisível
// numa tela pequena. "O aluno tem que ver" (a própria premissa da ideia
// #2) falha se o sinal existir no número mas não existir na tela.
//
// A correção NÃO é mentir o número (isso seria inventar leitura, a coisa
// que este módulo inteiro existe para não fazer) — é amplificar o DESVIO
// em relação ao neutro antes de desenhar, mantendo os extremos exatamente
// onde já estavam (0 e 1 continuam mapeando para 0 e 1, sempre clampado).
// GANHO=2,5 é uma escolha de legibilidade visual, não um dado — calibrada
// olhando os números de sessões reais simuladas, não extraída de nenhuma
// fonte. Se um dia isso ficar exagerado ou sutil demais na prática, é
// aqui que se ajusta, e só aqui.
const GANHO_AMPLIFICACAO = 2.5
const amplificarEmTornoDoNeutro = (valor, centroNeutro) =>
  clamp01(centroNeutro + (valor - centroNeutro) * GANHO_AMPLIFICACAO)

/**
 * Converte sinais corporais em valores de CSS prontos para usar — durações,
 * pixels, opacidades. Toda saída é clampada: um `NaN` ou `undefined` vindo
 * de um `estado` malformado não pode virar `animation-duration: NaNs`, que
 * quebraria a animação em silêncio (sem erro no console, sem sintoma óbvio
 * — só o avatar parado, e ninguém saberia por quê).
 */
// Máximo que o olhar 3D gira a cabeça em torno do eixo Y, em radianos, no
// desvio total (contato visual 0). Equivalente ao "10px" de
// `desvioOlharPx` abaixo — mesma leitura ("o olhar fica na janela"), só
// que como ângulo em vez de deslocamento em tela.
const ANGULO_MAX_OLHAR_RAD = 0.5

// O núcleo dos três sinais "estáticos" (contato, tensão, presença) e das
// duas durações (respiração, fala) — compartilhado entre
// `calcularEstilosAvatar` (2D, formata em string de CSS) e
// `calcularParametrosAvatar3D` (3D, devolve número puro para o Three.js).
// As DUAS leituras do avatar (bidimensional e tridimensional) vêm do MESMO
// número amplificado — nenhuma das duas "decide" um valor que a outra não
// veria, só desenha diferente.
function computarBase(sinais) {
  const s = sinais && typeof sinais === 'object' ? sinais : PRESETS.neutro

  const rpm = Number.isFinite(s.respiracaoPorMinuto) ? s.respiracaoPorMinuto : 16
  const contatoBruto = clamp01(Number.isFinite(s.contatoVisual) ? s.contatoVisual : 0.55)
  const tensaoBruta = clamp01(Number.isFinite(s.microTensao) ? s.microTensao : 0.3)
  const presencaBruta = clamp01(Number.isFinite(s.presenca) ? s.presenca : 0.65)
  const velocidadeFalaBase = Number.isFinite(s.velocidadeDaFala) ? s.velocidadeDaFala : 150

  // Os três sinais "estáticos" (o que aparece numa imagem parada, sem
  // esperar animação nenhuma) passam pela amplificação — ver o
  // comentário acima de GANHO_AMPLIFICACAO. Respiração e fala não
  // precisam: já têm faixa própria (2,6–5,5s / 0,2–0,5s) que é bem mais
  // larga que 0–1, então uma diferença real já rende diferença de
  // duração perceptível sem precisar de amplificação extra.
  const contato = amplificarEmTornoDoNeutro(contatoBruto, PRESETS.neutro.contatoVisual)
  const tensao = amplificarEmTornoDoNeutro(tensaoBruta, PRESETS.neutro.microTensao)
  const presenca = amplificarEmTornoDoNeutro(presencaBruta, PRESETS.neutro.presenca)

  // 60/rpm = segundos por ciclo respiratório. Limitado a uma faixa que lê
  // como respiração humana em qualquer velocidade do preset (14–19 rpm no
  // conjunto acima já cabe folgado, a faixa é para blindar entradas fora
  // da tabela).
  const duracaoRespiracaoS = clamp(60 / (rpm || 16), 2.6, 5.5)

  // Multiplicador de velocidade da boca ao falar: quem fala mais rápido no
  // texto (velocidadeDaFala mais alta) tem o ciclo de abrir/fechar mais
  // curto. Faixa limitada para nunca virar um tremor rápido demais
  // (epilepsia fotossensível é um risco real em animação rápida e
  // repetitiva — 0.5s é o piso).
  const duracaoFalaS = clamp(0.34 * (150 / (velocidadeFalaBase || 150)), 0.2, 0.5)

  return { contato, tensao, presenca, duracaoRespiracaoS, duracaoFalaS }
}

export function calcularEstilosAvatar(sinais) {
  const { contato, tensao, presenca, duracaoRespiracaoS, duracaoFalaS } = computarBase(sinais)

  // Quanto o olhar se desvia do centro, em px. 0 = olho no aluno; no
  // máximo, "o olhar fica na janela" (o mesmo texto de corpo.descrever()).
  // 10px (não 6): o valor menor deixava até desvios reais e notáveis
  // (contato caindo de 0,55 para 0,35, por exemplo) quase imperceptíveis.
  const desvioOlharPx = Math.round((1 - contato) * 10)

  return {
    duracaoRespiracao: `${duracaoRespiracaoS.toFixed(2)}s`,
    desvioOlhar: `${desvioOlharPx}px`,
    tensao: tensao.toFixed(2),
    // Nunca chega a 100% de desfoque: "parece longe" é uma leitura, não
    // "sumiu". O piso de opacidade (0.6) e o teto de desfoque (3.2px, já
    // amplificado — ver GANHO_AMPLIFICACAO) mantêm o paciente sempre
    // legível, mesmo no presença mais baixo do conjunto de presets
    // (0.35, no "fechado").
    desfoquePresenca: `${(clamp01(1 - presenca) * 3.2).toFixed(2)}px`,
    opacidadePresenca: (0.6 + presenca * 0.4).toFixed(2),
    duracaoFala: `${duracaoFalaS.toFixed(2)}s`,
  }
}

/**
 * A mesma tradução de `calcularEstilosAvatar`, para o avatar 3D
 * (AvatarPaciente3D.vue / avatar3d.js): números puros em vez de string de
 * CSS, porque quem consome isto é uma cena Three.js, não um `style`.
 * `opacidade` já inclui o piso de 0,6 pela mesma razão do 2D — "parece
 * longe" nunca pode ficar invisível.
 */
export function calcularParametrosAvatar3D(sinais) {
  const { contato, tensao, presenca, duracaoRespiracaoS, duracaoFalaS } = computarBase(sinais)
  return {
    periodoRespiracaoS: duracaoRespiracaoS,
    anguloOlharRad: (1 - contato) * ANGULO_MAX_OLHAR_RAD,
    tensao,
    presenca,
    opacidade: 0.6 + presenca * 0.4,
    periodoFalaS: duracaoFalaS,
  }
}

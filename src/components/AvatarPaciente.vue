<!-- A presença visual do paciente virtual — não um rosto que expressa humor,
     um corpo que exibe SINAIS.

     ┌─────────────────────────────────────────────────────────────────┐
     │  A MESMA REGRA DE `nucleo/sena_nucleo/corpo.py`                  │
     │                                                                  │
     │  OS SINAIS SÃO EXIBIDOS. A LEITURA DELES NUNCA É.                │
     │                                                                  │
     │  Este avatar NUNCA muda de expressão para comunicar humor — não  │
     │  há sorriso para "aberto" nem carranca para "fechado". O que se  │
     │  move são sinais brutos, os mesmos que `corpo.descrever()` já    │
     │  escreve em texto: para onde o olhar vai (contatoVisual), se o   │
     │  corpo "parece longe" (presença, via desfoque — o equivalente    │
     │  visual da frase "o corpo está na cadeira, mas parece longe"),   │
     │  a respiração, e a boca abrindo SÓ quando há fala de verdade.    │
     │  Ler o que esses sinais significam continua sendo trabalho do    │
     │  aluno — exatamente como no motor Python.                        │
     │                                                                  │
     │  Ilustrado, não fotorrealista, de propósito: sidesteps o vale da │
     │  estranheza e qualquer questão de direito de imagem, e mantém o  │
     │  avatar claramente identificável como simulação — nunca algo que │
     │  poderia ser confundido com uma pessoa real.                     │
     └─────────────────────────────────────────────────────────────────┘

     Fonte dos sinais: duas, pela prop `sinais` vs. `estado` (ver abaixo).
     No Simulador de texto-livre (SimuladorView.vue), ainda é
     `sinaisCorporais.inferirSinaisCorporais()`, um adaptador por
     palavra-chave (ver o cabeçalho daquele arquivo). No Paciente Vivo
     (PacienteVivoView.vue, etapa 4), já são os números de verdade do
     motor Python, via `sinaisCorporais.sinaisReaisParaAvatar()` sobre
     `AberturaSaida.sinais`. Este componente não sabe a diferença — as
     duas chegam no mesmo formato de `calcularEstilosAvatar`. -->

<template>
  <div
    class="avatar-paciente"
    :class="{ 'avatar-parado': reduzirMovimento }"
    :style="estiloRaiz"
    role="img"
    :aria-label="`Presença do paciente virtual, estado ${estado}`"
  >
    <svg viewBox="0 0 120 120" class="avatar-svg" aria-hidden="true">
      <!-- torso: escala levemente no eixo Y para simular respiração -->
      <g class="avatar-torso">
        <path d="M20 118 C20 90 40 78 60 78 C80 78 100 90 100 118 Z" class="avatar-corpo-fill" />
      </g>

      <!-- cabeça -->
      <g class="avatar-cabeca">
        <circle cx="60" cy="48" r="30" class="avatar-corpo-fill" />

        <!-- sobrancelhas: leve inclinação para dentro com tensão -->
        <g class="avatar-sobrancelhas">
          <path d="M42 38 Q50 34 56 37" class="avatar-tracos" />
          <path d="M78 38 Q70 34 64 37" class="avatar-tracos" />
        </g>

        <!-- olhos: o par translada para o desvio de olhar -->
        <g class="avatar-olhos">
          <g class="avatar-pupila">
            <ellipse cx="48" cy="48" rx="4.4" ry="5.2" class="avatar-olho-fundo" />
            <circle cx="48" cy="48" r="2.1" class="avatar-pupila-fill" />
          </g>
          <g class="avatar-pupila">
            <ellipse cx="72" cy="48" rx="4.4" ry="5.2" class="avatar-olho-fundo" />
            <circle cx="72" cy="48" r="2.1" class="avatar-pupila-fill" />
          </g>
          <!-- pálpebras: piscar periódico, independente do estado -->
          <rect x="42.5" y="41.5" width="11" height="13" class="avatar-palpebra avatar-palpebra-esq" />
          <rect x="66.5" y="41.5" width="11" height="13" class="avatar-palpebra avatar-palpebra-dir" />
        </g>

        <!-- boca: só se abre quando `falando` é verdadeiro -->
        <ellipse cx="60" cy="65" rx="7" ry="1.6" class="avatar-boca" :class="{ 'avatar-boca-falando': falando }" />
      </g>
    </svg>

    <p class="avatar-legenda" v-if="mostrarLegenda">{{ legendaEstado }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { inferirSinaisCorporais, calcularEstilosAvatar } from '../composables/sinaisCorporais.js'

const props = defineProps({
  // Um dos ESTADOS_CONHECIDOS de sinaisCorporais.js. Qualquer outra coisa
  // cai em "neutro" — ver inferirSinaisCorporais. Ignorado quando `sinais`
  // (abaixo) é passado.
  estado: { type: String, default: 'neutro' },
  // Sinais REAIS já traduzidos (ver sinaisCorporais.sinaisReaisParaAvatar)
  // — usado pelo Paciente Vivo, que tem os números de verdade do motor
  // Python em vez de um preset por palavra-chave. Quando presente, tem
  // prioridade sobre `estado`. `null` (padrão) mantém o comportamento
  // antigo — nenhuma tela existente quebra com esta prop nova.
  sinais: { type: Object, default: null },
  // true enquanto speechSynthesis está falando esta fala (ver
  // SimuladorView.vue: falarTexto/utter.onstart/onend). A boca só se move
  // aqui dentro — nunca por causa do `estado`.
  falando: { type: Boolean, default: false },
  // Espelha `prefs.movimento` do useAccessibility do view pai. Passado
  // como prop, não lido de document.body aqui dentro, para o componente
  // continuar puro e testável isolado do DOM global.
  reduzirMovimento: { type: Boolean, default: false },
  // Rótulo textual pequeno abaixo do avatar (ex.: "Neutro"). Opcional —
  // a maior parte das telas já mostra isso em `.estado-valor` ao lado;
  // ligue só onde não houver essa legenda redundante.
  mostrarLegenda: { type: Boolean, default: false },
})

const LEGENDAS = {
  aberto: 'Aberto', engajado: 'Engajado', neutro: 'Neutro',
  resistente: 'Resistente', fechado: 'Fechado',
}
const legendaEstado = computed(() => LEGENDAS[props.estado] || 'Neutro')

const estiloRaiz = computed(() => {
  const sinais = props.sinais || inferirSinaisCorporais(props.estado)
  const c = calcularEstilosAvatar(sinais)
  return {
    '--avatar-dur-respiracao': c.duracaoRespiracao,
    '--avatar-desvio-olhar': c.desvioOlhar,
    '--avatar-tensao': c.tensao,
    '--avatar-desfoque': c.desfoquePresenca,
    '--avatar-opacidade': c.opacidadePresenca,
    '--avatar-dur-fala': c.duracaoFala,
  }
})
</script>

<style scoped>
.avatar-paciente {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 96px;
  margin: 0 auto;
}

.avatar-svg {
  width: 96px;
  height: 96px;
  filter: blur(var(--avatar-desfoque, 0px)) saturate(calc(0.6 + var(--avatar-opacidade, 1) * 0.4));
  opacity: var(--avatar-opacidade, 1);
  transition: filter 900ms var(--sena-ease, ease), opacity 900ms var(--sena-ease, ease);
}

.avatar-corpo-fill { fill: var(--cyan, #0e7a6f); opacity: 0.9; }
.avatar-tracos { fill: none; stroke: var(--bg, #faf8f4); stroke-width: 2; stroke-linecap: round; }
.avatar-olho-fundo { fill: var(--bg, #faf8f4); opacity: 0.85; }
.avatar-pupila-fill { fill: var(--panel, #ffffff); }
.avatar-palpebra { fill: var(--cyan, #0e7a6f); }
.avatar-boca { fill: var(--bg, #faf8f4); opacity: 0.75; transform-origin: 60px 65px; }

.avatar-legenda {
  margin: 0;
  font-size: var(--sena-t-micro, 12px);
  color: var(--text-faint, #786f5e);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── sobrancelhas: tensão baixa a sobrancelha em direção ao olho ────── */
/* Translação, não rotação: com o par de traços desenhado assimétrico
   (externo mais alto, interno mais baixo — a curva de uma sobrancelha
   franzida), rotacionar o grupo inteiro giraria os dois traços na MESMA
   direção angular, o que lê como "cabeça inclinada", não como tensão. */
.avatar-sobrancelhas {
  /* 6px (não 3px): ver GANHO_AMPLIFICACAO em sinaisCorporais.js — sem
     isso, uma sessão real de tensão moderada (não no extremo 0 ou 1)
     movia a sobrancelha menos de 1px, imperceptível na prática. */
  transform: translateY(calc(var(--avatar-tensao, 0.3) * 6px));
  transition: transform 900ms var(--sena-ease, ease);
}

/* ── olhos: desvio de olhar (contato visual) ────────────────────────── */
.avatar-olhos {
  transform: translateX(var(--avatar-desvio-olhar, 0px));
  transition: transform 900ms var(--sena-ease, ease);
}

/* ── respiração: leve escala vertical do torso ──────────────────────── */
.avatar-torso {
  transform-origin: 60px 118px;
  animation: avatar-respirar var(--avatar-dur-respiracao, 4s) ease-in-out infinite;
}
@keyframes avatar-respirar {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(1.018); }
}

/* ── piscar: periódico, independente do estado ──────────────────────── */
.avatar-palpebra {
  transform-origin: center;
  animation: avatar-piscar 5.2s ease-in-out infinite;
}
.avatar-palpebra-dir { animation-delay: 40ms; }
@keyframes avatar-piscar {
  0%, 94%, 100% { transform: scaleY(0.02); }
  97% { transform: scaleY(1); }
}

/* ── boca: só se move quando `falando` — nunca por causa do estado ──── */
.avatar-boca { transform: scaleY(1); }
.avatar-boca-falando {
  animation: avatar-falar var(--avatar-dur-fala, 0.32s) ease-in-out infinite;
}
@keyframes avatar-falar {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(3.4); }
}

/* ── reduzir movimento: para tudo, mantém o estado final legível ────── */
/* A regra global do view pai (body.reduzir-movimento .sim-page *) já
   zera duration; esta classe cobre o caso de o componente ser usado fora
   de .sim-page algum dia, e documenta a intenção aqui mesmo. */
.avatar-parado .avatar-torso,
.avatar-parado .avatar-palpebra,
.avatar-parado .avatar-boca-falando {
  animation: none;
}
.avatar-parado .avatar-svg,
.avatar-parado .avatar-olhos,
.avatar-parado .avatar-sobrancelhas {
  transition: none;
}

@media (prefers-reduced-motion: reduce) {
  .avatar-torso, .avatar-palpebra, .avatar-boca-falando { animation: none; }
  .avatar-svg, .avatar-olhos, .avatar-sobrancelhas { transition: none; }
}
</style>

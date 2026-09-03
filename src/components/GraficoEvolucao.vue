<template>
  <div class="evo">
    <div class="evo-head">
      <div>
        <div class="evo-title">Evolução das notas</div>
        <div class="evo-sub">Sua melhor nota em cada aula, na ordem do curso</div>
      </div>
      <button
        v-if="pontos.length"
        class="evo-toggle"
        type="button"
        :aria-pressed="mostrarTabela"
        @click="mostrarTabela = !mostrarTabela"
      >{{ mostrarTabela ? 'Ver gráfico' : 'Ver tabela' }}</button>
    </div>

    <!-- Sem dados suficientes -->
    <div v-if="pontos.length < 2" class="evo-vazio">
      {{ pontos.length === 0
        ? 'Conclua uma aula para começar a acompanhar sua evolução.'
        : 'Conclua mais uma aula para ver a linha de evolução.' }}
    </div>

    <!-- Tabela: o mesmo dado, sem depender de cor nem de hover -->
    <div v-else-if="mostrarTabela" class="evo-tabela-wrap">
      <table class="evo-tabela">
        <caption class="sr-only">Melhor nota por aula, na ordem do curso</caption>
        <thead>
          <tr>
            <th scope="col">Aula</th>
            <th scope="col">Título</th>
            <th scope="col" class="num">Nota</th>
            <th scope="col" class="num">Mínima</th>
            <th scope="col" class="num">Tentativas</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in pontos" :key="p.aula">
            <td>{{ p.rotulo }}</td>
            <td>{{ p.titulo || '—' }}</td>
            <td class="num">{{ p.nota.toFixed(1) }}</td>
            <td class="num">{{ p.notaMinima.toFixed(1) }}</td>
            <td class="num">{{ p.tentativas || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Gráfico -->
    <div v-else class="evo-plot" ref="plotRef">
      <!-- .evo-area casa exatamente com a caixa do SVG: as sobreposições em %
           (pontos, rótulo, tooltip) precisam desse referencial, senão o padding
           dos eixos as desloca da linha. -->
      <div class="evo-area">
      <svg
        :viewBox="`0 0 ${L} ${A}`"
        preserveAspectRatio="none"
        class="evo-svg"
        role="img"
        :aria-label="descricaoAcessivel"
        @pointermove="aoMover"
        @pointerleave="ativo = null"
      >
        <!-- Grade horizontal: hairline sólida, recuada -->
        <line
          v-for="t in ticksY"
          :key="'g' + t"
          :x1="M.e" :x2="L - M.d"
          :y1="escalaY(t)" :y2="escalaY(t)"
          class="evo-grade"
        />

        <!-- Faixa de aprovação + linha de corte (limiar, por isso tracejada) -->
        <rect
          v-if="limiarUnico !== null"
          :x="M.e" :y="M.c"
          :width="L - M.e - M.d"
          :height="Math.max(0, escalaY(limiarUnico) - M.c)"
          class="evo-faixa-ok"
        />
        <line
          v-if="limiarUnico !== null"
          :x1="M.e" :x2="L - M.d"
          :y1="escalaY(limiarUnico)" :y2="escalaY(limiarUnico)"
          class="evo-limiar"
        />

        <!-- Linha da série -->
        <polyline :points="linha" class="evo-linha" />

        <!-- Crosshair -->
        <line
          v-if="ativo !== null"
          :x1="x(ativo)" :x2="x(ativo)"
          :y1="M.c" :y2="A - M.b"
          class="evo-crosshair"
        />
      </svg>

      <!-- Pontos e rótulo em HTML: o SVG é esticado (preserveAspectRatio="none")
           para preencher a largura, o que deformaria círculos e texto. Só a
           geometria reta — linha, grade, limiar — fica dentro do SVG. -->
      <div
        v-for="(p, i) in pontos"
        :key="p.aula"
        :class="['evo-ponto', { 'evo-ponto-abaixo': p.nota < p.notaMinima, 'evo-ponto-ativo': ativo === i }]"
        :style="{ left: pctX(x(i)), top: pct(escalaY(p.nota)) }"
      ></div>

      <!-- Rótulo só no último ponto (nunca um número em cada ponto) -->
      <div
        class="evo-rotulo-fim"
        :style="{ left: pctX(x(pontos.length - 1)), top: pct(escalaY(pontos[pontos.length - 1].nota)) }"
      >{{ pontos[pontos.length - 1].nota.toFixed(1) }}</div>

      <!-- Tooltip -->
      <div
        v-if="ativo !== null"
        class="evo-tip"
        :style="{ left: pctX(x(ativo)), top: pct(escalaY(pontos[ativo].nota)) }"
      >
        <div class="evo-tip-aula">{{ pontos[ativo].rotulo }}<span v-if="pontos[ativo].titulo"> · {{ pontos[ativo].titulo }}</span></div>
        <div class="evo-tip-nota">
          {{ pontos[ativo].nota.toFixed(1) }}
          <span class="evo-tip-min">/ mínima {{ pontos[ativo].notaMinima.toFixed(1) }}</span>
        </div>
        <div class="evo-tip-meta">
          {{ pontos[ativo].nota >= pontos[ativo].notaMinima ? 'Aprovado' : 'Abaixo da mínima' }}
          <template v-if="pontos[ativo].tentativas"> · {{ pontos[ativo].tentativas }} {{ pontos[ativo].tentativas === 1 ? 'tentativa' : 'tentativas' }}</template>
        </div>
      </div>
      <div v-if="limiarUnico !== null" class="evo-limiar-tag" :style="{ top: pct(escalaY(limiarUnico)) }">
        mínima {{ limiarUnico }}
      </div>
      </div><!-- /.evo-area -->

      <!-- Eixos em HTML: fontes nítidas e sem escala distorcida do preserveAspectRatio -->
      <div class="evo-eixo-y">
        <span v-for="t in ticksY" :key="'y' + t" :style="{ top: pct(escalaY(t)) }">{{ t }}</span>
      </div>
      <div class="evo-eixo-x">
        <span v-for="(p, i) in pontos" :key="'x' + p.aula" :style="{ left: pctX(x(i)) }">
          {{ mostrarRotuloX(i) ? p.rotulo : '' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'

const props = defineProps({
  // [{ aula, rotulo, titulo, nota, notaMinima, tentativas }]
  pontos: { type: Array, default: () => [] }
})

const mostrarTabela = ref(false)
const ativo = ref(null)
const plotRef = ref(null)

// Sistema de coordenadas interno. O SVG escala sozinho para qualquer largura,
// então não existe cálculo de devicePixelRatio nem redesenho no resize.
const L = 1000   // largura
const A = 260    // altura
const M = { c: 18, d: 16, b: 8, e: 8 } // margens (cima, direita, baixo, esquerda)

// Domínio do Y: sempre inclui a nota mínima, para o aluno enxergar onde está
// em relação ao corte. Não fixo em 0–10 porque as notas vivem entre 6 e 10 e
// a linha ficava espremida no topo.
// O topo é sempre 10. A base desce até abaixo do menor valor (nota ou mínima) e
// é ajustada para que os ticks fiquem igualmente espaçados — sem um último
// intervalo pela metade.
const dominio = computed(() => {
  const notas = props.pontos.map(p => p.nota)
  const minimas = props.pontos.map(p => p.notaMinima)
  if (!notas.length) return { min: 0, max: 10, passo: 2 }

  const menor = Math.min(...notas, ...minimas)
  const base = Math.max(0, Math.floor(menor) - 1)
  const passo = (10 - base) <= 5 ? 1 : 2
  const degraus = Math.ceil((10 - base) / passo)
  return { min: 10 - degraus * passo, max: 10, passo }
})

const ticksY = computed(() => {
  const { min, max, passo } = dominio.value
  const out = []
  for (let t = min; t <= max; t += passo) out.push(t)
  return out
})

// Se todas as aulas exigem a mesma nota mínima, desenha uma linha de corte.
// Se variam, não desenha (seria mentira) — cada ponto mostra a sua no tooltip.
const limiarUnico = computed(() => {
  const set = new Set(props.pontos.map(p => p.notaMinima))
  return set.size === 1 ? [...set][0] : null
})

function escalaY(v) {
  const { min, max } = dominio.value
  const t = (v - min) / (max - min || 1)
  return M.c + (1 - t) * (A - M.c - M.b)
}

function x(i) {
  const n = props.pontos.length
  if (n <= 1) return M.e + (L - M.e - M.d) / 2
  return M.e + (i / (n - 1)) * (L - M.e - M.d)
}

const linha = computed(() =>
  props.pontos.map((p, i) => `${x(i)},${escalaY(p.nota)}`).join(' ')
)

const pct = (y) => (y / A) * 100 + '%'
const pctX = (vx) => (vx / L) * 100 + '%'

// Afinamento dos rótulos do X pela largura REAL disponível, não pela contagem
// de pontos: no celular cabem bem menos rótulos que no desktop.
const largura = ref(0)
let observador = null

// Observa o elemento atual — e reobserva quando ele muda. Alternar para a
// tabela e voltar recria o nó, e uma observação presa ao nó antigo deixaria
// a largura congelada.
watch(plotRef, (el) => {
  observador?.disconnect()
  observador = null
  if (!el || typeof ResizeObserver === 'undefined') return
  observador = new ResizeObserver(([e]) => { largura.value = e.contentRect.width })
  observador.observe(el)
  largura.value = el.getBoundingClientRect().width
}, { immediate: true, flush: 'post' })

onUnmounted(() => observador?.disconnect())

function mostrarRotuloX(i) {
  const n = props.pontos.length
  if (n <= 1) return true
  const cabem = Math.max(2, Math.floor((largura.value || 600) / 58))
  const passo = Math.ceil(n / cabem)
  // primeiro e último sempre; e o último tem prioridade sobre o vizinho
  if (i === 0 || i === n - 1) return true
  if (i > n - 1 - passo) return false
  return i % passo === 0
}

function aoMover(e) {
  const n = props.pontos.length
  if (!n) return
  const caixa = e.currentTarget.getBoundingClientRect()
  const rel = (e.clientX - caixa.left) / caixa.width // 0..1
  const vx = rel * L
  // ponto mais próximo — alvo generoso, sem precisar acertar o círculo
  let melhor = 0, dist = Infinity
  for (let i = 0; i < n; i++) {
    const d = Math.abs(x(i) - vx)
    if (d < dist) { dist = d; melhor = i }
  }
  ativo.value = melhor
}

const descricaoAcessivel = computed(() => {
  if (props.pontos.length < 2) return 'Gráfico de evolução das notas, sem dados suficientes.'
  const primeira = props.pontos[0]
  const ultima = props.pontos[props.pontos.length - 1]
  return `Evolução das notas em ${props.pontos.length} aulas. ` +
    `Primeira: ${primeira.rotulo}, nota ${primeira.nota.toFixed(1)}. ` +
    `Última: ${ultima.rotulo}, nota ${ultima.nota.toFixed(1)}. ` +
    `Use o botão "Ver tabela" para os valores completos.`
})
</script>

<style scoped>
.evo {
  /* Fundo opaco do tooltip, um por tema (ver .evo-tip) */
  --evo-tip-bg: #10151d;
  margin-bottom: 22px;
  padding: 20px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.02);
}
.evo-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
body.tema-claro .evo { --evo-tip-bg: #ffffff; }
body.alto-contraste .evo { --evo-tip-bg: #000000; }

.evo-title { font-size: 13px; font-weight: 700; color: var(--text); }
.evo-sub { font-size: 12px; color: var(--text-faint); margin-top: 2px; }
.evo-toggle {
  flex-shrink: 0; padding: 6px 12px; border-radius: 8px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-soft); font-family: inherit; font-size: 11px; font-weight: 600; cursor: pointer;
  transition: background .18s, color .18s;
}
.evo-toggle:hover { background: rgba(255, 255, 255, 0.05); color: var(--text); }

.evo-vazio { padding: 40px 16px; text-align: center; color: var(--text-faint); font-size: 13px; }

/* ── Gráfico ─────────────────────────────────────────────────────── */
.evo-plot { position: relative; padding-left: 26px; padding-bottom: 22px; }
.evo-area { position: relative; }
.evo-svg { display: block; width: 100%; height: 200px; overflow: visible; touch-action: pan-y; }

.evo-grade { stroke: var(--border); stroke-width: 1; vector-effect: non-scaling-stroke; }

/* Faixa de aprovação: lavagem discreta, não bloco saturado */
.evo-faixa-ok { fill: var(--cyan); opacity: .05; }
/* Limiar é tracejado de propósito — é um corte, não uma linha de grade */
.evo-limiar {
  stroke: var(--text-faint); stroke-width: 1; stroke-dasharray: 5 4;
  vector-effect: non-scaling-stroke;
}
.evo-limiar-tag {
  position: absolute; right: 0; transform: translateY(-50%);
  font-size: 10px; color: var(--text-faint); background: var(--panel);
  padding: 0 4px; pointer-events: none; letter-spacing: .04em;
}

.evo-linha {
  fill: none; stroke: var(--cyan); stroke-width: 2;
  stroke-linejoin: round; stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

/* Anel na cor da superfície para o ponto não sumir ao cruzar a linha */
.evo-ponto {
  position: absolute; width: 9px; height: 9px; border-radius: 50%;
  transform: translate(-50%, -50%);
  background: var(--cyan); box-shadow: 0 0 0 2px var(--bg);
  pointer-events: none;
  transition: width .12s, height .12s;
}
.evo-ponto-abaixo { background: var(--danger); }
.evo-ponto-ativo { width: 13px; height: 13px; }

.evo-crosshair {
  stroke: var(--text-faint); stroke-width: 1; opacity: .45;
  vector-effect: non-scaling-stroke; pointer-events: none;
}

.evo-rotulo-fim {
  position: absolute; transform: translate(-100%, -170%);
  color: var(--text); font-size: 13px; font-weight: 700;
  font-variant-numeric: tabular-nums;
  pointer-events: none; white-space: nowrap;
}

/* Eixos em HTML — texto nítido, sem sofrer o preserveAspectRatio do SVG */
.evo-eixo-y { position: absolute; left: 0; top: 0; bottom: 22px; width: 24px; }
.evo-eixo-y span {
  position: absolute; right: 4px; transform: translateY(-50%);
  font-size: 10px; color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}
.evo-eixo-x { position: absolute; left: 26px; right: 0; bottom: 0; height: 18px; }
.evo-eixo-x span {
  position: absolute; transform: translateX(-50%);
  font-size: 10px; color: var(--text-faint);
  font-variant-numeric: tabular-nums; white-space: nowrap;
}

.evo-tip {
  position: absolute; transform: translate(-50%, calc(-100% - 16px));
  /* Opaco de propósito: o token --panel é translúcido (0.7) e deixava o
     conteúdo de trás atravessar o tooltip, que flutua sobre o gráfico. */
  background: var(--evo-tip-bg, #10151d); border: 1px solid var(--border);
  border-radius: 10px; padding: 8px 12px; pointer-events: none;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .35); white-space: nowrap; z-index: 5;
  backdrop-filter: blur(8px);
}
.evo-tip-aula { font-size: 10px; color: var(--text-faint); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 3px; }
.evo-tip-nota { font-size: 18px; font-weight: 800; color: var(--text); }
.evo-tip-min { font-size: 11px; font-weight: 500; color: var(--text-faint); }
.evo-tip-meta { font-size: 11px; color: var(--text-soft); margin-top: 2px; }

/* ── Tabela (o mesmo dado, sem depender de cor nem de hover) ─────── */
.evo-tabela-wrap { overflow-x: auto; }
.evo-tabela { width: 100%; border-collapse: collapse; font-size: 12px; }
.evo-tabela th, .evo-tabela td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border); }
.evo-tabela th { color: var(--text-faint); font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: .06em; }
.evo-tabela td { color: var(--text-soft); }
.evo-tabela .num { text-align: right; font-variant-numeric: tabular-nums; }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}

@media (max-width: 480px) {
  .evo { padding: 16px 14px; }
  .evo-svg { height: 170px; }
  .evo-head { flex-direction: column; }
}
</style>

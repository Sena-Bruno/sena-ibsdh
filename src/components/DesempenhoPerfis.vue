<template>
  <div class="perf-card">
    <div class="perf-topo">
      <div>
        <div class="perf-title">Seu desempenho por perfil</div>
        <div class="perf-sub">Média das notas em cada tipo de paciente</div>
      </div>
      <button v-if="perfis.length" class="perf-toggle" @click="verTabela = !verTabela">
        {{ verTabela ? 'Ver gráfico' : 'Ver tabela' }}
      </button>
    </div>

    <div v-if="!perfis.length" class="perf-vazio">
      Pratique alguns casos para ver aqui com quais perfis você vai melhor.
    </div>

    <template v-else>
      <!-- A recomendação vem antes do gráfico: é a leitura que o aluno leva. -->
      <div v-if="recomendacao" class="perf-reco">{{ recomendacao }}</div>

      <table v-if="verTabela" class="perf-tabela">
        <thead>
          <tr><th>Perfil</th><th>Média</th><th>Sessões</th><th>Aprovadas</th><th>Última</th></tr>
        </thead>
        <tbody>
          <tr v-for="p in perfis" :key="p.perfil">
            <td>{{ p.perfil }}</td>
            <td>{{ p.media.toFixed(1) }}</td>
            <td>{{ p.sessoes }}</td>
            <td>{{ p.aprovadas }}</td>
            <td>{{ p.ultima_nota === null ? '—' : p.ultima_nota.toFixed(1) }}</td>
          </tr>
        </tbody>
      </table>

      <div v-else class="perf-plot">
        <div
          v-for="(p, i) in perfis"
          :key="p.perfil"
          class="perf-linha"
          @mouseenter="ativo = i"
          @mouseleave="ativo = null"
          @focus="ativo = i"
          @blur="ativo = null"
          tabindex="0"
          :aria-label="`${p.perfil}: média ${p.media.toFixed(1)} de 10 em ${p.sessoes} ${p.sessoes === 1 ? 'sessão' : 'sessões'}`"
        >
          <div class="perf-nome">{{ p.perfil }}</div>
          <div class="perf-trilho">
            <div class="perf-barra" :style="{ width: largura(p.media) }"></div>
            <!-- Linha da nota mínima: é ela que diz se a barra é boa ou não,
                 sem precisar colorir barra por barra. -->
            <div class="perf-minima" :style="{ left: largura(notaMinima) }"></div>
          </div>
          <div class="perf-valor">{{ p.media.toFixed(1) }}</div>

          <div v-if="ativo === i" class="perf-tip">
            <div class="perf-tip-nota">{{ p.media.toFixed(1) }}<span class="perf-tip-de">/10</span></div>
            <div class="perf-tip-meta">
              {{ p.sessoes }} {{ p.sessoes === 1 ? 'sessão' : 'sessões' }} ·
              {{ p.aprovadas }} {{ p.aprovadas === 1 ? 'aprovada' : 'aprovadas' }}
            </div>
            <div v-if="p.ultima_nota !== null" class="perf-tip-meta">
              Última: {{ p.ultima_nota.toFixed(1) }}
            </div>
          </div>
        </div>

        <!-- O eixo repete a mesma grade das linhas: assim a régua alinha com o
             trilho por construção, em vez de por margem ajustada na mão (que
             desalinhava e fazia "mínima 7" colidir com o "10" no celular). -->
        <div class="perf-eixo">
          <div></div>
          <div class="perf-eixo-regua">
            <span class="perf-eixo-ini">0</span>
            <span class="perf-eixo-min" :style="{ left: largura(notaMinima) }">
              mínima {{ notaMinima }}
            </span>
            <span class="perf-eixo-fim">10</span>
          </div>
          <div></div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  perfis: { type: Array, default: () => [] },
  notaMinima: { type: Number, default: 7 }
})

const verTabela = ref(false)
const ativo = ref(null)

// A escala vai sempre de 0 a 10: é a régua que o aluno já conhece das notas.
// Encolher o eixo para o intervalo dos dados exageraria diferenças pequenas.
const largura = (n) => (Math.max(0, Math.min(10, n)) / 10 * 100) + '%'

// Uma frase, derivada dos números — não vem pronta do backend, para ajustar a
// redação sem nova implantação do Apps Script.
const recomendacao = computed(() => {
  if (!props.perfis.length) return ''

  const abaixo = props.perfis.filter(p => p.media < props.notaMinima)
  const poucas = props.perfis.filter(p => p.sessoes < 2)

  if (abaixo.length) {
    const pior = abaixo[0]   // a lista já vem ordenada da menor média
    return `Seu ponto fraco é ${pior.perfil} (média ${pior.media.toFixed(1)}). `
      + 'Treine esse perfil no plantão ou refaça uma aula com ele.'
  }
  if (poucas.length) {
    return `Você está acima da mínima em todos os perfis praticados. `
      + `Ainda praticou pouco ${poucas.map(p => p.perfil).join(', ')} — vale repetir para confirmar.`
  }
  const menor = props.perfis[0]
  return `Todos os perfis acima da mínima. O mais apertado é ${menor.perfil} `
    + `(média ${menor.media.toFixed(1)}).`
})
</script>

<style scoped>
.perf-card {
  background: var(--panel); border: 1px solid var(--border);
  border-radius: 16px; padding: 18px; margin-bottom: 22px;

  /* Cada tema tem seu próprio passo, validado contra a superfície daquele
     tema — inverter a cor do escuro automaticamente não funciona. */
  --perf-barra: #2e9bb8;
  --perf-trilho: rgba(255, 255, 255, 0.04);
  /* O tooltip flutua sobre texto, então precisa ser opaco. O token --panel é
     translúcido (0.7) e deixa o conteúdo de trás atravessar a leitura. */
  --perf-tip-bg: #10151d;
}
/* O trilho precisa escurecer no tema claro: branco a 4% sobre fundo claro
   some, e com ele some a régua de 0 a 10 que dá sentido ao tamanho da barra. */
body.tema-claro .perf-card {
  --perf-barra: #0891b2;
  --perf-trilho: rgba(15, 23, 42, 0.07);
  --perf-tip-bg: #ffffff;
}
/* No alto contraste quem manda é o token do tema, não a nossa escolha. */
body.alto-contraste .perf-card {
  --perf-barra: var(--cyan);
  --perf-trilho: rgba(255, 255, 255, 0.15);
  --perf-tip-bg: #000000;
}
.perf-topo { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.perf-title { font-size: 13px; font-weight: 700; color: var(--text); }
.perf-sub { font-size: 12px; color: var(--text-faint); margin-top: 2px; }
.perf-toggle {
  padding: 5px 10px; border-radius: 8px; border: 1px solid var(--border);
  background: transparent; color: var(--text-soft);
  font-family: inherit; font-size: 11px; font-weight: 600; cursor: pointer;
  white-space: nowrap;
}
.perf-toggle:hover { background: rgba(255, 255, 255, 0.05); color: var(--text); }

.perf-vazio { padding: 30px 16px; text-align: center; color: var(--text-faint); font-size: 13px; }

.perf-reco {
  font-size: 13px; line-height: 1.5; color: var(--text-soft);
  padding: 10px 12px; margin-bottom: 16px;
  border-radius: 10px; border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.02);
}

.perf-plot { position: relative; }

.perf-linha {
  position: relative;
  display: grid; grid-template-columns: 108px 1fr 34px;
  align-items: center; gap: 10px;
  padding: 3px 0; outline: none;
}
.perf-linha:focus-visible .perf-trilho { box-shadow: 0 0 0 2px var(--cyan); }

.perf-nome {
  font-size: 12px; color: var(--text-soft);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.perf-trilho {
  position: relative; height: 18px;
  background: var(--perf-trilho); border-radius: 4px;
}

/* Barra: ponta arredondada, base quadrada — cresce de uma linha de base só.
   O tom é um degrau mais escuro do cyan do tema: o #6ee7ff da interface tem
   luminosidade alta demais para preencher áreas grandes no fundo escuro. */
.perf-barra {
  position: absolute; left: 0; top: 0; bottom: 0;
  background: var(--perf-barra);
  border-radius: 0 4px 4px 0;
  transition: width .3s ease;
}

.perf-minima {
  position: absolute; top: -2px; bottom: -2px; width: 1px;
  background: var(--text-faint); opacity: .7;
}

.perf-valor {
  font-size: 12px; font-weight: 700; color: var(--text);
  text-align: right; font-variant-numeric: tabular-nums;
}

.perf-eixo {
  display: grid; grid-template-columns: 108px 1fr 34px; gap: 10px;
  margin-top: 6px;
  font-size: 10px; color: var(--text-faint);
}
.perf-eixo-regua { position: relative; height: 12px; }
.perf-eixo-ini { position: absolute; left: 0; }
.perf-eixo-fim { position: absolute; right: 0; }
.perf-eixo-min {
  position: absolute; transform: translateX(-50%);
  white-space: nowrap;
}

.perf-tip {
  position: absolute; left: 118px; bottom: calc(100% - 4px); z-index: 5;
  background: var(--perf-tip-bg); border: 1px solid var(--border);
  border-radius: 10px; padding: 8px 10px; pointer-events: none;
  box-shadow: 0 6px 20px rgba(0, 0, 0, .4);
}
.perf-tip-nota { font-size: 17px; font-weight: 800; color: var(--text); }
.perf-tip-de { font-size: 11px; font-weight: 500; color: var(--text-faint); }
.perf-tip-meta { font-size: 11px; color: var(--text-soft); margin-top: 2px; }

.perf-tabela { width: 100%; border-collapse: collapse; font-size: 12px; }
.perf-tabela th, .perf-tabela td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border); }
.perf-tabela th {
  color: var(--text-faint); font-weight: 700; text-transform: uppercase;
  font-size: 10px; letter-spacing: .06em;
}
.perf-tabela td { color: var(--text-soft); }

@media (max-width: 480px) {
  .perf-linha, .perf-eixo { grid-template-columns: 84px 1fr 32px; gap: 8px; }
  /* Numa régua estreita "mínima 7" e "10" não cabem juntos. O "10" é o que se
     perde: a ponta do trilho já é 10, e cada barra traz seu valor ao lado. */
  .perf-eixo-fim { display: none; }
  .perf-tip { left: 0; }
}
</style>

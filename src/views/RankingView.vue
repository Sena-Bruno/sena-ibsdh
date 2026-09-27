<template>
  <div class="page">
  <div class="shell">
    <router-link class="btn-voltar" to="/dashboard.html">← Voltar ao painel</router-link>

    <div class="hero">
      <div class="eyebrow">Competência clínica</div>
      <h1>Ranking por perfil de paciente</h1>
      <p class="sub">Veja quais perfis de pacientes têm maior taxa de aprovação entre os alunos. Identifique onde a turma é forte e onde há mais desafio.</p>
    </div>

    <!-- Um grupo de botões que filtra a lista é um conjunto de opções, não
         quatro botões independentes: group + aria-pressed diz qual está
         ativo. Antes, o estado "selecionado" era só a cor do botão. -->
    <div class="curso-selector" role="group" aria-label="Filtrar por curso">
      <button
        v-for="c in CURSOS"
        :key="c"
        type="button"
        class="curso-btn"
        :class="{ ativo: c === cursoAtivo }"
        :aria-pressed="String(c === cursoAtivo)"
        @click="selecionarCurso(c)"
      >{{ c.replace(/_/g, ' ') }}</button>
    </div>

    <div>
      <div v-if="carregando" class="loading" role="status">Carregando ranking...</div>
      <div v-else-if="erro" class="loading" role="alert">Não foi possível carregar o ranking. Verifique sua conexão e tente recarregar a página.</div>
      <div v-else-if="!ranking.length" class="loading" role="status">Ainda não há dados suficientes para este curso.</div>
      <div v-else class="ranking-lista">
        <div class="ranking-item" v-for="(item, idx) in ranking" :key="item.perfil">
          <div class="rank-pos" :class="posClass(idx)"><span class="sr-only">Posição </span>{{ posEmoji(idx) }}</div>
          <div class="rank-info">
            <div class="rank-perfil">{{ item.perfil }}</div>
            <div class="rank-meta">{{ item.total_sessoes }} sessões · {{ item.alunos_unicos }} alunos · média {{ item.media }}/10</div>
            <div class="rank-barra-wrap"><div class="rank-barra" :style="{ width: item.taxa_aprovacao + '%' }"></div></div>
          </div>
          <div class="rank-stats">
            <div class="rank-taxa">{{ item.taxa_aprovacao }}%</div>
            <div class="rank-taxa-label">aprovação</div>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">IBSDH — Instituto Bruno Sena de Desenvolvimento Humano</div>
  </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { callApi } from '../composables/useApi'

const route = useRoute()

const CURSOS = ['Practitioner', 'Master_PNL', 'Hipnoterapia', 'Coach']
const cursoAtivo = ref(route.query.curso || 'Practitioner')
const carregando = ref(true)
const erro = ref(false)
const ranking = ref([])

const POS_CLASS = ['top1', 'top2', 'top3']
const POS_EMOJI = ['🥇', '🥈', '🥉']
function posClass(idx) { return POS_CLASS[idx] || '' }
function posEmoji(idx) { return POS_EMOJI[idx] || String(idx + 1) }

function selecionarCurso(c) {
  cursoAtivo.value = c
  carregarRanking()
}

async function carregarRanking() {
  carregando.value = true
  erro.value = false
  try {
    const data = await callApi({ action: 'ranking_perfis', curso: cursoAtivo.value })
    ranking.value = data.ranking || []
  } catch (e) {
    erro.value = true
  } finally {
    carregando.value = false
  }
}

watch(() => route.query.curso, (novoCurso) => {
  if (novoCurso && novoCurso !== cursoAtivo.value) {
    cursoAtivo.value = novoCurso
    carregarRanking()
  }
})

onMounted(() => {
  document.title = 'SENA | Ranking de Competência'
  carregarRanking()
})
</script>

<style scoped>
* { margin:0;padding:0;box-sizing:border-box; }
/* O fundo fica no wrapper full-width (.page) e a largura máxima no .shell —
   mesma divisão do ranking.html original. Se o fundo ficar no .shell, que é
   limitado a 760px, sobra o branco do body nas laterais da tela. */
.page {
  --text:#f7f4ee;--text-soft:#c2b59a;--text-faint:#a0937a;
  --cyan:#4dd0bc;--gold:#f0ac4a;--success:#86d16c;--danger:#ef8266;
  --panel:#241f16;--border:rgba(200,185,155,0.18);
  --shadow:0 1px 2px rgba(0,0,0,0.3),0 24px 48px rgba(0,0,0,0.35);
  font-family:'Inter',sans-serif;min-height:100vh;background:radial-gradient(ellipse at top left,rgba(77,208,188,0.1),transparent 32%),radial-gradient(ellipse at bottom right,rgba(240,172,74,0.07),transparent 34%),linear-gradient(180deg,#120f0b,#1b160f);color:var(--text);line-height:1.6; }
/* Tema claro — ver body.tema-claro no index.html/useAccessibility.js.
   Sem esta view participar do toggle, quem ligasse o escuro via Dashboard
   via o Ranking continuar sempre claro (achado do feedback pós-lançamento). */
body.tema-claro .page {
  --text:#23201a;--text-soft:#5c5647;--text-faint:#786f5e;
  --cyan:#037d6c;--gold:#a85200;--success:#158035;--danger:#c93712;
  --panel:#ffffff;--border:rgba(35,32,26,0.12);
  --shadow:0 1px 2px rgba(35,32,26,0.06),0 24px 48px rgba(35,32,26,0.14);
  background:radial-gradient(ellipse at top left,rgba(3,125,108,0.14),transparent 32%),radial-gradient(ellipse at bottom right,rgba(168,82,0,0.09),transparent 34%),linear-gradient(180deg,#faf8f4,#f1ece2);
}
.shell { max-width:760px;margin:0 auto;padding:28px 18px 48px; }
.hero { position:relative;overflow:hidden;background:linear-gradient(155deg,color-mix(in srgb, var(--panel) 98%, var(--text) 2%) 0%,var(--panel) 55%,color-mix(in srgb, var(--cyan) 10%, var(--panel)) 100%);border:1px solid var(--border);border-radius:24px;padding:28px;margin-bottom:22px;box-shadow:var(--shadow); }
.hero::before { content:'';position:absolute;top:-60px;right:-60px;width:180px;height:180px;border-radius:999px;background:radial-gradient(circle,color-mix(in srgb, var(--gold) 22%, transparent),transparent 70%); }
.eyebrow { position:relative;display:inline-flex;align-items:center;gap:7px;padding:5px 11px;border-radius:999px;background:color-mix(in srgb, var(--gold) 12%, transparent);border:1px solid color-mix(in srgb, var(--gold) 26%, transparent);color:var(--gold);font-size:10px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;margin-bottom:12px; }
.eyebrow::before { content:'';width:6px;height:6px;border-radius:999px;background:var(--gold);box-shadow:0 0 8px color-mix(in srgb, var(--gold) 55%, transparent); }
h1 { position:relative;font-size:clamp(24px,5vw,36px);font-weight:800;letter-spacing:-.03em;margin-bottom:6px; }
.sub { position:relative;color:var(--text-soft);font-size:14px; }
.curso-selector { display:flex;gap:8px;margin-bottom:22px;flex-wrap:wrap; }
.curso-btn { padding:8px 16px;border-radius:10px;border:1px solid var(--border);background:var(--panel);color:var(--text-soft);font-family:'Inter',sans-serif;font-size:12px;font-weight:700;cursor:pointer;transition:all .18s; }
.curso-btn.ativo { background:color-mix(in srgb, var(--cyan) 14%, transparent);border-color:color-mix(in srgb, var(--cyan) 45%, transparent);color:var(--cyan); }
.loading { text-align:center;padding:48px;color:var(--text-faint);font-size:14px;background:var(--panel);border:1px solid var(--border);border-radius:18px; }
.ranking-lista { display:grid;gap:12px; }
.ranking-item { position:relative;display:flex;align-items:center;gap:16px;padding:18px 20px 18px 24px;border-radius:18px;border:1px solid var(--border);background:var(--panel);box-shadow:var(--shadow);transition:border-color .18s,box-shadow .18s,transform .18s; }
.ranking-item::before { content:'';position:absolute;left:0;top:14px;bottom:14px;width:4px;border-radius:999px;background:linear-gradient(180deg,var(--cyan),var(--success)); }
.ranking-item:hover { border-color:color-mix(in srgb, var(--cyan) 35%, transparent);transform:translateY(-1px); }
.rank-pos { flex-shrink:0;width:36px;height:36px;border-radius:11px;display:grid;place-items:center;font-size:14px;font-weight:800;background:color-mix(in srgb, var(--text) 7%, transparent);color:var(--text-faint); }
.rank-pos.top1 { background:color-mix(in srgb, var(--gold) 18%, transparent);color:var(--gold); }
.rank-pos.top2 { background:color-mix(in srgb, var(--text) 10%, transparent);color:var(--text-soft); }
.rank-pos.top3 { background:rgba(168,103,44,0.2);color:#c98a4e; }
.rank-info { flex:1;min-width:0; }
.rank-perfil { font-size:15px;font-weight:700;margin-bottom:3px; }
.rank-meta { font-size:12px;color:var(--text-faint); }
.rank-stats { text-align:right;flex-shrink:0; }
.rank-taxa { font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:700;color:var(--success); }
.rank-taxa-label { font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.08em; }
.rank-barra-wrap { width:100%;height:4px;border-radius:999px;background:color-mix(in srgb, var(--text) 9%, transparent);margin-top:8px;overflow:hidden; }
.rank-barra { height:100%;border-radius:999px;background:linear-gradient(90deg,var(--success),var(--cyan));transition:width .8s ease; }
.footer { text-align:center;padding:20px 0;color:var(--text-faint);font-size:12px; }
.btn-voltar { display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid var(--border);background:var(--panel);color:var(--text-soft);font-family:'Inter',sans-serif;font-size:12px;font-weight:600;cursor:pointer;text-decoration:none;margin-bottom:16px;transition:all .18s; }
.btn-voltar:hover { background:color-mix(in srgb, var(--cyan) 8%, transparent);border-color:color-mix(in srgb, var(--cyan) 30%, transparent);color:var(--cyan); }

@media (max-width: 768px) {
  .shell { padding: 16px 14px 32px; }
  .hero { padding: 20px 18px; border-radius: 20px; }
  .hero h1 { font-size: 28px; }
  .ranking-item { padding: 14px 16px; gap: 12px; }
  .rank-taxa { font-size: 15px; }
}
@media (max-width: 480px) {
  .curso-selector { gap: 6px; }
  .curso-btn { font-size: 11px; padding: 7px 12px; }
  .rank-pos { width: 30px; height: 30px; font-size: 12px; }
  .rank-perfil { font-size: 14px; }
  .rank-meta { font-size: 11px; }
}
</style>

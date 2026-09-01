<template>
  <div class="shell">
    <router-link class="btn-voltar" to="/dashboard.html">← Voltar ao painel</router-link>

    <div class="hero">
      <div class="eyebrow">Competência clínica</div>
      <h1>Ranking por perfil de paciente</h1>
      <p class="sub">Veja quais perfis de pacientes têm maior taxa de aprovação entre os alunos. Identifique onde a turma é forte e onde há mais desafio.</p>
    </div>

    <div class="curso-selector">
      <button
        v-for="c in CURSOS"
        :key="c"
        class="curso-btn"
        :class="{ ativo: c === cursoAtivo }"
        @click="selecionarCurso(c)"
      >{{ c.replace(/_/g, ' ') }}</button>
    </div>

    <div>
      <div v-if="carregando" class="loading">Carregando...</div>
      <div v-else-if="erro" class="loading">Erro ao carregar.</div>
      <div v-else-if="!ranking.length" class="loading">Ainda não há dados suficientes para este curso.</div>
      <div v-else class="ranking-lista">
        <div class="ranking-item" v-for="(item, idx) in ranking" :key="item.perfil">
          <div class="rank-pos" :class="posClass(idx)">{{ posEmoji(idx) }}</div>
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
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
* { margin:0;padding:0;box-sizing:border-box; }
.shell {
  --text:#edf3f8;--text-soft:#9aa7b5;--text-faint:#5a6470;
  --cyan:#59e1ff;--gold:#d6b36a;--success:#7ef0c2;--danger:#ff6b88;
  --border:rgba(112,141,173,0.15);--shadow:0 20px 48px rgba(0,0,0,0.38);
  font-family:'Inter',sans-serif;min-height:100vh;background:radial-gradient(ellipse at top left,rgba(89,225,255,0.07),transparent 30%),linear-gradient(180deg,#06080c,#090c11);color:var(--text);line-height:1.6;max-width:760px;margin:0 auto;padding:28px 18px 48px; }
.hero { background:linear-gradient(180deg,rgba(16,21,29,0.92),rgba(10,14,20,0.98));border:1px solid var(--border);border-radius:24px;padding:28px;margin-bottom:22px;box-shadow:var(--shadow); }
.eyebrow { display:inline-flex;align-items:center;gap:7px;padding:5px 11px;border-radius:999px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);color:var(--gold);font-size:10px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;margin-bottom:12px; }
.eyebrow::before { content:'';width:6px;height:6px;border-radius:999px;background:var(--gold);box-shadow:0 0 8px rgba(214,179,106,0.55); }
h1 { font-size:clamp(24px,5vw,36px);font-weight:800;letter-spacing:-.03em;margin-bottom:6px; }
.sub { color:var(--text-soft);font-size:14px; }
.curso-selector { display:flex;gap:8px;margin-bottom:22px;flex-wrap:wrap; }
.curso-btn { padding:8px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:var(--text-soft);font-family:'Inter',sans-serif;font-size:12px;font-weight:700;cursor:pointer;transition:all .18s; }
.curso-btn.ativo { background:rgba(89,225,255,0.12);border-color:rgba(89,225,255,0.3);color:var(--cyan); }
.loading { text-align:center;padding:48px;color:var(--text-faint);font-size:14px; }
.ranking-lista { display:grid;gap:12px; }
.ranking-item { display:flex;align-items:center;gap:16px;padding:18px 20px;border-radius:18px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);transition:border-color .18s; }
.ranking-item:hover { border-color:rgba(89,225,255,0.15); }
.rank-pos { flex-shrink:0;width:36px;height:36px;border-radius:11px;display:grid;place-items:center;font-size:14px;font-weight:800;background:rgba(255,255,255,0.05);color:var(--text-faint); }
.rank-pos.top1 { background:rgba(245,193,99,0.15);color:#f5c163; }
.rank-pos.top2 { background:rgba(200,200,200,0.12);color:#d0d0d0; }
.rank-pos.top3 { background:rgba(200,140,80,0.12);color:#cd8c50; }
.rank-info { flex:1;min-width:0; }
.rank-perfil { font-size:15px;font-weight:700;margin-bottom:3px; }
.rank-meta { font-size:12px;color:var(--text-faint); }
.rank-stats { text-align:right;flex-shrink:0; }
.rank-taxa { font-family:'JetBrains Mono',monospace;font-size:18px;font-weight:700;color:var(--success); }
.rank-taxa-label { font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.08em; }
.rank-barra-wrap { width:100%;height:3px;border-radius:999px;background:rgba(255,255,255,0.05);margin-top:8px;overflow:hidden; }
.rank-barra { height:100%;border-radius:999px;background:linear-gradient(90deg,var(--success),var(--cyan));transition:width .8s ease; }
.footer { text-align:center;padding:20px 0;color:var(--text-faint);font-size:12px; }
.btn-voltar { display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:var(--text-soft);font-family:'Inter',sans-serif;font-size:12px;font-weight:600;cursor:pointer;text-decoration:none;margin-bottom:16px;transition:background .18s; }
.btn-voltar:hover { background:rgba(255,255,255,0.06); }

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

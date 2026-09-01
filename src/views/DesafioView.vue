<template>
  <div class="shell">
    <router-link class="btn-voltar" to="/dashboard.html">← Voltar ao painel</router-link>

    <div class="hero">
      <div class="eyebrow">⚡ Desafio da semana</div>
      <h1>Desafio Semanal SENA</h1>
      <p class="sub">Todo domingo um novo perfil de paciente é liberado para todos os alunos. Mostre sua competência clínica e compare com os melhores da turma.</p>
      <div class="timer">{{ textoTimer }}</div>
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
      <template v-else-if="desafio">
        <div class="card">
          <div class="card-title">Perfil do paciente desta semana</div>
          <div class="perfil-nome">{{ desafio.perfil || '—' }}</div>
          <div class="perfil-desc">{{ desafio.descricao || '' }}</div>
          <div class="card-title">Resistências</div>
          <div class="resistencias">
            <div class="resistencia" v-for="(r, i) in desafio.resistencias || []" :key="i">{{ r }}</div>
          </div>
        </div>
        <a :href="urlAceitar" class="btn-aceitar">⚡ Aceitar o desafio desta semana →</a>
      </template>
    </div>

    <div class="footer">IBSDH — Instituto Bruno Sena de Desenvolvimento Humano</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { callApi } from '../composables/useApi'

const route = useRoute()

const CURSOS = ['Practitioner', 'Master_PNL', 'Hipnoterapia', 'Coach']
const cursoAtivo = ref((route.query.curso) || 'Practitioner')

const carregando = ref(true)
const erro = ref(false)
const desafio = ref(null)
const textoTimer = ref('Calculando tempo restante...')

let intervalId = null

function atualizarTimer() {
  const agora = new Date()
  const proximo = new Date(agora)
  proximo.setDate(agora.getDate() + ((7 - agora.getDay()) % 7 || 7))
  proximo.setHours(0, 0, 0, 0)
  const diff = proximo - agora
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  textoTimer.value = 'Encerra em ' + Math.floor(h / 24) + 'd ' + (h % 24) + 'h ' + m + 'm'
}

function selecionarCurso(c) {
  cursoAtivo.value = c
  carregarDesafio()
}

async function carregarDesafio() {
  carregando.value = true
  erro.value = false
  try {
    const data = await callApi({ action: 'desafio_semanal', curso: cursoAtivo.value })
    desafio.value = data
  } catch (e) {
    erro.value = true
  } finally {
    carregando.value = false
  }
}

const urlAceitar = computed(() => {
  if (!desafio.value) return '#'
  const email = localStorage.getItem('sena_email') || ''
  return '/index.html?email=' + encodeURIComponent(email) +
    '&curso=' + encodeURIComponent(desafio.value.curso) +
    '&aula=Aula_1&desafio=semanal'
})

onMounted(() => {
  document.title = 'SENA | Desafio Semanal'
  atualizarTimer()
  intervalId = setInterval(atualizarTimer, 60000)
  carregarDesafio()
})

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
* { margin:0;padding:0;box-sizing:border-box; }
:root { --text:#edf3f8;--text-soft:#9aa7b5;--text-faint:#5a6470;--cyan:#59e1ff;--gold:#d6b36a;--success:#7ef0c2;--danger:#ff6b88;--border:rgba(112,141,173,0.15);--shadow:0 20px 48px rgba(0,0,0,0.38); }
.shell { font-family:'Inter',sans-serif;min-height:100vh;background:radial-gradient(ellipse at top left,rgba(245,193,99,0.08),transparent 30%),linear-gradient(180deg,#06080c,#090c11);color:var(--text);line-height:1.6;max-width:680px;margin:0 auto;padding:28px 18px 48px; }
.btn-voltar { display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:var(--text-soft);font-family:'Inter',sans-serif;font-size:12px;font-weight:600;cursor:pointer;text-decoration:none;margin-bottom:16px;transition:background .18s; }
.btn-voltar:hover { background:rgba(255,255,255,0.06); }
.hero { background:linear-gradient(135deg,rgba(245,193,99,0.08),rgba(255,107,136,0.04)),linear-gradient(180deg,rgba(16,21,29,0.96),rgba(10,14,20,0.99));border:1px solid rgba(245,193,99,0.2);border-radius:24px;padding:28px;margin-bottom:18px;box-shadow:var(--shadow); }
.eyebrow { display:inline-flex;align-items:center;gap:7px;padding:5px 11px;border-radius:999px;background:rgba(245,193,99,0.1);border:1px solid rgba(245,193,99,0.2);color:#f5c163;font-size:10px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;margin-bottom:12px; }
.eyebrow::before { content:'⚡';font-size:9px; }
h1 { font-size:clamp(24px,5vw,36px);font-weight:800;letter-spacing:-.03em;margin-bottom:6px; }
.sub { color:var(--text-soft);font-size:14px; }
.timer { font-family:'JetBrains Mono',monospace;font-size:13px;color:#f5c163;margin-top:10px; }
.card { background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:18px;padding:20px;margin-bottom:14px; }
.card-title { font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);margin-bottom:12px; }
.perfil-nome { font-size:22px;font-weight:800;letter-spacing:-.02em;margin-bottom:8px; }
.perfil-desc { font-size:14px;color:var(--text-soft);line-height:1.7;margin-bottom:14px; }
.resistencias { display:grid;gap:6px; }
.resistencia { font-size:13px;color:var(--danger);padding-left:16px;position:relative; }
.resistencia::before { content:'⚡';position:absolute;left:0;font-size:10px; }
.curso-selector { display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap; }
.curso-btn { padding:8px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:var(--text-soft);font-family:'Inter',sans-serif;font-size:12px;font-weight:700;cursor:pointer;transition:all .18s; }
.curso-btn.ativo { background:rgba(245,193,99,0.1);border-color:rgba(245,193,99,0.25);color:#f5c163; }
.btn-aceitar { display:block;width:100%;padding:16px;border-radius:14px;border:none;background:linear-gradient(135deg,#f5c163,#d6b36a);color:#1a1000;font-family:'Inter',sans-serif;font-size:13px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;transition:transform .18s,box-shadow .18s;margin-top:8px;text-align:center;text-decoration:none; }
.btn-aceitar:hover { transform:translateY(-1px);box-shadow:0 12px 24px rgba(245,193,99,0.25); }
.loading { text-align:center;padding:48px;color:var(--text-faint);font-size:14px; }
.footer { text-align:center;padding:20px 0;color:var(--text-faint);font-size:12px; }

@media (max-width: 768px) {
  .shell { padding: 16px 14px 32px; }
  .hero { padding: 20px 18px; border-radius: 20px; }
  .hero h1 { font-size: 28px; }
  .card { padding: 16px; }
}
@media (max-width: 480px) {
  .curso-selector { gap: 6px; }
  .curso-btn { font-size: 11px; padding: 7px 12px; }
  .btn-aceitar { padding: 14px; font-size: 12px; }
}
</style>

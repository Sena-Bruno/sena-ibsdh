<template>
  <div class="page">
  <div class="shell">
    <router-link class="btn-voltar" to="/dashboard.html">← Voltar ao painel</router-link>

    <div class="hero">
      <div class="eyebrow">Desafio da semana</div>
      <h1>Desafio Semanal SENA</h1>
      <p class="sub">Todo domingo um novo perfil de paciente é liberado para todos os alunos. Mostre sua competência clínica e compare com os melhores da turma.</p>
      <!-- O prazo muda a cada minuto: "polite" avisa sem interromper. -->
      <div class="timer" role="timer" aria-live="polite">{{ textoTimer }}</div>
    </div>

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
      <div v-if="carregando" class="loading" role="status">Carregando o desafio da semana...</div>
      <div v-else-if="erro" class="loading" role="alert">Não foi possível carregar o desafio. Verifique sua conexão e tente recarregar a página.</div>
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
        <a :href="urlAceitar" class="btn-aceitar">Aceitar o desafio desta semana →</a>
      </template>
    </div>

    <div class="footer">IBSDH — Instituto Bruno Sena de Desenvolvimento Humano</div>
  </div>
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
* { margin:0;padding:0;box-sizing:border-box; }
/* O fundo fica no wrapper full-width (.page) e a largura máxima no .shell —
   mesma divisão do desafio.html original. Se o fundo ficar no .shell, que é
   limitado a 680px, sobra o branco do body nas laterais da tela. */
.page {
  --text:#f7f4ee;--text-soft:#c2b59a;--text-faint:#a0937a;
  --cyan:#4dd0bc;--gold:#f0ac4a;--success:#86d16c;--danger:#ef8266;
  --panel:#241f16;--border:rgba(200,185,155,0.18);
  --shadow:0 1px 2px rgba(0,0,0,0.3),0 24px 48px rgba(0,0,0,0.35);
  font-family:'Inter',sans-serif;min-height:100vh;background:radial-gradient(ellipse at top left,rgba(240,172,74,0.1),transparent 32%),radial-gradient(ellipse at bottom right,rgba(239,130,102,0.07),transparent 34%),linear-gradient(180deg,#120f0b,#1b160f);color:var(--text);line-height:1.6;
}
/* Tema claro — ver body.tema-claro no index.html/useAccessibility.js. */
body.tema-claro .page {
  --text:#23201a;--text-soft:#5c5647;--text-faint:#786f5e;
  --cyan:#037d6c;--gold:#a85200;--success:#158035;--danger:#c93712;
  --panel:#ffffff;--border:rgba(35,32,26,0.12);
  --shadow:0 1px 2px rgba(35,32,26,0.06),0 24px 48px rgba(35,32,26,0.14);
  background:radial-gradient(ellipse at top left,rgba(168,82,0,0.14),transparent 32%),radial-gradient(ellipse at bottom right,rgba(201,55,18,0.08),transparent 34%),linear-gradient(180deg,#faf8f4,#f1ece2);
}
.shell { max-width:680px;margin:0 auto;padding:28px 18px 48px; }
.btn-voltar { display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid var(--border);background:var(--panel);color:var(--text-soft);font-family:'Inter',sans-serif;font-size:12px;font-weight:600;cursor:pointer;text-decoration:none;margin-bottom:16px;transition:all .18s; }
.btn-voltar:hover { background:color-mix(in srgb, var(--gold) 6%, transparent);border-color:color-mix(in srgb, var(--gold) 30%, transparent);color:var(--gold); }
.hero { position:relative;overflow:hidden;background:linear-gradient(135deg,color-mix(in srgb, var(--gold) 10%, transparent),color-mix(in srgb, var(--danger) 5%, transparent)),linear-gradient(180deg,color-mix(in srgb, var(--panel) 98%, var(--text) 2%),var(--panel));border:1px solid color-mix(in srgb, var(--gold) 22%, transparent);border-radius:24px;padding:28px;margin-bottom:18px;box-shadow:var(--shadow); }
.hero::before { content:'';position:absolute;top:-60px;right:-60px;width:180px;height:180px;border-radius:999px;background:radial-gradient(circle,color-mix(in srgb, var(--gold) 18%, transparent),transparent 70%); }
.eyebrow { position:relative;display:inline-flex;align-items:center;gap:7px;padding:5px 11px;border-radius:999px;background:color-mix(in srgb, var(--gold) 12%, transparent);border:1px solid color-mix(in srgb, var(--gold) 25%, transparent);color:var(--gold);font-size:10px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;margin-bottom:12px; }
.eyebrow::before { content:'';width:6px;height:6px;border-radius:999px;background:var(--gold);box-shadow:0 0 8px color-mix(in srgb, var(--gold) 55%, transparent); }
h1 { position:relative;font-size:clamp(24px,5vw,36px);font-weight:800;letter-spacing:-.03em;margin-bottom:6px; }
.sub { position:relative;color:var(--text-soft);font-size:14px; }
.timer { position:relative;font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--gold);margin-top:10px; }
.card { position:relative;background:var(--panel);border:1px solid color-mix(in srgb, var(--text) 10%, transparent);border-radius:18px;padding:20px 20px 20px 24px;margin-bottom:14px;box-shadow:0 1px 2px color-mix(in srgb, var(--text) 4%, transparent),0 8px 20px color-mix(in srgb, var(--text) 5%, transparent); }
.card::before { content:'';position:absolute;left:0;top:14px;bottom:14px;width:4px;border-radius:999px;background:linear-gradient(180deg,var(--gold),var(--danger)); }
.card-title { font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);margin-bottom:12px; }
.perfil-nome { font-size:22px;font-weight:800;letter-spacing:-.02em;margin-bottom:8px; }
.perfil-desc { font-size:14px;color:var(--text-soft);line-height:1.7;margin-bottom:14px; }
.resistencias { display:grid;gap:6px; }
.resistencia { font-size:13px;color:var(--danger);padding-left:16px;position:relative; }
.resistencia::before { content:'';position:absolute;left:0;top:6px;width:5px;height:5px;border-radius:999px;background:currentColor; }
.curso-selector { display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap; }
.curso-btn { padding:8px 16px;border-radius:10px;border:1px solid var(--border);background:var(--panel);color:var(--text-soft);font-family:'Inter',sans-serif;font-size:12px;font-weight:700;cursor:pointer;transition:all .18s; }
.curso-btn.ativo { background:color-mix(in srgb, var(--gold) 12%, transparent);border-color:color-mix(in srgb, var(--gold) 40%, transparent);color:var(--gold); }
.btn-aceitar { display:block;width:100%;padding:16px;border-radius:14px;border:none;background:var(--gold);color:#ffffff;font-family:'Inter',sans-serif;font-size:13px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;transition:transform .18s,box-shadow .18s;margin-top:8px;text-align:center;text-decoration:none; }
.btn-aceitar:hover { transform:translateY(-1px);box-shadow:0 12px 24px color-mix(in srgb, var(--gold) 25%, transparent); }
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

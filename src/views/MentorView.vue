<template>
  <div class="page">
    <div class="email-modal-overlay" :class="{ visible: mostrarModalEmail }">
      <div class="email-modal">
        <h2>Identificação do Mentor</h2>
        <p>Informe seu e-mail para acessar o modo mentor.</p>
        <input
          ref="emailInputRef"
          class="email-input"
          type="email"
          v-model="emailInput"
          placeholder="seu@email.com"
          @keydown.enter="confirmarEmail"
        />
        <div class="email-error">{{ erroEmail }}</div>
        <button class="email-btn" @click="confirmarEmail">Entrar como mentor</button>
      </div>
    </div>

    <div class="shell">
      <router-link class="btn-voltar" to="/dashboard.html">← Voltar ao painel</router-link>
      <div class="hero">
        <div class="eyebrow">Comunidade de prática</div>
        <h1>Modo Mentor</h1>
        <p class="sub">Você já aprovou aulas neste curso. Agora pode ajudar outros alunos deixando feedback anônimo sobre respostas aprovadas. A IA modera todos os comentários.</p>
      </div>
      <div class="aviso">⚠️ Os feedbacks são anônimos e moderados pela IA antes de serem exibidos. Seja construtivo e clínico — feedbacks inadequados são removidos automaticamente.</div>

      <div v-if="carregando" class="loading">Carregando...</div>
      <div v-else-if="erro" class="loading">Erro ao carregar.</div>
      <div v-else-if="!itens.length" class="vazio">Não há respostas disponíveis para review neste momento.<br>Volte depois ou aprove mais aulas para desbloquear mais itens.</div>
      <div v-else class="mentor-lista">
        <div class="mentor-card" v-for="item in itens" :key="item.id_avaliacao">
          <div class="mentor-card-header">
            <span class="mentor-card-meta">Aluno anônimo · {{ item.aula }}</span>
            <span class="mentor-card-nota">{{ Number(item.nota).toFixed(1) }}/10 ✓</span>
          </div>
          <div class="mentor-card-body">
            <div class="mentor-label">Trecho da resposta aprovada</div>
            <div class="mentor-trecho">"{{ trechoLimitado(item.trecho) }}</div>
            <template v-if="item.fortes">
              <div class="mentor-label">Pontos fortes (avaliação IA)</div>
              <div class="mentor-fortes">{{ item.fortes }}</div>
            </template>
            <div class="mentor-label">Seu feedback como mentor</div>
            <textarea
              class="mentor-textarea"
              v-model="feedbacks[item.id_avaliacao]"
              :disabled="enviados[item.id_avaliacao]"
              placeholder="Deixe um comentário construtivo sobre a condução clínica desta resposta. O que o aluno fez bem? O que poderia aprofundar?"
            ></textarea>
            <div class="mentor-actions">
              <span class="mentor-status" :class="statusClasse[item.id_avaliacao]">{{ statusTexto[item.id_avaliacao] || '' }}</span>
              <button
                v-if="!enviados[item.id_avaliacao]"
                class="mentor-btn-enviar"
                :disabled="enviando[item.id_avaliacao]"
                @click="enviarFeedback(item.id_avaliacao)"
              >{{ enviando[item.id_avaliacao] ? 'Enviando...' : 'Enviar feedback' }}</button>
            </div>
          </div>
        </div>
      </div>

      <div class="footer">IBSDH — Instituto Bruno Sena de Desenvolvimento Humano</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { callApi } from '../composables/useApi'

const route = useRoute()

const email = ref('')
const emailInput = ref('')
const erroEmail = ref('')
const mostrarModalEmail = ref(false)
const emailInputRef = ref(null)

const carregando = ref(true)
const erro = ref(false)
const itens = ref([])

const feedbacks = reactive({})
const enviando = reactive({})
const enviados = reactive({})
const statusTexto = reactive({})
const statusClasse = reactive({})

function trechoLimitado(trecho) {
  const t = trecho || ''
  return t.substring(0, 500) + (t.length >= 500 ? '...' : '"')
}

async function confirmarEmail() {
  const val = (emailInput.value || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    erroEmail.value = 'E-mail inválido.'
    return
  }
  email.value = val
  localStorage.setItem('sena_email', val)
  mostrarModalEmail.value = false
  carregarItens()
}

async function carregarItens() {
  carregando.value = true
  erro.value = false
  try {
    const curso = route.query.curso || 'Practitioner'
    const aula = route.query.aula || ''
    const data = await callApi({ action: 'buscar_mentor', email: email.value, curso, aula })
    itens.value = data.itens || []
  } catch (e) {
    erro.value = true
  } finally {
    carregando.value = false
  }
}

async function enviarFeedback(idAvaliacao) {
  const feedback = (feedbacks[idAvaliacao] || '').trim()
  if (feedback.length < 20) {
    statusTexto[idAvaliacao] = 'Mínimo 20 caracteres.'
    statusClasse[idAvaliacao] = 'erro'
    return
  }
  enviando[idAvaliacao] = true
  statusTexto[idAvaliacao] = ''
  statusClasse[idAvaliacao] = ''
  try {
    const data = await callApi({ action: 'submeter_mentor', email: email.value, id_avaliacao: idAvaliacao, feedback })
    if (data.sucesso) {
      statusTexto[idAvaliacao] = '✓ Feedback enviado. Obrigado!'
      statusClasse[idAvaliacao] = 'ok'
      enviados[idAvaliacao] = true
    } else {
      throw new Error(data.mensagem || 'Erro')
    }
  } catch (e) {
    statusTexto[idAvaliacao] = 'Erro ao enviar. Tente novamente.'
    statusClasse[idAvaliacao] = 'erro'
  } finally {
    enviando[idAvaliacao] = false
  }
}

onMounted(async () => {
  document.title = 'SENA | Modo Mentor'
  const salvo = localStorage.getItem('sena_email')
  if (salvo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(salvo)) {
    email.value = salvo
    carregarItens()
  } else {
    mostrarModalEmail.value = true
    await nextTick()
    emailInputRef.value && emailInputRef.value.focus()
  }
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
* { margin:0;padding:0;box-sizing:border-box; }
:root { --text:#edf3f8;--text-soft:#9aa7b5;--text-faint:#5a6470;--cyan:#59e1ff;--gold:#d6b36a;--success:#7ef0c2;--danger:#ff6b88;--border:rgba(112,141,173,0.15);--shadow:0 20px 48px rgba(0,0,0,0.38); }
.page { font-family:'Inter',sans-serif; }
.shell { min-height:100vh;background:radial-gradient(ellipse at bottom right,rgba(126,240,194,0.06),transparent 30%),linear-gradient(180deg,#06080c,#090c11);color:var(--text);line-height:1.6;max-width:720px;margin:0 auto;padding:28px 18px 48px; }
.btn-voltar { display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:var(--text-soft);font-family:'Inter',sans-serif;font-size:12px;font-weight:600;cursor:pointer;text-decoration:none;margin-bottom:16px;transition:background .18s; }
.btn-voltar:hover { background:rgba(255,255,255,0.06); }
.hero { background:linear-gradient(180deg,rgba(16,21,29,0.92),rgba(10,14,20,0.98));border:1px solid var(--border);border-radius:24px;padding:28px;margin-bottom:22px;box-shadow:var(--shadow); }
.eyebrow { display:inline-flex;align-items:center;gap:7px;padding:5px 11px;border-radius:999px;background:rgba(126,240,194,0.08);border:1px solid rgba(126,240,194,0.15);color:var(--success);font-size:10px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;margin-bottom:12px; }
h1 { font-size:clamp(24px,5vw,36px);font-weight:800;letter-spacing:-.03em;margin-bottom:6px; }
.sub { color:var(--text-soft);font-size:14px; }
.aviso { padding:14px;border-radius:12px;border:1px solid rgba(245,193,99,0.2);background:rgba(245,193,99,0.06);color:#f5c163;font-size:13px;margin-bottom:18px; }
.loading { text-align:center;padding:48px;color:var(--text-faint);font-size:14px; }
.mentor-lista { display:grid;gap:16px; }
.mentor-card { background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:18px;overflow:hidden; }
.mentor-card-header { padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:space-between; }
.mentor-card-meta { font-size:12px;color:var(--text-faint); }
.mentor-card-nota { font-family:'JetBrains Mono',monospace;font-size:13px;padding:3px 8px;border-radius:6px;background:rgba(126,240,194,0.1);color:var(--success); }
.mentor-card-body { padding:16px; }
.mentor-label { font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-faint);margin-bottom:6px;margin-top:12px; }
.mentor-label:first-child { margin-top:0; }
.mentor-trecho { font-size:13px;color:var(--text-soft);line-height:1.7;font-style:italic; }
.mentor-fortes { font-size:13px;color:var(--text-soft);line-height:1.65; }
.mentor-textarea { width:100%;min-height:100px;resize:vertical;border:1px solid rgba(255,255,255,0.08);border-radius:12px;background:rgba(5,9,13,0.6);color:var(--text);padding:12px 14px;font-family:'Inter',sans-serif;font-size:13px;line-height:1.65;outline:none;margin-top:10px;transition:border-color .18s; }
.mentor-textarea:focus { border-color:rgba(126,240,194,0.3); }
.mentor-textarea::placeholder { color:#4a5568; }
.mentor-actions { display:flex;align-items:center;justify-content:space-between;margin-top:8px; }
.mentor-status { font-size:12px;color:var(--text-faint);min-height:16px; }
.mentor-status.ok { color:var(--success); }
.mentor-status.erro { color:var(--danger); }
.mentor-btn-enviar { padding:9px 18px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--success),#a8f5d8);color:#061018;font-family:'Inter',sans-serif;font-size:12px;font-weight:800;cursor:pointer;transition:transform .15s; }
.mentor-btn-enviar:hover { transform:translateY(-1px); }
.mentor-btn-enviar:disabled { opacity:.5;cursor:not-allowed;transform:none; }
.vazio { padding:32px;text-align:center;color:var(--text-faint);font-size:14px;border:1px solid rgba(255,255,255,0.05);border-radius:16px; }
.footer { text-align:center;padding:20px 0;color:var(--text-faint);font-size:12px; }
.email-modal-overlay { display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:9999;place-items:center;padding:24px; }
.email-modal-overlay.visible { display:grid; }
.email-modal { width:100%;max-width:420px;background:linear-gradient(180deg,rgba(16,21,29,0.99),rgba(10,14,20,1));border:1px solid var(--border);border-radius:22px;padding:32px 28px;text-align:center; }
.email-modal h2 { font-size:18px;font-weight:800;margin-bottom:8px; }
.email-modal p { color:var(--text-soft);font-size:13px;margin-bottom:18px; }
.email-input { width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.09);background:rgba(5,9,13,0.6);color:var(--text);font-family:'Inter',sans-serif;font-size:14px;outline:none;text-align:center;margin-bottom:10px; }
.email-error { color:var(--danger);font-size:12px;min-height:16px;margin-bottom:8px; }
.email-btn { width:100%;padding:13px;border-radius:11px;border:none;background:linear-gradient(135deg,var(--cyan),#9be9ff);color:#061018;font-family:'Inter',sans-serif;font-size:13px;font-weight:800;cursor:pointer; }

@media (max-width: 768px) {
  .shell { padding: 16px 14px 32px; }
  .hero { padding: 20px 18px; border-radius: 20px; }
  .hero h1 { font-size: 28px; }
  .mentor-card-body { padding: 14px; }
  .mentor-actions { flex-direction: column; gap: 6px; }
  .mentor-btn-enviar { width: 100%; padding: 10px; text-align: center; }
}
@media (max-width: 480px) {
  .aviso { font-size: 12px; padding: 12px; }
  .mentor-trecho { font-size: 12px; }
}
</style>

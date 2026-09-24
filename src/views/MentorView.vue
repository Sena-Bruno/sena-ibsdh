<template>
  <div class="page">
    <LoginModal v-if="!logado" @success="aoLogar" />

    <div class="shell" v-else>
      <router-link class="btn-voltar" to="/dashboard.html">← Voltar ao painel</router-link>
      <div class="hero">
        <div class="eyebrow">Comunidade de prática</div>
        <h1>Modo Mentor</h1>
        <p class="sub">Você já aprovou aulas neste curso. Agora pode ajudar outros alunos deixando feedback anônimo sobre respostas aprovadas. A IA modera todos os comentários.</p>
      </div>
      <div class="aviso" role="note">Os feedbacks são anônimos e moderados pela IA antes de serem exibidos. Seja construtivo e clínico — feedbacks inadequados são removidos automaticamente.</div>

      <div v-if="carregando" class="loading" role="status">Carregando feedbacks disponíveis...</div>
      <div v-else-if="erro" class="loading" role="alert">Não foi possível carregar os itens para review. Verifique sua conexão e tente recarregar a página.</div>
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
            <label class="sr-only" :for="'fb-' + item.id_avaliacao">
              Seu feedback como mentor sobre a resposta da aula {{ item.aula }}
            </label>
            <textarea
              :id="'fb-' + item.id_avaliacao"
              class="mentor-textarea"
              v-model="feedbacks[item.id_avaliacao]"
              :disabled="enviados[item.id_avaliacao]"
              placeholder="Deixe um comentário construtivo sobre a condução clínica desta resposta. O que o aluno fez bem? O que poderia aprofundar?"
            ></textarea>
            <div class="mentor-actions">
              <span class="mentor-status" :class="statusClasse[item.id_avaliacao]" role="status">{{ statusTexto[item.id_avaliacao] || '' }}</span>
              <button
                v-if="!enviados[item.id_avaliacao]"
                type="button"
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
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { callApi } from '../composables/useApi'
import { estaAutenticado, getToken, limparSessao, pareceErroDeSessao } from '../composables/useAuth'
import LoginModal from '../components/LoginModal.vue'

const route = useRoute()

const logado = ref(false)

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

function aoLogar() {
  logado.value = true
  carregarItens()
}

async function carregarItens() {
  carregando.value = true
  erro.value = false
  try {
    const curso = route.query.curso || 'Practitioner'
    const aula = route.query.aula || ''
    const data = await callApi({ action: 'buscar_mentor', token: getToken(), curso, aula })
    if (data && data.erro && pareceErroDeSessao(data.mensagem)) {
      limparSessao()
      logado.value = false
      return
    }
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
    const data = await callApi({ action: 'submeter_mentor', token: getToken(), id_avaliacao: idAvaliacao, feedback })
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

onMounted(() => {
  document.title = 'SENA | Modo Mentor'
  if (estaAutenticado()) {
    logado.value = true
    carregarItens()
  }
})
</script>

<style scoped>
* { margin:0;padding:0;box-sizing:border-box; }
/* O fundo fica no wrapper full-width (.page) e a largura máxima no .shell —
   mesma divisão do mentor.html original. Se o fundo ficar no .shell, que é
   limitado a 720px, sobra o branco do body nas laterais da tela. */
.page { --text:#23201a;--text-soft:#5c5647;--text-faint:#786f5e;--cyan:#0a7566;--gold:#9c5700;--success:#1c7a33;--danger:#c93f24;--border:rgba(35,32,26,0.12);--shadow:0 1px 2px rgba(35,32,26,0.06),0 24px 48px rgba(35,32,26,0.14);
  font-family:'Inter',sans-serif;min-height:100vh;background:radial-gradient(ellipse at bottom right,rgba(28,122,51,0.14),transparent 32%),radial-gradient(ellipse at top left,rgba(10,117,102,0.08),transparent 34%),linear-gradient(180deg,#faf8f4,#f1ece2);color:var(--text);line-height:1.6; }
.shell { max-width:720px;margin:0 auto;padding:28px 18px 48px; }
.btn-voltar { display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;border:1px solid rgba(35,32,26,0.12);background:#ffffff;color:var(--text-soft);font-family:'Inter',sans-serif;font-size:12px;font-weight:600;cursor:pointer;text-decoration:none;margin-bottom:16px;transition:all .18s; }
.btn-voltar:hover { background:rgba(28,122,51,0.06);border-color:rgba(28,122,51,0.3);color:var(--success); }
.hero { position:relative;overflow:hidden;background:linear-gradient(155deg,rgba(255,255,255,0.98) 0%,rgba(255,255,255,0.9) 55%,rgba(28,122,51,0.1) 100%);border:1px solid rgba(35,32,26,0.14);border-radius:24px;padding:28px;margin-bottom:22px;box-shadow:var(--shadow); }
.hero::before { content:'';position:absolute;top:-60px;right:-60px;width:180px;height:180px;border-radius:999px;background:radial-gradient(circle,rgba(28,122,51,0.16),transparent 70%); }
.eyebrow { position:relative;display:inline-flex;align-items:center;gap:7px;padding:5px 11px;border-radius:999px;background:rgba(28,122,51,0.1);border:1px solid rgba(28,122,51,0.25);color:var(--success);font-size:10px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;margin-bottom:12px; }
h1 { position:relative;font-size:clamp(24px,5vw,36px);font-weight:800;letter-spacing:-.03em;margin-bottom:6px; }
.sub { position:relative;color:var(--text-soft);font-size:14px; }
.aviso { padding:14px;border-radius:12px;border:1px solid rgba(156,87,0,0.22);background:rgba(156,87,0,0.07);color:#9c5700;font-size:13px;margin-bottom:18px; }
.loading { text-align:center;padding:48px;color:var(--text-faint);font-size:14px; }
.mentor-lista { display:grid;gap:16px; }
.mentor-card { position:relative;background:#ffffff;border:1px solid rgba(35,32,26,0.1);border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(35,32,26,0.04),0 8px 20px rgba(35,32,26,0.05); }
.mentor-card::before { content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(180deg,var(--success),var(--cyan)); }
.mentor-card-header { padding:14px 16px 14px 22px;border-bottom:1px solid rgba(35,32,26,0.07);display:flex;align-items:center;justify-content:space-between; }
.mentor-card-meta { font-size:12px;color:var(--text-faint); }
.mentor-card-nota { font-family:'JetBrains Mono',monospace;font-size:13px;padding:3px 8px;border-radius:6px;background:rgba(28,122,51,0.12);color:var(--success); }
.mentor-card-body { padding:16px 16px 16px 22px; }
.mentor-label { font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-faint);margin-bottom:6px;margin-top:12px; }
.mentor-label:first-child { margin-top:0; }
.mentor-trecho { font-size:13px;color:var(--text-soft);line-height:1.7;font-style:italic; }
.mentor-fortes { font-size:13px;color:var(--text-soft);line-height:1.65; }
.mentor-textarea { width:100%;min-height:100px;resize:vertical;border:1px solid rgba(35,32,26,0.12);border-radius:12px;background:#ffffff;color:var(--text);padding:12px 14px;font-family:'Inter',sans-serif;font-size:13px;line-height:1.65;outline:none;margin-top:10px;transition:border-color .18s; }
.mentor-textarea:focus { border-color:rgba(28,122,51,0.3); }
.mentor-textarea::placeholder { color:#8a8171; } /* era #4a5568 — 2.62:1, reprovava 1.4.3 */
.mentor-actions { display:flex;align-items:center;justify-content:space-between;margin-top:8px; }
.mentor-status { font-size:12px;color:var(--text-faint);min-height:16px; }
.mentor-status.ok { color:var(--success); }
.mentor-status.erro { color:var(--danger); }
.mentor-btn-enviar { padding:9px 18px;border-radius:10px;border:none;background:var(--success);color:#ffffff;font-family:'Inter',sans-serif;font-size:12px;font-weight:800;cursor:pointer;transition:transform .15s; }
.mentor-btn-enviar:hover { transform:translateY(-1px); }
.mentor-btn-enviar:disabled { opacity:.5;cursor:not-allowed;transform:none; }
.vazio { padding:32px;text-align:center;color:var(--text-faint);font-size:14px;border:1px solid rgba(35,32,26,0.05);border-radius:16px; }
.footer { text-align:center;padding:20px 0;color:var(--text-faint);font-size:12px; }

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

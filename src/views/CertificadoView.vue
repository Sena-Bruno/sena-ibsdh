<template>
  <div class="wrap">
    <LoginModal v-if="!logado" @success="aoLogar" />

    <div class="card" v-else>
      <div class="header">
        <div class="eyebrow">Certificação SENA</div>
        <h1>Certificado de Proficiência Clínica</h1>
        <div class="sub">
          Consulte seu status de certificação complementar do IBSDH. Se você já for elegível, poderá emitir seu certificado nesta página.
        </div>
      </div>

      <div class="body">
        <div class="alert error" :class="{ visible: alertaErro }" role="alert">{{ alertaErro }}</div>
        <div class="alert success" :class="{ visible: alertaSucesso }" role="status">{{ alertaSucesso }}</div>

        <!-- O e-mail não é mais digitável aqui: ele vem da sessão autenticada
             (token do login por código), nunca de um campo que o próprio
             cliente preenche — era assim que qualquer pessoa podia consultar
             ou emitir certificado em nome de outro aluno (achado F2). -->
        <div class="field">
          <label>Conta</label>
          <div class="value-static">{{ emailLogado }} <button type="button" class="btn-trocar" @click="trocarConta">trocar</button></div>
        </div>

        <div class="field">
          <label for="cursoInput">Curso</label>
          <input id="cursoInput" type="text" placeholder="Practitioner" v-model="form.curso">
        </div>

        <div class="field">
          <label for="nomeInput">Nome completo</label>
          <input id="nomeInput" type="text" autocomplete="name" placeholder="Seu nome completo" v-model="form.nome">
        </div>

        <div class="btn-row">
          <button type="button" class="btn" :disabled="consultando" @click="consultarStatus">{{ consultando ? 'Consultando...' : 'Consultar status' }}</button>
          <button v-if="status && status.status === 'elegivel'" type="button" class="btn-success" :disabled="emitindo" @click="emitirCertificado">{{ emitindo ? 'Emitindo...' : 'Emitir certificado' }}</button>
          <button v-if="status && status.status === 'emitido'" type="button" class="btn-secondary" :disabled="reenviando" @click="reenviarCertificado">{{ reenviando ? 'Reenviando...' : 'Reenviar por e-mail' }}</button>
          <!-- target="_blank" sem aviso surpreende quem usa leitor de tela
               e quebra o botão "voltar" no celular (3.2.5). O sufixo no nome
               acessível avisa; rel evita o vazamento de window.opener. -->
          <a v-if="status && status.status === 'emitido'" :href="status.link_pdf || '#'"
             target="_blank" rel="noopener noreferrer" class="btn-success">Abrir PDF<span class="sr-only"> (abre em nova aba)</span></a>
        </div>

        <div class="status-box" :class="{ visible: status }" v-if="status">
          <div class="item">
            <div class="label2">Status</div>
            <div class="value">{{ statusTexto }}</div>
          </div>
          <div class="item">
            <div class="label2">Aluno</div>
            <div class="value">{{ status.nome_aluno || form.nome || '-' }}</div>
          </div>
          <div class="item">
            <div class="label2">Curso</div>
            <div class="value">{{ status.curso || form.curso || '-' }}</div>
          </div>
          <div class="item">
            <div class="label2">Média no SENA</div>
            <div class="value">{{ status.media === undefined || status.media === null || status.media === '' ? '-' : status.media }}</div>
          </div>
          <div class="item">
            <div class="label2">Aulas aprovadas</div>
            <div class="value">{{ status.aulasAprovadas || 0 }}/{{ status.totalAulas || 0 }}</div>
          </div>
          <div class="item">
            <div class="label2">Certificação</div>
            <div class="value">{{ status.nome_certificado || 'Certificado de Proficiência Clínica — IBSDH' }}</div>
          </div>
          <div class="item">
            <div class="label2">Código</div>
            <div class="value">{{ status.codigo_certificado || '-' }}</div>
          </div>
          <div class="item">
            <div class="label2">Data de emissão</div>
            <div class="value">{{ status.data_emissao || '-' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { callApi } from '../composables/useApi'
import { estaAutenticado, getToken, getEmailExibicao, limparSessao, pareceErroDeSessao } from '../composables/useAuth'
import LoginModal from '../components/LoginModal.vue'

const logado = ref(false)
const emailLogado = ref('')
const form = ref({ curso: '', nome: '' })
const status = ref(null)
const alertaErro = ref('')
const alertaSucesso = ref('')
const consultando = ref(false)
const emitindo = ref(false)
const reenviando = ref(false)

function aoLogar({ email }) {
  logado.value = true
  emailLogado.value = email
}

function trocarConta() {
  limparSessao()
  logado.value = false
  status.value = null
}

// Chame depois de qualquer resposta de erro do backend: se o token expirou
// ou é inválido, força novo login em vez de deixar o aluno preso num estado
// de "erro ao consultar" sem entender por quê.
function tratarPossivelSessaoExpirada(mensagem) {
  if (pareceErroDeSessao(mensagem)) {
    limparSessao()
    logado.value = false
    return true
  }
  return false
}

const statusTexto = computed(() => {
  if (!status.value) return ''
  if (status.value.status === 'emitido') return 'Certificado já emitido'
  if (status.value.status === 'elegivel') return 'Elegível para emissão'
  return 'Ainda não elegível'
})

function limparAlertas() {
  alertaErro.value = ''
  alertaSucesso.value = ''
}

async function consultarStatus() {
  const curso = form.value.curso.trim()
  if (!curso) {
    limparAlertas()
    alertaErro.value = 'Informe o curso.'
    return
  }
  limparAlertas()
  status.value = null
  consultando.value = true
  try {
    const data = await callApi({ action: 'consultar_certificado', token: getToken(), curso })
    if (!data) { alertaErro.value = 'Resposta vazia do servidor.'; return }
    if (data.erro) {
      if (!tratarPossivelSessaoExpirada(data.mensagem)) alertaErro.value = data.mensagem || 'Erro ao consultar status.'
      return
    }
    status.value = data
    if (data.mensagem) {
      if (data.status === 'emitido' || data.status === 'elegivel') alertaSucesso.value = data.mensagem
      else alertaErro.value = data.mensagem
    }
  } catch (err) {
    alertaErro.value = (err && err.message) || 'Falha de conexão.'
  } finally {
    consultando.value = false
  }
}

async function emitirCertificado() {
  const curso = form.value.curso.trim()
  const nome = form.value.nome.trim()
  if (!curso || !nome) {
    alertaErro.value = 'Informe curso e nome completo para emitir.'
    return
  }
  limparAlertas()
  emitindo.value = true
  try {
    const data = await callApi({ action: 'emitir_certificado', token: getToken(), curso, nome })
    if (!data) { alertaErro.value = 'Resposta vazia do servidor.'; return }
    if (data.erro) {
      if (!tratarPossivelSessaoExpirada(data.mensagem)) alertaErro.value = data.mensagem || 'Erro ao emitir certificado.'
      return
    }
    status.value = data
    alertaSucesso.value = data.mensagem || 'Certificado emitido com sucesso.'
  } catch (err) {
    alertaErro.value = (err && err.message) || 'Falha de conexão.'
  } finally {
    emitindo.value = false
  }
}

async function reenviarCertificado() {
  const curso = form.value.curso.trim()
  if (!curso) {
    alertaErro.value = 'Informe o curso.'
    return
  }
  limparAlertas()
  reenviando.value = true
  try {
    const data = await callApi({ action: 'reenviar_certificado', token: getToken(), curso })
    if (!data) { alertaErro.value = 'Resposta vazia do servidor.'; return }
    if (data.erro) {
      if (!tratarPossivelSessaoExpirada(data.mensagem)) alertaErro.value = data.mensagem || 'Erro ao reenviar certificado.'
      return
    }
    alertaSucesso.value = data.mensagem || 'Certificado reenviado com sucesso.'
  } catch (err) {
    alertaErro.value = (err && err.message) || 'Falha de conexão.'
  } finally {
    reenviando.value = false
  }
}

onMounted(() => {
  document.title = 'Certificação SENA | IBSDH'
  if (estaAutenticado()) {
    logado.value = true
    emailLogado.value = getEmailExibicao() || ''
  }
})
</script>

<style scoped>
* { box-sizing: border-box; margin: 0; padding: 0; }
/* Tema escuro é a base (sem classe) e o claro entra como override sob
   body.tema-claro — mesmo padrão adotado em RankingView.vue, para que
   o toggle do Dashboard alcance esta tela também (achado pós-lançamento:
   "modo escuro é o pior" porque telas menores ficavam sempre no claro). */
.wrap {
  --text: #f7f4ee;
  --text-soft: #c2b59a;
  --text-faint: #a0937a;
  --gold: #f0ac4a;
  --cyan: #4dd0bc;
  --success: #86d16c;
  --danger: #ef8266;
  --panel: #241f16;
  --border: rgba(200,185,155,0.18);
  --shadow: 0 1px 2px rgba(0,0,0,0.3), 0 24px 48px rgba(0,0,0,0.35);
  font-family: 'Inter', sans-serif;
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(77,208,188,0.1), transparent 30%),
    radial-gradient(circle at top right, rgba(240,172,74,0.07), transparent 26%),
    linear-gradient(180deg, #120f0b 0%, #1b160f 100%);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  width: 100%; max-width: none;
}
body.tema-claro .wrap {
  --text: #23201a;
  --text-soft: #5c5647;
  --text-faint: #786f5e;
  --gold: #a85200;
  --cyan: #037d6c;
  --success: #158035;
  --danger: #c93712;
  --panel: #ffffff;
  --border: rgba(35,32,26,0.12);
  --shadow: 0 1px 2px rgba(35,32,26,0.06), 0 24px 48px rgba(35,32,26,0.14);
  background:
    radial-gradient(circle at top left, rgba(3,125,108,0.14), transparent 30%),
    radial-gradient(circle at top right, rgba(168,82,0,0.1), transparent 26%),
    linear-gradient(180deg, #faf8f4 0%, #f1ece2 100%);
}
.wrap > .card { width: 100%; max-width: 820px; }
.card {
  position: relative;
  background: linear-gradient(180deg, var(--panel) 0%, color-mix(in srgb, var(--panel) 97%, var(--text) 3%) 100%);
  border: 1px solid color-mix(in srgb, var(--text) 14%, transparent);
  border-radius: 24px;
  box-shadow: 0 1px 2px color-mix(in srgb, var(--text) 6%, transparent), 0 28px 56px color-mix(in srgb, var(--text) 16%, transparent);
  overflow: hidden;
}
.card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, var(--cyan), var(--gold)); }
.header { padding: 32px 28px 20px; border-bottom: 1px solid color-mix(in srgb, var(--text) 8%, transparent); }
.eyebrow {
  display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px;
  border-radius: 999px; background: color-mix(in srgb, var(--text) 3%, transparent); border: 1px solid color-mix(in srgb, var(--text) 7%, transparent);
  color: var(--gold); font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 14px;
}
.eyebrow::before { content: ''; width: 7px; height: 7px; border-radius: 999px; background: var(--gold); }
h1 { font-size: 34px; line-height: 1.05; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 10px; }
.sub { color: var(--text-soft); font-size: 15px; line-height: 1.7; }
.body { padding: 24px 28px 28px; display: grid; gap: 16px; }
.field { display: grid; gap: 8px; }
label { color: var(--text-soft); font-size: 12px; font-weight: 700; letter-spacing: .10em; text-transform: uppercase; }
.value-static {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 16px; border-radius: 14px; border: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
  background: color-mix(in srgb, var(--text) 3%, transparent); color: var(--text); font-size: 15px;
}
.btn-trocar {
  background: none; border: none; color: var(--cyan); font-size: 12px;
  text-decoration: underline; cursor: pointer; padding: 0; white-space: nowrap;
}
input {
  width: 100%; padding: 16px; border-radius: 14px; border: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
  background: color-mix(in srgb, var(--text) 3%, transparent); color: var(--text); font-size: 15px; outline: none;
  font-family: 'Inter', sans-serif;
}
input:focus { border-color: color-mix(in srgb, var(--cyan) 35%, transparent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--cyan) 8%, transparent); }
.btn-row { display: flex; gap: 12px; flex-wrap: wrap; }
.btn, .btn-secondary, .btn-success {
  border: none; border-radius: 14px; padding: 16px 18px; font-size: 13px; font-weight: 800;
  letter-spacing: .08em; text-transform: uppercase; cursor: pointer; text-decoration: none;
  display: inline-block; font-family: 'Inter', sans-serif;
}
.btn { color: #ffffff; background: var(--cyan); }
.btn-success { color: #ffffff; background: var(--success); }
.btn-secondary { color: var(--text); background: color-mix(in srgb, var(--text) 6%, transparent); border: 1px solid color-mix(in srgb, var(--text) 8%, transparent); }
.btn:disabled, .btn-secondary:disabled, .btn-success:disabled { opacity: .5; cursor: not-allowed; }
.alert { display: none; padding: 14px 16px; border-radius: 14px; font-size: 14px; }
.alert.visible { display: block; }
.alert.error { border: 1px solid color-mix(in srgb, var(--danger) 18%, transparent); background: color-mix(in srgb, var(--danger) 8%, transparent); color: var(--danger); }
.alert.success { border: 1px solid color-mix(in srgb, var(--success) 18%, transparent); background: color-mix(in srgb, var(--success) 8%, transparent); color: var(--success); }
.status-box { display: none; gap: 12px; }
.status-box.visible { display: grid; }
.item { padding: 16px; border-radius: 16px; border: 1px solid color-mix(in srgb, var(--text) 6%, transparent); background: color-mix(in srgb, var(--text) 3%, transparent); }
.label2 { color: var(--text-soft); font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 8px; }
.value { color: var(--text); font-size: 15px; line-height: 1.7; word-break: break-word; }
</style>

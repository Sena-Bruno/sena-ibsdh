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
.wrap {
  --bg: #12100c;
  --panel: rgba(27,23,17, 0.96);
  --panel-soft: rgba(255,255,255,0.03);
  --border: rgba(168,150,120,0.18);
  --text: #f4eee1;
  --text-soft: #b7ab98;
  --text-faint: #9c9080;
  --gold: #d3a24f;
  --cyan: #7fc9bb;
  --success: #93bf78;
  --danger: #e0846a;
  font-family: 'Inter', sans-serif;
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(127,201,187,0.08), transparent 28%),
    radial-gradient(circle at top right, rgba(211,162,79,0.06), transparent 22%),
    linear-gradient(180deg, #12100c 0%, #0f0d09 100%);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  width: 100%; max-width: none;
}
.wrap > .card { width: 100%; max-width: 820px; }
.card {
  background: linear-gradient(180deg, rgba(27,23,17,0.96) 0%, rgba(15,13,9,0.98) 100%);
  border: 1px solid var(--border);
  border-radius: 24px;
  box-shadow: 0 22px 48px rgba(0,0,0,0.35);
  overflow: hidden;
}
.header { padding: 28px 28px 20px; border-bottom: 1px solid rgba(255,255,255,0.06); }
.eyebrow {
  display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px;
  border-radius: 999px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
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
  padding: 16px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03); color: var(--text); font-size: 15px;
}
.btn-trocar {
  background: none; border: none; color: var(--cyan); font-size: 12px;
  text-decoration: underline; cursor: pointer; padding: 0; white-space: nowrap;
}
input {
  width: 100%; padding: 16px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03); color: var(--text); font-size: 15px; outline: none;
  font-family: 'Inter', sans-serif;
}
input:focus { border-color: rgba(127,201,187,0.35); box-shadow: 0 0 0 4px rgba(127,201,187,0.08); }
.btn-row { display: flex; gap: 12px; flex-wrap: wrap; }
.btn, .btn-secondary, .btn-success {
  border: none; border-radius: 14px; padding: 16px 18px; font-size: 13px; font-weight: 800;
  letter-spacing: .08em; text-transform: uppercase; cursor: pointer; text-decoration: none;
  display: inline-block; font-family: 'Inter', sans-serif;
}
.btn { color: #17130c; background: linear-gradient(135deg, var(--cyan) 0%, #b7ded4 100%); }
.btn-success { color: #17130c; background: linear-gradient(135deg, var(--success) 0%, #c3dcae 100%); }
.btn-secondary { color: var(--text); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); }
.btn:disabled, .btn-secondary:disabled, .btn-success:disabled { opacity: .5; cursor: not-allowed; }
.alert { display: none; padding: 14px 16px; border-radius: 14px; font-size: 14px; }
.alert.visible { display: block; }
.alert.error { border: 1px solid rgba(224,132,106,0.18); background: rgba(224,132,106,0.08); color: #eeb09e; }
.alert.success { border: 1px solid rgba(147,191,120,0.18); background: rgba(147,191,120,0.08); color: #c3dcae; }
.status-box { display: none; gap: 12px; }
.status-box.visible { display: grid; }
.item { padding: 16px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.03); }
.label2 { color: var(--text-soft); font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 8px; }
.value { color: var(--text); font-size: 15px; line-height: 1.7; word-break: break-word; }
</style>

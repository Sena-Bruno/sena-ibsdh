<!--
  Modal de login por código (OTP) — substitui, em todas as telas, o antigo
  "digite seu e-mail" sem prova nenhuma de posse dele (achado F1 da auditoria
  de segurança). Duas etapas: pedir o código por e-mail, depois confirmá-lo.
  Ao confirmar, guarda o token de sessão (useAuth) e emite `success`.
-->
<template>
  <div class="login-overlay" role="dialog" aria-modal="true" :aria-label="etapa === 'email' ? 'Entrar' : 'Confirmar código'">
    <div class="login-card">
      <div class="login-eyebrow">SENA · IBSDH</div>

      <template v-if="etapa === 'email'">
        <h2 class="login-titulo">Entrar</h2>
        <p class="login-sub">Digite seu e-mail de matrícula. Vamos enviar um código de acesso — sem senha para guardar.</p>
        <form @submit.prevent="enviarCodigo">
          <label class="sr-only" for="loginEmail">E-mail</label>
          <input
            id="loginEmail" ref="campoEmail" type="email" autocomplete="email"
            placeholder="seu@email.com" v-model="email" :disabled="carregando"
          >
          <div class="login-erro" role="alert" v-if="erro">{{ erro }}</div>
          <button type="submit" class="login-btn" :disabled="carregando">
            {{ carregando ? 'Enviando...' : 'Enviar código' }}
          </button>
        </form>
      </template>

      <template v-else>
        <h2 class="login-titulo">Confirme seu código</h2>
        <p class="login-sub">Enviamos um código de 6 dígitos para <b>{{ email }}</b>. Ele vale por 10 minutos.</p>
        <form @submit.prevent="confirmar">
          <label class="sr-only" for="loginCodigo">Código</label>
          <input
            id="loginCodigo" ref="campoCodigo" type="text" inputmode="numeric" autocomplete="one-time-code"
            maxlength="6" placeholder="000000" v-model="codigo" :disabled="carregando"
          >
          <div class="login-erro" role="alert" v-if="erro">{{ erro }}</div>
          <button type="submit" class="login-btn" :disabled="carregando">
            {{ carregando ? 'Confirmando...' : 'Confirmar e entrar' }}
          </button>
          <button type="button" class="login-link" :disabled="carregando" @click="voltarParaEmail">
            Usar outro e-mail / pedir novo código
          </button>
        </form>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue'
import { solicitarCodigo, confirmarCodigo } from '../composables/useAuth'

const props = defineProps({
  // Erro de negócio a mostrar assim que o modal abre (ex.: "curso sem acesso
  // liberado para este e-mail") — distinto de um erro do próprio login.
  erroInicial: { type: String, default: '' }
})
const emit = defineEmits(['success'])

const etapa = ref('email')
const email = ref('')
const codigo = ref('')
const erro = ref(props.erroInicial)
const carregando = ref(false)
const campoEmail = ref(null)
const campoCodigo = ref(null)

async function enviarCodigo() {
  const val = email.value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    erro.value = 'Digite um e-mail válido.'
    return
  }
  erro.value = ''
  carregando.value = true
  try {
    await solicitarCodigo(val)
    email.value = val
    etapa.value = 'codigo'
    await nextTick()
    campoCodigo.value && campoCodigo.value.focus()
  } catch (e) {
    erro.value = (e && e.message) || 'Não foi possível enviar o código.'
  } finally {
    carregando.value = false
  }
}

async function confirmar() {
  const cod = codigo.value.trim()
  if (!/^\d{6}$/.test(cod)) {
    erro.value = 'O código tem 6 dígitos.'
    return
  }
  erro.value = ''
  carregando.value = true
  try {
    const data = await confirmarCodigo(email.value, cod)
    emit('success', { email: data.email || email.value })
  } catch (e) {
    erro.value = (e && e.message) || 'Código incorreto.'
  } finally {
    carregando.value = false
  }
}

function voltarParaEmail() {
  etapa.value = 'email'
  codigo.value = ''
  erro.value = ''
  nextTick(() => campoEmail.value && campoEmail.value.focus())
}

onMounted(() => {
  nextTick(() => campoEmail.value && campoEmail.value.focus())
})
</script>

<style scoped>
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
.login-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(10, 9, 6, 0.72);
  display: flex; align-items: center; justify-content: center;
  padding: var(--sena-e-4, 16px);
}
.login-card {
  width: 100%; max-width: 380px;
  background: var(--sena-surface, #1b1711);
  border: 1px solid var(--sena-border-forte, rgba(196,180,150,0.55));
  border-radius: var(--sena-r-xl, 22px);
  box-shadow: var(--sena-sombra-alta, 0 24px 48px rgba(0,0,0,0.3));
  padding: var(--sena-e-6, 24px);
  font-family: var(--sena-fonte, 'Inter', sans-serif);
  color: var(--sena-text, #f4eee1);
}
.login-eyebrow {
  font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
  color: var(--sena-gold, #d3a24f); margin-bottom: var(--sena-e-3, 12px);
}
.login-titulo {
  font-family: var(--sena-fonte-titulo, 'Fraunces', serif);
  font-size: var(--sena-t-lg, 22px); font-weight: 600; margin: 0 0 8px;
}
.login-sub {
  color: var(--sena-text-soft, #b7ab98); font-size: var(--sena-t-corpo, 15px);
  line-height: var(--sena-lh-corpo, 1.65); margin: 0 0 var(--sena-e-5, 20px);
}
form { display: grid; gap: var(--sena-e-3, 12px); }
input {
  width: 100%; padding: 14px 16px; border-radius: var(--sena-r-md, 12px);
  border: 1px solid var(--sena-border-forte, rgba(196,180,150,0.55));
  background: var(--sena-surface-1, rgba(244,238,225,0.04));
  color: var(--sena-text, #f4eee1); font-size: var(--sena-t-corpo, 15px);
  font-family: inherit; outline: none; min-height: var(--sena-toque-min, 44px);
}
input:focus-visible {
  outline: var(--sena-foco-largura, 2px) solid var(--sena-foco, #e3b567);
  outline-offset: var(--sena-foco-offset, 2px);
}
input:disabled { opacity: .6; }
.login-erro {
  color: var(--sena-danger, #e0846a); font-size: var(--sena-t-peq, 13px);
}
.login-btn {
  border: none; border-radius: var(--sena-r-md, 12px); padding: 14px 18px;
  font-size: 13px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase;
  cursor: pointer; min-height: var(--sena-toque-min, 44px);
  color: var(--sena-on-acento, #17130c);
  background: linear-gradient(135deg, var(--sena-cyan, #7fc9bb) 0%, #b7ded4 100%);
}
.login-btn:disabled { opacity: .55; cursor: not-allowed; }
.login-btn:focus-visible {
  outline: var(--sena-foco-largura, 2px) solid var(--sena-foco, #e3b567);
  outline-offset: var(--sena-foco-offset, 2px);
}
.login-link {
  background: none; border: none; color: var(--sena-text-soft, #b7ab98);
  font-size: var(--sena-t-peq, 13px); text-decoration: underline; cursor: pointer;
  padding: 6px 0; justify-self: start;
}
.login-link:disabled { opacity: .5; cursor: not-allowed; }
</style>

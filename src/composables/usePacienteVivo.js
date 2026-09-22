// Cliente do backend do Paciente Vivo (nucleo/sena_servico/api.py — etapa 4).
//
// Por que este composable NÃO reusa callApi() de useApi.js: aquele fala com
// o proxy /api do Netlify, que encaminha para o Apps Script no mesmo domínio
// (sem problema de CORS, porque a chamada nunca sai do navegador para outro
// host). O Paciente Vivo roda num serviço Python separado, hospedado à parte
// (Render — ver render.yaml), então esta chamada SAI do domínio do site. Por
// isso o backend precisa de CORS (ver CORSMiddleware em api.py) e este
// composable aponta para uma base URL diferente.
//
// O TOKEN é o mesmo (useAuth/getToken) — o Paciente Vivo não tem login
// próprio, ver o cabeçalho de nucleo/sena_servico/autenticacao.py.
//
// VITE_PACIENTE_VIVO_URL é uma variável de AMBIENTE DE BUILD do Netlify
// (Site configuration → Environment variables), preenchida por Bruno depois
// de criar o serviço no Render — ver nucleo/README.md, seção "Etapa 4". Sem
// ela, `pacienteVivoConfigurado()` volta `false` e a tela mostra um aviso em
// vez de tentar chamar um host vazio.

import { getToken } from './useAuth.js'

// `import.meta.env` só existe sob o Vite — os testes deste arquivo rodam
// com `node --test`, puro (ver package.json, test:frontend), sem bundler.
const BASE_URL = ((import.meta.env && import.meta.env.VITE_PACIENTE_VIVO_URL) || '').replace(/\/+$/, '')

// Bem maior que o TIMEOUT_MS de useApi.js (20s): o plano gratuito do Render
// hiberna após 15 minutos sem requisição e acorda em 30-60s na primeira
// chamada seguinte (ver o comentário no topo de render.yaml). Um timeout
// curto aqui trataria "acordando" como falha.
const TIMEOUT_MS = 70000

export function pacienteVivoConfigurado() {
  return !!BASE_URL
}

export class ErroPacienteVivo extends Error {
  constructor(mensagem, { status = null, sessaoInvalida = false } = {}) {
    super(mensagem)
    this.name = 'ErroPacienteVivo'
    this.status = status
    this.sessaoInvalida = sessaoInvalida
  }
}

// Extraída à parte para ser testável sem simular fetch/rede — mesma lógica
// que api.py usa para decidir o status (401/403/404/503), só traduzida para
// uma frase que um instrutor entende sem ler o código do serviço.
export function mensagemDeErro(status, detalheServidor) {
  if (status === 401) return 'Sessão expirada ou inválida. Faça login novamente.'
  if (status === 403) return 'Este e-mail não está na lista do piloto do Paciente Vivo.'
  if (status === 503) return 'O piloto ainda não foi configurado no servidor (SENA_EMAILS_PILOTO vazio).'
  if (status === 404) return 'Paciente não encontrado — ou pertence a outro e-mail.'
  if (status === 422) return detalheServidor || 'Dados inválidos para esta operação.'
  if (typeof status === 'number' && status >= 500) return 'O servidor do Paciente Vivo teve um erro interno.'
  return detalheServidor || 'Não foi possível completar a operação.'
}

async function chamar(caminho, { method = 'GET', corpo } = {}) {
  if (!BASE_URL) {
    throw new ErroPacienteVivo(
      'O Paciente Vivo ainda não foi configurado nesta implantação (falta a variável VITE_PACIENTE_VIVO_URL no Netlify).'
    )
  }
  const token = getToken()
  if (!token) {
    throw new ErroPacienteVivo('Sessão ausente.', { sessaoInvalida: true })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let resposta
  try {
    resposta = await fetch(BASE_URL + caminho, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      signal: controller.signal,
    })
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new ErroPacienteVivo(
        'O servidor demorou demais para responder. No plano gratuito ele pode estar "acordando" depois de ficar ocioso — tente de novo em instantes.'
      )
    }
    throw new ErroPacienteVivo('Não foi possível contatar o servidor do Paciente Vivo. Verifique sua conexão.')
  } finally {
    clearTimeout(timeoutId)
  }

  if (!resposta.ok) {
    let detalhe = null
    try {
      detalhe = (await resposta.json()).detail
    } catch (_e) {
      // corpo do erro não era JSON — segue com detalhe nulo
    }
    throw new ErroPacienteVivo(mensagemDeErro(resposta.status, detalhe), {
      status: resposta.status,
      sessaoInvalida: resposta.status === 401,
    })
  }
  if (resposta.status === 204) return null
  return await resposta.json()
}

export function usePacienteVivo() {
  return {
    pacienteVivoConfigurado,
    diagnostico: () => chamar('/diagnostico'),
    listarPerfis: () => chamar('/perfis'),
    criarPaciente: (curso, perfil) =>
      chamar('/pacientes', { method: 'POST', corpo: { curso, perfil } }),
    obterPaciente: (id) => chamar(`/pacientes/${encodeURIComponent(id)}`),
    registrarSessao: (id, prescricao) =>
      chamar(`/pacientes/${encodeURIComponent(id)}/sessoes`, { method: 'POST', corpo: prescricao }),
    obterFicha: (id, numeroSessao) =>
      chamar(`/pacientes/${encodeURIComponent(id)}/ficha/${encodeURIComponent(numeroSessao)}`),
    obterHistorico: (id) => chamar(`/pacientes/${encodeURIComponent(id)}/historico`),
  }
}

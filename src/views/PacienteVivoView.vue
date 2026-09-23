<!--
  Tela do INSTRUTOR para o Paciente Vivo (etapa 4 — piloto interno).

  ┌───────────────────────────────────────────────────────────────────────┐
  │  ISTO NÃO É O SIMULADOR (index.html/SimuladorView.vue)                 │
  │                                                                       │
  │  O Simulador é uma sessão isolada, avaliada por IA, contra critério   │
  │  de aula. O Paciente Vivo é outra coisa: um caso com MEMÓRIA — o      │
  │  aluno prescreve uma tarefa, o motor Python simula a semana inteira   │
  │  (nucleo/sena_nucleo), e o paciente chega na sessão seguinte já       │
  │  tendo vivido aquilo. Sem nota, sem aprovação — é ensaio, não prova.  │
  │                                                                       │
  │  Por isso esta tela fala com um backend DIFERENTE (Render, via        │
  │  usePacienteVivo.js), não com o Apps Script de sempre (/api).         │
  └───────────────────────────────────────────────────────────────────────┘

  Gate do piloto: o e-mail autenticado precisa estar em SENA_EMAILS_PILOTO
  no servidor (ver nucleo/sena_servico/api.py, exigir_piloto). Esta tela
  não decide quem entra — só mostra o aviso certo quando o servidor
  recusa. De propósito NÃO há link para esta rota em nenhum outro lugar
  do site (ver router/index.js): alcançável só por quem já sabe a URL,
  enquanto o piloto for fechado.
-->

<template>
  <div class="page">
    <LoginModal v-if="!logado" @success="aoLogar" />

    <div class="shell" v-else>
      <router-link class="btn-voltar" to="/dashboard.html">← Voltar ao painel</router-link>

      <div class="hero">
        <div class="eyebrow">Piloto interno · Paciente Vivo</div>
        <h1>Paciente Vivo</h1>
        <p class="sub">
          Um paciente virtual com memória: o que você prescreve muda a semana inteira dele, e ele
          chega na sessão seguinte já tendo vivido aquilo. Sem nota — é ensaio clínico, não avaliação.
        </p>
      </div>

      <div v-if="fase === 'nao-configurado'" class="aviso-card">
        <p>
          Este ambiente ainda não tem o Paciente Vivo conectado — falta a variável
          <code>VITE_PACIENTE_VIVO_URL</code> nas configurações de build do Netlify. Configure o
          serviço no Render primeiro (ver <code>nucleo/README.md</code>, seção "Etapa 4").
        </p>
      </div>

      <div v-else-if="fase === 'conectando'" class="loading" role="status">
        Conectando ao Paciente Vivo... No plano gratuito, o servidor pode levar até um minuto para
        acordar, se estiver ocioso há um tempo.
      </div>

      <div v-else-if="fase === 'fora-do-piloto'" class="aviso-card">
        <p>
          O Paciente Vivo está em piloto interno. Este e-mail ainda não está na lista de acesso —
          fale com quem administra o SENA para ser incluído em <code>SENA_EMAILS_PILOTO</code>.
        </p>
      </div>

      <div v-else-if="fase === 'piloto-nao-configurado'" class="aviso-card">
        <p>
          O serviço está no ar, mas ainda ninguém foi autorizado (<code>SENA_EMAILS_PILOTO</code>
          vazio no Render). Configure essa variável para abrir o piloto.
        </p>
      </div>

      <div v-else-if="fase === 'erro-conexao'" class="aviso-card erro">
        <p>{{ erroMensagem }}</p>
        <button class="btn-secundario" @click="iniciar">Tentar de novo</button>
      </div>

      <template v-else-if="fase === 'selecionar-perfil'">
        <div class="setup-card">
          <label class="campo-label" for="pvCurso">Curso</label>
          <input id="pvCurso" v-model="curso" class="campo-input" placeholder="Practitioner" />

          <div class="campo-label">Perfil clínico</div>
          <div class="perfil-grid">
            <button
              v-for="(p, nome) in perfis"
              :key="nome"
              type="button"
              class="perfil-card"
              :class="{ selecionado: perfilSelecionado === nome }"
              @click="perfilSelecionado = nome"
            >
              <div class="perfil-nome">{{ nome }}</div>
              <div class="perfil-desc">{{ p.descricao }}</div>
            </button>
          </div>

          <div v-if="perfilSelecionado" class="perfil-detalhe">
            <div class="mini-title">Resistências</div>
            <ul class="mini-list">
              <li v-for="r in perfis[perfilSelecionado].resistencias" :key="r">{{ r }}</li>
            </ul>
            <div class="mini-title">Abordagem recomendada</div>
            <p class="mini-text">{{ perfis[perfilSelecionado].abordagem_ideal }}</p>
          </div>

          <div v-if="erroMensagem" class="alert" role="alert">{{ erroMensagem }}</div>
          <button
            class="btn-primario"
            :disabled="!perfilSelecionado || !curso.trim() || criando"
            @click="abrirPaciente"
          >
            {{ criando ? 'Abrindo...' : 'Abrir paciente' }}
          </button>
        </div>
      </template>

      <template v-else-if="fase === 'sessao' && paciente">
        <div class="paciente-header">
          <div>
            <div class="paciente-perfil">{{ paciente.perfil }} · {{ paciente.curso }}</div>
            <div class="paciente-sessao">Próxima sessão: {{ paciente.numero_sessao }}</div>
          </div>
          <button class="btn-secundario btn-pequeno" @click="trocarPaciente">Trocar paciente</button>
        </div>

        <div class="sessao-grid">
          <div class="painel-paciente">
            <AvatarPaciente :sinais="sinaisAvatar" :falando="falandoAvatar" :reduzir-movimento="prefs.movimento" />
            <label class="voz-toggle">
              <input type="checkbox" v-model="vozAtiva" @change="aoMudarVoz" />
              Ouvir o paciente (voz do navegador)
            </label>

            <template v-if="ultimaAbertura">
              <div class="fala-lista">
                <p v-for="(linha, i) in ultimaAbertura.fala" :key="'f' + i" class="fala-linha">{{ linha }}</p>
              </div>
              <div class="corpo-lista">
                <div class="mini-title">Sinais do corpo</div>
                <p v-for="(linha, i) in ultimaAbertura.corpo" :key="'c' + i" class="corpo-linha">{{ linha }}</p>
              </div>
            </template>
            <p v-else class="vazio-aviso">
              Prescreva a primeira semana para o paciente abrir a sessão.
            </p>
          </div>

          <div class="painel-prescricao">
            <div class="mini-title">Prescrição para a próxima semana</div>
            <label class="campo-label" for="pvTipo">Tipo</label>
            <select id="pvTipo" v-model="prescricao.tipo" class="campo-input">
              <option v-for="t in TIPOS_PRESCRICAO" :key="t.valor" :value="t.valor">{{ t.rotulo }}</option>
            </select>

            <template v-if="prescricao.tipo !== 'NENHUMA'">
              <label class="campo-label">Especificidade ({{ prescricao.especificidade.toFixed(2) }})</label>
              <input type="range" min="0" max="1" step="0.05" v-model.number="prescricao.especificidade" />
              <label class="campo-label">Carga pedida ({{ prescricao.carga.toFixed(2) }})</label>
              <input type="range" min="0" max="1" step="0.05" v-model.number="prescricao.carga" />
              <label class="checkbox-label">
                <input type="checkbox" v-model="prescricao.plano_de_seguranca" />
                Combinou plano de segurança
              </label>
            </template>

            <div v-if="erroSemana" class="alert" role="alert">{{ erroSemana }}</div>
            <button class="btn-primario" :disabled="avancando" @click="avancarSemana">
              {{ avancando ? 'Simulando semana...' : 'Avançar semana →' }}
            </button>
          </div>
        </div>

        <FichaSupervisor
          v-if="ultimaFicha && ultimaAbertura"
          :numero-sessao="ultimaAbertura.numero_sessao_concluida"
          :ficha="ultimaFicha"
        />

        <div v-if="historico.length" class="historico-card">
          <div class="mini-title">Sessões anteriores</div>
          <div class="historico-lista">
            <button
              v-for="h in historico"
              :key="h.numero_sessao"
              type="button"
              class="historico-item"
              :class="{ selecionado: numeroHistoricoAberto === h.numero_sessao }"
              @click="verFichaHistorico(h.numero_sessao)"
            >
              Sessão {{ h.numero_sessao }}
            </button>
          </div>
          <p v-if="erroHistorico" class="alert" role="alert">{{ erroHistorico }}</p>
          <FichaSupervisor
            v-if="fichaHistorico && numeroHistoricoAberto !== null"
            :numero-sessao="numeroHistoricoAberto"
            :ficha="fichaHistorico"
          />
        </div>
      </template>

      <div class="footer">IBSDH — Instituto Bruno Sena de Desenvolvimento Humano</div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { estaAutenticado, getToken, limparSessao } from '../composables/useAuth'
import { useAccessibility } from '../composables/useAccessibility'
import { usePacienteVivo, ErroPacienteVivo } from '../composables/usePacienteVivo'
import { sinaisReaisParaAvatar } from '../composables/sinaisCorporais.js'
import LoginModal from '../components/LoginModal.vue'
import AvatarPaciente from '../components/AvatarPaciente.vue'
import FichaSupervisor from '../components/FichaSupervisor.vue'

const route = useRoute()
const {
  pacienteVivoConfigurado,
  diagnostico,
  listarPerfis,
  criarPaciente,
  obterPaciente,
  registrarSessao,
  obterFicha,
  obterHistorico,
} = usePacienteVivo()

const { carregarPreferencias, limparClasses } = useAccessibility({
  tema: 'sena_tema',
  altoContraste: 'sena_alto_contraste',
  reduzirMovimento: 'sena_reduzir_movimento',
})
const prefs = reactive({ movimento: false })

const TIPOS_PRESCRICAO = [
  { valor: 'NENHUMA', rotulo: 'Nenhuma — só observar' },
  { valor: 'RESPIRATORIA', rotulo: 'Regulação respiratória' },
  { valor: 'REGISTRO', rotulo: 'Registro / diário' },
  { valor: 'ATIVACAO_COMPORTAMENTAL', rotulo: 'Ativação comportamental' },
  { valor: 'ANCORAGEM', rotulo: 'Ancoragem' },
  { valor: 'EXPOSICAO_GRADUAL', rotulo: 'Exposição gradual' },
  { valor: 'PSICOEDUCACAO', rotulo: 'Psicoeducação' },
  { valor: 'CONTENCAO', rotulo: 'Contenção' },
]

const logado = ref(false)
// Máquina de estados da tela, depois do login:
// 'conectando' → 'nao-configurado' | 'fora-do-piloto' | 'piloto-nao-configurado'
//              | 'erro-conexao' | 'selecionar-perfil' → 'sessao'
const fase = ref('conectando')
const erroMensagem = ref('')

const perfis = ref({})
const curso = ref(route.query.curso || 'Practitioner')
const perfilSelecionado = ref('')
const criando = ref(false)

const paciente = ref(null)
const prescricao = reactive({
  tipo: 'NENHUMA',
  especificidade: 0.5,
  carga: 0.5,
  plano_de_seguranca: false,
})
const avancando = ref(false)
const erroSemana = ref('')
const ultimaAbertura = ref(null)
const ultimaFicha = ref(null)
// Sinais REAIS do motor (ideia #2 — o avatar anima o sinal, não só
// descreve em texto). `null` até a primeira semana rodar — o avatar cai
// no preset "neutro" nesse meio-tempo (ver AvatarPaciente.vue).
const sinaisAvatar = computed(() =>
  ultimaAbertura.value ? sinaisReaisParaAvatar(ultimaAbertura.value.sinais) : null
)

const historico = ref([])
const numeroHistoricoAberto = ref(null)
const fichaHistorico = ref(null)
const erroHistorico = ref('')

const falandoAvatar = ref(false)
const vozAtiva = ref(false)

function aoLogar() {
  logado.value = true
  iniciar()
}

// Uma sessão inválida pode ser descoberta em QUALQUER chamada (o token do
// SENA expira depois de um tempo fixo — ver autenticacao.gs) — centralizado
// aqui em vez de repetido em cada catch, para não esquecer um caminho.
function tratarErro(e, alvoErro) {
  if (e instanceof ErroPacienteVivo && e.sessaoInvalida) {
    limparSessao()
    logado.value = false
    return
  }
  alvoErro.value = e instanceof ErroPacienteVivo ? e.message : 'Erro inesperado. Tente novamente.'
}

async function iniciar() {
  if (!pacienteVivoConfigurado()) {
    fase.value = 'nao-configurado'
    return
  }
  fase.value = 'conectando'
  erroMensagem.value = ''
  try {
    await diagnostico()
  } catch (e) {
    if (e instanceof ErroPacienteVivo && e.sessaoInvalida) {
      limparSessao()
      logado.value = false
      return
    }
    if (e instanceof ErroPacienteVivo && e.status === 403) {
      fase.value = 'fora-do-piloto'
      return
    }
    if (e instanceof ErroPacienteVivo && e.status === 503) {
      fase.value = 'piloto-nao-configurado'
      return
    }
    erroMensagem.value = e instanceof ErroPacienteVivo ? e.message : 'Erro inesperado ao conectar.'
    fase.value = 'erro-conexao'
    return
  }

  try {
    perfis.value = await listarPerfis()
  } catch (e) {
    tratarErro(e, erroMensagem)
    fase.value = 'erro-conexao'
    return
  }
  fase.value = 'selecionar-perfil'
}

async function abrirPaciente() {
  if (!perfilSelecionado.value || !curso.value.trim()) return
  criando.value = true
  erroMensagem.value = ''
  try {
    paciente.value = await criarPaciente(curso.value.trim(), perfilSelecionado.value)
    fase.value = 'sessao'
    await carregarHistorico()
  } catch (e) {
    tratarErro(e, erroMensagem)
  } finally {
    criando.value = false
  }
}

function trocarPaciente() {
  paciente.value = null
  ultimaAbertura.value = null
  ultimaFicha.value = null
  historico.value = []
  numeroHistoricoAberto.value = null
  fichaHistorico.value = null
  fase.value = 'selecionar-perfil'
}

async function carregarHistorico() {
  if (!paciente.value) return
  try {
    historico.value = await obterHistorico(paciente.value.id)
  } catch (e) {
    tratarErro(e, erroHistorico)
  }
}

async function avancarSemana() {
  if (!paciente.value) return
  avancando.value = true
  erroSemana.value = ''
  try {
    const abertura = await registrarSessao(paciente.value.id, {
      tipo: prescricao.tipo,
      especificidade: prescricao.especificidade,
      carga: prescricao.carga,
      plano_de_seguranca: prescricao.plano_de_seguranca,
    })
    ultimaAbertura.value = abertura
    falarFala(abertura.fala)

    ultimaFicha.value = await obterFicha(paciente.value.id, abertura.numero_sessao_concluida)
    paciente.value = await obterPaciente(paciente.value.id)
    await carregarHistorico()
  } catch (e) {
    tratarErro(e, erroSemana)
  } finally {
    avancando.value = false
  }
}

async function verFichaHistorico(numeroSessao) {
  if (!paciente.value) return
  erroHistorico.value = ''
  numeroHistoricoAberto.value = numeroSessao
  fichaHistorico.value = null
  try {
    fichaHistorico.value = await obterFicha(paciente.value.id, numeroSessao)
  } catch (e) {
    tratarErro(e, erroHistorico)
  }
}

// ── voz do paciente (mesmo padrão de SimuladorView.vue: opt-in, off por
// padrão, e nunca decide o QUE o avatar mostra — só quando a boca se move).
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null

function aoMudarVoz() {
  if (!vozAtiva.value && synth) {
    synth.cancel()
    falandoAvatar.value = false
  }
}

function falarFala(fala) {
  if (!vozAtiva.value || !synth || !fala || !fala.length) return
  synth.cancel()
  const utter = new SpeechSynthesisUtterance(fala.join(' '))
  utter.lang = 'pt-BR'
  utter.rate = 0.92
  utter.pitch = 0.88
  const vozPT = synth.getVoices().find((v) => v.lang.startsWith('pt'))
  if (vozPT) utter.voice = vozPT
  utter.onstart = () => { falandoAvatar.value = true }
  utter.onend = () => { falandoAvatar.value = false }
  utter.onerror = () => { falandoAvatar.value = false }
  synth.speak(utter)
}

onMounted(() => {
  document.title = 'SENA | Paciente Vivo'
  carregarPreferencias()
  prefs.movimento = document.body.classList.contains('reduzir-movimento')
  if (estaAutenticado() && getToken()) {
    logado.value = true
    iniciar()
  }
})

onUnmounted(() => {
  if (synth) synth.cancel()
  limparClasses()
})
</script>

<style scoped>
* { margin: 0; padding: 0; box-sizing: border-box; }
.page {
  --text: #23201a; --text-soft: #5c5647; --text-faint: #786f5e; --cyan: #0e7a6f;
  --gold: #9c5a0c; --success: #2f7a3d; --danger: #ad3b26;
  --border: rgba(35,32,26,0.12); --shadow: 0 20px 48px rgba(35,32,26,0.1);
  font-family: 'Inter', sans-serif; min-height: 100vh;
  background: radial-gradient(ellipse at bottom right, rgba(14,122,111,0.06), transparent 30%),
    linear-gradient(180deg,#faf8f4,#f1ece2);
  color: var(--text); line-height: 1.6;
}
.shell { max-width: 880px; margin: 0 auto; padding: 28px 18px 48px; }
.btn-voltar {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 10px;
  border: 1px solid rgba(35,32,26,0.08); background: rgba(35,32,26,0.03);
  color: var(--text-soft); font-size: 12px; font-weight: 600; text-decoration: none; margin-bottom: 16px;
  transition: background .18s;
}
.btn-voltar:hover { background: rgba(35,32,26,0.06); }
.hero {
  background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(250,248,244,0.98));
  border: 1px solid var(--border); border-radius: 24px; padding: 28px; margin-bottom: 22px;
  box-shadow: var(--shadow);
}
.eyebrow {
  display: inline-flex; align-items: center; gap: 7px; padding: 5px 11px; border-radius: 999px;
  background: rgba(14,122,111,0.08); border: 1px solid rgba(14,122,111,0.18);
  color: var(--cyan); font-size: 10px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase;
  margin-bottom: 12px;
}
h1 { font-size: clamp(24px, 5vw, 36px); font-weight: 800; letter-spacing: -.03em; margin-bottom: 6px; }
.sub { color: var(--text-soft); font-size: 14px; max-width: 60ch; }

.aviso-card, .setup-card, .loading {
  background: rgba(35,32,26,0.02); border: 1px solid rgba(35,32,26,0.06);
  border-radius: 18px; padding: 22px; margin-bottom: 18px;
}
.loading { text-align: center; color: var(--text-faint); font-size: 14px; padding: 40px 22px; }
.aviso-card p { font-size: 13px; color: var(--text-soft); line-height: 1.7; }
.aviso-card.erro p { color: var(--danger); }
.aviso-card code { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--gold); }

.campo-label {
  display: block; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
  color: var(--text-faint); margin: 14px 0 6px;
}
.campo-label:first-child { margin-top: 0; }
.campo-input {
  width: 100%; border: 1px solid rgba(35,32,26,0.08); border-radius: 10px;
  background: rgba(35,32,26,0.03); color: var(--text); padding: 10px 12px; font-size: 13px;
  font-family: 'Inter', sans-serif; outline: none; transition: border-color .18s;
}
.campo-input:focus { border-color: rgba(14,122,111,0.35); }
.checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-soft); margin-top: 12px; }

.perfil-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin-top: 4px; }
.perfil-card {
  text-align: left; background: rgba(35,32,26,0.02); border: 1px solid rgba(35,32,26,0.07);
  border-radius: 12px; padding: 12px; cursor: pointer; color: inherit; font-family: inherit;
  transition: border-color .18s, background .18s;
}
.perfil-card:hover { background: rgba(35,32,26,0.04); }
.perfil-card.selecionado { border-color: var(--cyan); background: rgba(14,122,111,0.08); }
.perfil-nome { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
.perfil-desc { font-size: 11px; color: var(--text-faint); line-height: 1.5; }
.perfil-detalhe { margin-top: 16px; padding-top: 14px; border-top: 1px solid rgba(35,32,26,0.06); }
.mini-title {
  font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
  color: var(--text-faint); margin: 10px 0 6px;
}
.mini-list { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
.mini-list li {
  font-size: 11px; padding: 4px 9px; border-radius: 999px; background: rgba(35,32,26,0.05);
  color: var(--text-soft);
}
.mini-text { font-size: 12px; color: var(--text-soft); line-height: 1.65; }

.alert { padding: 10px 14px; border-radius: 10px; background: rgba(173,59,38,0.1); color: var(--danger); font-size: 12px; margin-top: 14px; }

.btn-primario {
  width: 100%; margin-top: 18px; padding: 12px 20px; border: none; border-radius: 12px;
  background: var(--cyan); color: #ffffff;
  font-size: 13px; font-weight: 800; letter-spacing: .03em; cursor: pointer; transition: transform .15s;
}
.btn-primario:hover:not(:disabled) { transform: translateY(-1px); }
.btn-primario:disabled { opacity: .5; cursor: not-allowed; transform: none; }
.btn-secundario {
  padding: 9px 16px; border-radius: 10px; border: 1px solid rgba(35,32,26,0.08);
  background: rgba(35,32,26,0.03); color: var(--text-soft); font-size: 12px; font-weight: 700;
  cursor: pointer; transition: background .18s;
}
.btn-secundario:hover { background: rgba(35,32,26,0.06); }
.btn-pequeno { padding: 7px 12px; font-size: 11px; }

.paciente-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
.paciente-perfil { font-size: 15px; font-weight: 700; }
.paciente-sessao { font-size: 12px; color: var(--text-faint); }

.sessao-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; }
@media (max-width: 720px) { .sessao-grid { grid-template-columns: 1fr; } }

.painel-paciente, .painel-prescricao {
  background: rgba(35,32,26,0.02); border: 1px solid rgba(35,32,26,0.06);
  border-radius: 16px; padding: 18px;
}
.voz-toggle { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 11px; color: var(--text-faint); margin-top: 10px; }
.fala-lista { margin-top: 16px; }
.fala-linha {
  font-size: 13px; color: var(--text); line-height: 1.7; font-style: italic;
  padding: 8px 0; border-bottom: 1px dashed rgba(35,32,26,0.06);
}
.fala-linha:last-child { border-bottom: none; }
.corpo-lista { margin-top: 12px; }
.corpo-linha { font-size: 12px; color: var(--text-faint); line-height: 1.6; margin-bottom: 4px; }
.vazio-aviso { font-size: 12px; color: var(--text-faint); text-align: center; margin-top: 20px; }

.historico-card {
  background: rgba(35,32,26,0.02); border: 1px solid rgba(35,32,26,0.06);
  border-radius: 16px; padding: 18px; margin-top: 16px;
}
.historico-lista { display: flex; flex-wrap: wrap; gap: 6px; }
.historico-item {
  padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(35,32,26,0.08);
  background: rgba(35,32,26,0.03); color: var(--text-soft); font-size: 11px; font-weight: 700;
  cursor: pointer; font-family: inherit; transition: background .18s, border-color .18s;
}
.historico-item:hover { background: rgba(35,32,26,0.06); }
.historico-item.selecionado { border-color: var(--cyan); color: var(--cyan); }

.footer { text-align: center; padding: 20px 0; color: var(--text-faint); font-size: 12px; }

@media (max-width: 768px) {
  .shell { padding: 16px 14px 32px; }
  .hero { padding: 20px 18px; border-radius: 20px; }
}
</style>

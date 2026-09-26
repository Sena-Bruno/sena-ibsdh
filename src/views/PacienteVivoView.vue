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

        <div class="como-funciona">
          <span><strong>1.</strong> Você prescreve</span>
          <span class="cf-seta">→</span>
          <span><strong>2.</strong> O motor simula os 7 dias</span>
          <span class="cf-seta">→</span>
          <span><strong>3.</strong> O paciente volta mudado</span>
        </div>

        <div class="sessao-grid">
          <div class="painel-paciente">
            <AvatarPaciente3D
              v-if="avatar3dDisponivel"
              :parametros="parametrosAvatar3D"
              :falando="falandoAvatar"
              :reduzir-movimento="prefs.movimento"
              @indisponivel="avatar3dDisponivel = false"
            />
            <AvatarPaciente v-else :sinais="sinaisAvatar" :falando="falandoAvatar" :reduzir-movimento="prefs.movimento" />
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
            <p class="painel-intro">
              O que você combina aqui vira os próximos 7 dias do paciente. Ele volta na sessão
              seguinte já tendo vivido a semana com esta tarefa — ou sem ela.
            </p>

            <label class="campo-label" for="pvTipo">Tipo</label>
            <select id="pvTipo" v-model="prescricao.tipo" class="campo-input">
              <option v-for="t in TIPOS_PRESCRICAO" :key="t.valor" :value="t.valor">{{ t.rotulo }}</option>
            </select>
            <p v-if="tipoSelecionado" class="campo-ajuda">{{ tipoSelecionado.descricao }}</p>

            <template v-if="prescricao.tipo !== 'NENHUMA'">
              <label class="campo-label">
                Especificidade — {{ rotuloEspecificidade }} ({{ prescricao.especificidade.toFixed(2) }})
              </label>
              <input type="range" min="0" max="1" step="0.05" v-model.number="prescricao.especificidade" />
              <p class="campo-ajuda">
                Quão executável é o pedido, sem o paciente precisar interpretar o que você quis dizer.
                Mexa no controle e veja como a mesma tarefa fica em cada nível:
              </p>
              <p v-if="exemploEspecificidade" class="campo-exemplo">"{{ exemploEspecificidade }}"</p>
              <p class="campo-ajuda">Vago também é cumprido bem menos — o paciente inventa a própria versão da tarefa.</p>

              <label class="campo-label">
                Carga pedida — {{ rotuloCarga }} ({{ prescricao.carga.toFixed(2) }})
              </label>
              <input type="range" min="0" max="1" step="0.05" v-model.number="prescricao.carga" />
              <p class="campo-ajuda" :class="{ 'campo-ajuda-alerta': cargaExcedida }">
                <template v-if="perfilAtual">
                  Este perfil tolera bem cargas até ~{{ perfilAtual.carga_tolerada.toFixed(2) }} numa
                  semana.
                  <template v-if="cargaExcedida">
                    Esta carga passa esse teto — o risco de falha sobe bastante, e falhar pode deixar
                    o paciente pior do que se nada tivesse sido prescrito.
                  </template>
                </template>
              </p>

              <label class="checkbox-label">
                <input type="checkbox" v-model="prescricao.plano_de_seguranca" />
                Combinou plano de segurança
              </label>
              <p class="campo-ajuda campo-ajuda-recuada">
                O que fazer se piorar e a quem recorrer. Só muda muito o resultado quando o risco do
                paciente já está alto — mas aí muda mais que qualquer outra escolha aqui.
              </p>
            </template>
            <p v-else class="campo-ajuda">
              Sem tarefa nenhuma: a semana roda só com a vida do paciente, sem sua intervenção direta.
            </p>

            <div v-if="erroSemana" class="alert" role="alert">{{ erroSemana }}</div>
            <button class="btn-primario" :disabled="avancando" @click="avancarSemana">
              {{ avancando ? 'Simulando semana...' : 'Avançar semana →' }}
            </button>
            <p class="painel-rodape">Isto simula os 7 dias inteiros e abre a próxima sessão.</p>
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
import { sinaisReaisParaAvatar, calcularParametrosAvatar3D } from '../composables/sinaisCorporais.js'
import LoginModal from '../components/LoginModal.vue'
import AvatarPaciente from '../components/AvatarPaciente.vue'
import AvatarPaciente3D from '../components/AvatarPaciente3D.vue'
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

// `descricao` é texto de apoio para o instrutor decidir o tipo — não é
// lido pelo motor (nucleo/sena_nucleo/prescricao.py só usa `valor`) e não
// tem número nenhum, só o que a tarefa pede e o que ela tende a mover.
const TIPOS_PRESCRICAO = [
  {
    valor: 'NENHUMA',
    rotulo: 'Nenhuma — só observar',
    descricao: 'Sem tarefa. Útil para ver como a semana passa sem nenhuma intervenção sua.',
  },
  {
    valor: 'RESPIRATORIA',
    rotulo: 'Regulação respiratória',
    descricao: 'Prática de respiração no dia a dia. Efeito suave e constante; não exige mudar a rotina.',
  },
  {
    valor: 'REGISTRO',
    rotulo: 'Registro / diário',
    descricao: 'Anotar pensamentos ou situações durante a semana. Abre espaço para a próxima sessão sem exigir mudança de comportamento.',
  },
  {
    valor: 'ATIVACAO_COMPORTAMENTAL',
    rotulo: 'Ativação comportamental',
    descricao: 'Uma atividade concreta a fazer apesar do desânimo. Bom potencial de ganho — e a mais sensível a pedir carga acima do que o paciente aguenta.',
  },
  {
    valor: 'ANCORAGEM',
    rotulo: 'Ancoragem',
    descricao: 'Técnica de estabilização para praticar sozinho. Funciona melhor quando já existe alguma confiança no processo.',
  },
  {
    valor: 'EXPOSICAO_GRADUAL',
    rotulo: 'Exposição gradual',
    descricao: 'Aproximar-se, pouco a pouco, do que o paciente evita. Ganho grande quando bem dosada, mas é a que mais pune o excesso de carga.',
  },
  {
    valor: 'PSICOEDUCACAO',
    rotulo: 'Psicoeducação',
    descricao: 'Explicar o que está acontecendo e por quê. Fortalece a aliança terapêutica; efeito mais lento, risco baixo.',
  },
  {
    valor: 'CONTENCAO',
    rotulo: 'Contenção',
    descricao: 'Foco em segurança e redução imediata de risco. Prioridade quando o paciente está em sofrimento agudo.',
  },
]

// "Especificidade 0.50" não diz nada sozinho — o que ajuda a entender é ver
// a MESMA tarefa escrita em três níveis de precisão. As frases mudam por
// tipo (a de RESPIRATORIA não serve pra ilustrar CONTENCAO), e dentro de
// cada tipo vão de "tente fazer algo" (vaga) a hora, lugar e quantidade
// marcados (muito específica) — a mesma escala 0-1 que viaja para a API,
// só que como exemplo em vez de número.
const EXEMPLOS_ESPECIFICIDADE = {
  RESPIRATORIA: [
    'Tente respirar fundo quando lembrar durante a semana.',
    'Pratique respiração profunda uma vez por dia.',
    'Às 7h e às 22h, sentado, seis ciclos de respiração 4-7-8.',
  ],
  REGISTRO: [
    'Anote como você está se sentindo de vez em quando.',
    'Escreva no diário todo fim de dia.',
    'Todo dia às 21h, escreva três frases: o que aconteceu, o que sentiu, o que pensou.',
  ],
  ATIVACAO_COMPORTAMENTAL: [
    'Tente fazer alguma coisa diferente essa semana.',
    'Saia de casa pelo menos três vezes na semana.',
    'Terça, quinta e sábado às 16h, caminhe 10 minutos até a praça e volte.',
  ],
  ANCORAGEM: [
    'Use a técnica de ancoragem quando precisar.',
    'Pratique a ancoragem uma vez por dia.',
    'Ao acordar, sentado, cinco minutos: nomeie 5 coisas que vê, 4 que ouve, 3 que sente.',
  ],
  EXPOSICAO_GRADUAL: [
    'Tente se aproximar do que te incomoda.',
    'Encare uma situação leve da lista dois dias na semana.',
    'Segunda e quinta às 18h, fique 5 minutos no primeiro degrau da lista de exposição.',
  ],
  PSICOEDUCACAO: [
    'Pense sobre o que a gente conversou.',
    'Releia o material que passei uma vez essa semana.',
    'Leia uma página do material toda noite antes de dormir e anote uma dúvida.',
  ],
  CONTENCAO: [
    'Se piorar, tente se acalmar.',
    'Se piorar, use o plano de segurança combinado.',
    'Se a angústia passar de 8, ligue para o contato combinado e vá para o lugar seguro combinado.',
  ],
}

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
// Corpo inteiro em 3D por padrão (ver AvatarPaciente3D.vue); cai para o
// busto 2D (AvatarPaciente.vue) só se o navegador não der WebGL — ver o
// @indisponivel emitido pelo componente 3D logo abaixo no template.
const avatar3dDisponivel = ref(true)
const parametrosAvatar3D = computed(() =>
  sinaisAvatar.value ? calcularParametrosAvatar3D(sinaisAvatar.value) : null
)

// Os sliders de prescrição são 0–1 puros (ver Prescricao em prescricao.py) —
// sem tradução, "0.65" não diz nada para quem não abriu o motor. Estas
// faixas são só rótulo de apoio na tela; o número exato continua visível
// e é o que de fato viaja para a API.
function indiceFaixa(valor) {
  if (valor < 0.34) return 0
  if (valor < 0.67) return 1
  return 2
}
function rotuloFaixa(valor, opcoes) {
  return opcoes[indiceFaixa(valor)]
}
const rotuloEspecificidade = computed(() =>
  rotuloFaixa(prescricao.especificidade, ['vaga', 'razoável', 'muito específica'])
)
const rotuloCarga = computed(() => rotuloFaixa(prescricao.carga, ['leve', 'moderada', 'pesada']))
const tipoSelecionado = computed(() => TIPOS_PRESCRICAO.find((t) => t.valor === prescricao.tipo))

// O exemplo muda junto com o slider — é o que faz "especificidade" parar
// de ser um número abstrato e virar "ah, é ISSO que 0.85 significa aqui".
const exemploEspecificidade = computed(() => {
  const exemplos = EXEMPLOS_ESPECIFICIDADE[prescricao.tipo]
  return exemplos ? exemplos[indiceFaixa(prescricao.especificidade)] : null
})

// `carga_tolerada` já vem de GET /perfis (ver api.py, listar_perfis) — é
// o teto real que o motor usa (excesso_de_carga em prescricao.py), não uma
// estimativa da tela. Mostrar isso aqui é o que falta pra virar a mesma
// lição do nucleo/README.md ("dose errada é clinicamente errada") em algo
// visível ANTES de avançar a semana, não só depois na Ficha do Supervisor.
const perfilAtual = computed(() => (paciente.value ? perfis.value[paciente.value.perfil] : null))
const cargaExcedida = computed(
  () => !!perfilAtual.value && prescricao.carga > perfilAtual.value.carga_tolerada
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
  --text: #23201a; --text-soft: #5c5647; --text-faint: #786f5e; --cyan: #0a7566;
  --gold: #9c5700; --success: #1c7a33; --danger: #c93f24;
  --border: rgba(35,32,26,0.12); --shadow: 0 1px 2px rgba(35,32,26,0.06),0 24px 48px rgba(35,32,26,0.14);
  font-family: 'Inter', sans-serif; min-height: 100vh;
  background: radial-gradient(ellipse at bottom right, rgba(10,117,102,0.14), transparent 32%),
    radial-gradient(ellipse at top left, rgba(156,87,0,0.07), transparent 34%),
    linear-gradient(180deg,#faf8f4,#f1ece2);
  color: var(--text); line-height: 1.6;
}
.shell { max-width: 880px; margin: 0 auto; padding: 28px 18px 48px; }
.btn-voltar {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 10px;
  border: 1px solid rgba(35,32,26,0.12); background: #ffffff;
  color: var(--text-soft); font-size: 12px; font-weight: 600; text-decoration: none; margin-bottom: 16px;
  transition: all .18s;
}
.btn-voltar:hover { background: rgba(10,117,102,0.06); border-color: rgba(10,117,102,0.3); color: var(--cyan); }
.hero {
  position: relative; overflow: hidden;
  background: linear-gradient(155deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.9) 55%, rgba(10,117,102,0.1) 100%);
  border: 1px solid rgba(35,32,26,0.14); border-radius: 24px; padding: 28px; margin-bottom: 22px;
  box-shadow: var(--shadow);
}
.hero::before { content: ''; position: absolute; top: -60px; right: -60px; width: 180px; height: 180px; border-radius: 999px; background: radial-gradient(circle, rgba(10,117,102,0.16), transparent 70%); }
.eyebrow {
  position: relative; display: inline-flex; align-items: center; gap: 7px; padding: 5px 11px; border-radius: 999px;
  background: rgba(10,117,102,0.1); border: 1px solid rgba(10,117,102,0.25);
  color: var(--cyan); font-size: 10px; font-weight: 700; letter-spacing: .13em; text-transform: uppercase;
  margin-bottom: 12px;
}
h1 { position: relative; font-size: clamp(24px, 5vw, 36px); font-weight: 800; letter-spacing: -.03em; margin-bottom: 6px; }
.sub { position: relative; color: var(--text-soft); font-size: 14px; max-width: 60ch; }

.aviso-card, .setup-card, .loading {
  background: #ffffff; border: 1px solid rgba(35,32,26,0.1);
  border-radius: 18px; padding: 22px; margin-bottom: 18px;
  box-shadow: 0 1px 2px rgba(35,32,26,0.04), 0 8px 20px rgba(35,32,26,0.05);
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
.campo-input:focus { border-color: rgba(10,117,102,0.35); }
.checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-soft); margin-top: 12px; }

.painel-intro { font-size: 12px; color: var(--text-faint); line-height: 1.6; margin-bottom: 14px; }
.campo-ajuda { font-size: 11px; color: var(--text-faint); line-height: 1.55; margin-top: 5px; }
.campo-exemplo {
  font-size: 12px; color: var(--text); font-style: italic; line-height: 1.6;
  background: rgba(10,117,102,0.06); border-left: 3px solid var(--cyan);
  border-radius: 6px; padding: 8px 10px; margin: 6px 0;
}
.campo-ajuda-recuada { margin-top: 4px; margin-left: 24px; }
.campo-ajuda-alerta { color: var(--gold); font-weight: 600; }
.painel-rodape { font-size: 11px; color: var(--text-faint); text-align: center; margin-top: 10px; }

.perfil-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin-top: 4px; }
.perfil-card {
  text-align: left; background: rgba(35,32,26,0.02); border: 1px solid rgba(35,32,26,0.07);
  border-radius: 12px; padding: 12px; cursor: pointer; color: inherit; font-family: inherit;
  transition: border-color .18s, background .18s;
}
.perfil-card:hover { background: rgba(35,32,26,0.04); }
.perfil-card.selecionado { border-color: var(--cyan); background: rgba(10,117,102,0.08); }
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

.alert { padding: 10px 14px; border-radius: 10px; background: rgba(201,63,36,0.1); color: var(--danger); font-size: 12px; margin-top: 14px; }

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

.como-funciona {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  font-size: 12px; color: var(--text-soft); background: rgba(10,117,102,0.06);
  border: 1px solid rgba(10,117,102,0.16); border-radius: 12px; padding: 10px 14px; margin-bottom: 16px;
}
.como-funciona strong { color: var(--cyan); }
.cf-seta { color: var(--text-faint); }

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

<template>
  <div class="page">
    <!-- Identificação -->
    <LoginModal v-if="!logado" @success="aoLogar" />

    <div class="shell" v-else>
      <router-link class="btn-voltar" to="/dashboard.html">← Voltar ao painel</router-link>

      <!-- ── ABERTURA ─────────────────────────────────────────────── -->
      <template v-if="etapa === 'intro'">
        <div class="hero">
          <div class="eyebrow">Plantão clínico</div>
          <h1>Modo Plantão</h1>
          <p class="sub">
            Três pacientes em sequência, cada um com tempo próprio. Você lê o caso
            e registra a condução antes do tempo acabar. É treino de decisão sob
            pressão — não vale pela beleza do texto, vale pelo que você faz primeiro.
          </p>
        </div>

        <div class="card regras">
          <div class="card-title">Como funciona</div>
          <ul>
            <li><strong>{{ CASOS }} casos</strong> em sequência, sem voltar atrás.</li>
            <li><strong>{{ Math.round(SEGUNDOS / 60) }} minutos por caso.</strong> Ao esgotar, o que estiver escrito é enviado.</li>
            <li>Avaliação focada em <strong>priorização, condução, segurança e adaptação ao perfil</strong>.</li>
            <li>Fica no seu histórico de plantões, mas <strong>não conta para a certificação</strong>.</li>
          </ul>
        </div>

        <div v-if="erro" class="aviso-erro" role="alert">
          {{ erro }}
          <div v-if="erroDetalhe" class="detalhe-erro">{{ erroDetalhe }}</div>
        </div>

        <button type="button" class="btn-principal" :disabled="carregando" @click="iniciarPlantao">
          {{ carregando ? 'Preparando plantão...' : 'Iniciar plantão →' }}
        </button>

        <!-- Histórico -->
        <div v-if="turnos.length" class="card historico">
          <div class="card-title">Plantões anteriores</div>
          <div class="turno" v-for="t in turnos" :key="t.id_plantao">
            <div class="turno-data">{{ formatarData(t.data) }}</div>
            <div class="turno-notas">
              <!-- A nota aparecia colorida de verde ou vermelho, e era só a
                   cor que dizia se o caso foi aprovado — falha de 1.4.1
                   (Uso de cor). O texto oculto carrega a mesma informação. -->
              <span v-for="c in t.casos" :key="c.numero"
                    class="pill" :class="pillClasse(c.nota)">
                {{ c.nota === null ? '—' : c.nota.toFixed(1) }}
                <span class="sr-only">{{ rotuloPill(c.nota) }}</span>
              </span>
            </div>
            <div class="turno-media">
              {{ t.media === null ? 'sem casos concluídos' : 'média ' + t.media.toFixed(1) }}
            </div>
          </div>
        </div>
      </template>

      <!-- ── CASO EM ANDAMENTO ────────────────────────────────────── -->
      <template v-else-if="etapa === 'caso'">
        <div class="barra-turno">
          <!-- "concluído / atual / pendente" era comunicado só por cor
               (verde/vermelho/cinza) — falha de 1.4.1. O texto para leitor de
               tela e o aria-current dizem o mesmo sem depender de cor. -->
          <ol class="passos" aria-label="Progresso do turno">
            <li
              v-for="n in totalCasos" :key="n"
              class="passo"
              :aria-current="n === casoAtual + 1 ? 'step' : undefined"
              :class="{ feito: n < casoAtual + 1, atual: n === casoAtual + 1 }"
            >{{ n }}<span class="sr-only">
              {{ n < casoAtual + 1 ? ' — concluído' : n === casoAtual + 1 ? ' — caso atual' : ' — pendente' }}
            </span></li>
          </ol>
          <!-- Um cronômetro que só muda de cor no último minuto avisa apenas
               quem está olhando para ele. role="timer" com aria-live="off"
               evita a leitura a cada segundo; o aviso vem da região abaixo,
               que só fala nos marcos (1 minuto e tempo esgotado). -->
          <div class="cronometro" role="timer" aria-live="off"
               :aria-label="'Tempo restante: ' + formatarTempo(segundosRestantes)"
               :class="{ alerta: segundosRestantes <= 60, esgotado: segundosRestantes === 0 }">
            {{ formatarTempo(segundosRestantes) }}
          </div>
          <p class="sr-only" role="status">{{ avisoTempo }}</p>
        </div>

        <div class="card caso">
          <div class="caso-topo">
            <div class="caso-num">Caso {{ casoAtual + 1 }} de {{ totalCasos }}</div>
            <div class="caso-urgencia" :class="'urg-' + caso.urgencia.toLowerCase()">{{ caso.urgencia }}</div>
          </div>
          <div class="caso-perfil">{{ caso.perfil }}</div>
          <p class="caso-queixa">{{ caso.queixa }}</p>
          <p class="caso-desc">{{ caso.descricao }}</p>
          <div class="caso-label">Resistências esperadas</div>
          <ul class="caso-resist">
            <li v-for="(r, i) in caso.resistencias" :key="i">{{ r }}</li>
          </ul>
        </div>

        <div class="card">
          <div class="card-title">Sua condução</div>
          <label class="sr-only" for="plantaoResposta">Sua condução para este caso</label>
          <textarea
            id="plantaoResposta"
            ref="respostaRef"
            v-model="resposta"
            class="resposta"
            aria-describedby="plantaoContador"
            :disabled="avaliando"
            placeholder="O que você faz primeiro? Como conduz? O que observa e o que não pode passar?"
          ></textarea>
          <div class="resposta-rodape">
            <span class="contador" id="plantaoContador" :class="{ ok: resposta.trim().length >= MIN_CHARS }">
              {{ resposta.trim().length }} caracteres · mínimo {{ MIN_CHARS }}
            </span>
            <button
              type="button"
              class="btn-principal btn-enviar"
              :disabled="avaliando || resposta.trim().length < MIN_CHARS"
              @click="enviarCaso(false)"
            >{{ avaliando ? 'Avaliando...' : 'Encerrar caso →' }}</button>
          </div>
        </div>
      </template>

      <!-- ── RESULTADO DO CASO ────────────────────────────────────── -->
      <template v-else-if="etapa === 'resultado'">
        <div class="card resultado">
          <div class="card-title">Caso {{ casoAtual + 1 }} · {{ ultimo.perfil }}</div>

          <template v-if="ultimo.respondido">
            <div class="nota-grande" :class="ultimo.aprovado ? 'ok' : 'baixa'">
              {{ ultimo.nota.toFixed(1) }}<span class="nota-de">/10</span>
            </div>
            <div class="nota-sub">{{ ultimo.aprovado ? 'Condução adequada' : 'Abaixo da mínima (' + ultimo.nota_minima + ')' }}</div>

            <div class="bloco">
              <div class="bloco-label ok">O que funcionou</div>
              <p>{{ ultimo.fortes }}</p>
            </div>
            <div class="bloco">
              <div class="bloco-label atencao">Pontos de atenção</div>
              <p>{{ ultimo.atencao }}</p>
            </div>
            <div class="bloco">
              <div class="bloco-label proximo">Próximo passo</div>
              <p>{{ ultimo.proximo_passo }}</p>
            </div>
          </template>

          <template v-else>
            <div class="nao-concluido">{{ ultimo.mensagem }}</div>
            <div v-if="ultimo.detalhe" class="detalhe-erro">{{ ultimo.detalhe }}</div>
          </template>
        </div>

        <button type="button" class="btn-principal" @click="proximoCaso">
          {{ casoAtual + 1 < totalCasos ? 'Próximo caso →' : 'Ver resumo do plantão →' }}
        </button>
      </template>

      <!-- ── RESUMO DO TURNO ──────────────────────────────────────── -->
      <template v-else-if="etapa === 'resumo'">
        <div class="hero">
          <div class="eyebrow">Plantão encerrado</div>
          <h1>{{ mediaTurno === null ? 'Turno sem casos concluídos' : 'Média do turno: ' + mediaTurno.toFixed(1) }}</h1>
          <p class="sub">{{ mensagemResumo }}</p>
        </div>

        <div class="card" v-for="(r, i) in resultados" :key="i">
          <div class="resumo-linha">
            <div>
              <div class="card-title" style="margin-bottom:2px;">Caso {{ i + 1 }} · {{ r.perfil }}</div>
              <div class="resumo-status">{{ r.respondido ? (r.aprovado ? 'Adequada' : 'Abaixo da mínima') : 'Não concluído' }}</div>
            </div>
            <div class="resumo-nota" :class="r.respondido ? (r.aprovado ? 'ok' : 'baixa') : 'vazio'">
              {{ r.respondido ? r.nota.toFixed(1) : '—' }}
            </div>
          </div>
          <template v-if="r.respondido">
            <p class="resumo-fb"><strong>Atenção:</strong> {{ r.atencao }}</p>
          </template>
        </div>

        <button type="button" class="btn-principal" @click="reiniciar">Novo plantão</button>
        <router-link class="btn-secundario" to="/dashboard.html">Voltar ao painel</router-link>
      </template>

      <div class="footer">IBSDH — Instituto Bruno Sena de Desenvolvimento Humano</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { callApi, TIMEOUT_IA_MS } from '../composables/useApi'
import { estaAutenticado, getToken, limparSessao, pareceErroDeSessao } from '../composables/useAuth'
import LoginModal from '../components/LoginModal.vue'

const route = useRoute()

const MIN_CHARS = 50
const CASOS = 3
const SEGUNDOS = 300

const etapa = ref('intro')          // intro | caso | resultado | resumo
const carregando = ref(false)
const avaliando = ref(false)
const erro = ref('')
const erroDetalhe = ref('')
const inicioPendente = ref(false)

const logado = ref(false)
const respostaRef = ref(null)

const idPlantao = ref('')
const casos = ref([])
const casoAtual = ref(0)
const resposta = ref('')
const resultados = ref([])
const ultimo = ref(null)
const turnos = ref([])

const segundosRestantes = ref(SEGUNDOS)
let intervalo = null

const caso = computed(() => casos.value[casoAtual.value] || {})
const totalCasos = computed(() => casos.value.length || CASOS)
const concluidos = computed(() => resultados.value.filter(r => r.respondido).length)
const mediaTurno = computed(() => {
  const notas = resultados.value.filter(r => r.respondido).map(r => r.nota)
  if (!notas.length) return null
  return Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10
})

// O resumo precisa ser honesto: uma média boa pode esconder um caso abaixo da
// mínima ou um caso sem condução registrada. Num treino clínico, elogiar por
// cima disso passa a mensagem errada.
const mensagemResumo = computed(() => {
  const total = totalCasos.value
  const naoConcluidos = total - concluidos.value
  const abaixo = resultados.value.filter(r => r.respondido && !r.aprovado).length

  const partes = [`${concluidos.value} de ${total} casos concluídos.`]

  if (naoConcluidos > 0) {
    partes.push(naoConcluidos === 1
      ? 'Um caso ficou sem condução registrada.'
      : `${naoConcluidos} casos ficaram sem condução registrada.`)
  }
  if (abaixo > 0) {
    partes.push(abaixo === 1
      ? 'Um caso ficou abaixo da nota mínima.'
      : `${abaixo} casos ficaram abaixo da nota mínima.`)
  }

  if (naoConcluidos === 0 && abaixo === 0 && mediaTurno.value !== null) {
    partes.push('Turno conduzido bem do início ao fim.')
  } else {
    partes.push('Revise os pontos de atenção antes do próximo turno.')
  }

  return partes.join(' ')
})

const cursoAtual = () => route.query.curso || 'Practitioner'

// ── Cronômetro ──────────────────────────────────────────────────────
function iniciarCronometro(segundos) {
  pararCronometro()
  segundosRestantes.value = segundos
  intervalo = setInterval(() => {
    segundosRestantes.value--
    if (segundosRestantes.value <= 0) {
      pararCronometro()
      segundosRestantes.value = 0
      enviarCaso(true)   // tempo esgotado: envia o que houver
    }
  }, 1000)
}
function pararCronometro() {
  if (intervalo) { clearInterval(intervalo); intervalo = null }
}
onUnmounted(pararCronometro)

// Só os marcos são anunciados. Uma região viva que fala a cada segundo é
// inutilizável com leitor de tela.
const avisoTempo = computed(() => {
  if (segundosRestantes.value === 0) return 'Tempo esgotado. A resposta escrita foi enviada.'
  if (segundosRestantes.value === 60) return 'Um minuto restante.'
  return ''
})

// Mesma regra de aprovação de pillClasse, em palavras.
function rotuloPill(nota) {
  if (nota === null) return ' — caso não concluído'
  return pillClasse(nota) === 'ok' ? ' — adequada' : ' — abaixo da mínima'
}

function formatarTempo(s) {
  const m = Math.floor(s / 60)
  const r = s % 60
  return m + ':' + String(r).padStart(2, '0')
}

function formatarData(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d) ? String(iso).slice(0, 10)
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function pillClasse(nota) {
  if (nota === null) return 'vazio'
  return nota >= 7 ? 'ok' : 'baixa'
}

// ── Login ───────────────────────────────────────────────────────────
function aoLogar() {
  logado.value = true
  carregarHistorico()
  // O modal interrompeu um "Iniciar plantão": retoma de onde parou, em vez de
  // devolver o aluno à tela inicial para clicar de novo.
  if (inicioPendente.value) {
    inicioPendente.value = false
    iniciarPlantao()
  }
}

function garantirLogado() {
  if (estaAutenticado()) {
    logado.value = true
    return true
  }
  logado.value = false
  return false
}

// ── Fluxo ───────────────────────────────────────────────────────────
async function carregarHistorico() {
  try {
    const data = await callApi({
      action: 'plantao_historico', token: getToken(), curso: cursoAtual()
    })
    if (data && data.erro && pareceErroDeSessao(data.mensagem)) {
      limparSessao()
      logado.value = false
      return
    }
    turnos.value = data.turnos || []
  } catch (e) { /* histórico é acessório: falhar aqui não bloqueia o plantão */ }
}

async function iniciarPlantao() {
  erro.value = ''
  erroDetalhe.value = ''
  if (!garantirLogado()) {
    inicioPendente.value = true
    return
  }
  carregando.value = true
  try {
    const data = await callApi({ action: 'plantao_gerar', curso: cursoAtual() })
    if (data.erro || !data.casos || !data.casos.length) {
      throw new Error(data.mensagem || 'Não foi possível montar o plantão.')
    }
    idPlantao.value = data.id_plantao
    casos.value = data.casos
    casoAtual.value = 0
    resultados.value = []
    resposta.value = ''
    etapa.value = 'caso'
    iniciarCronometro(data.segundos_por_caso || SEGUNDOS)
    nextTick(() => respostaRef.value && respostaRef.value.focus())
  } catch (e) {
    // A causa real vem do backend; escondê-la só dificulta o diagnóstico.
    erro.value = 'Não foi possível iniciar o plantão. Tente novamente.'
    erroDetalhe.value = e && e.message ? String(e.message) : ''
  } finally {
    carregando.value = false
  }
}

async function enviarCaso(expirou) {
  if (avaliando.value) return
  avaliando.value = true
  pararCronometro()

  const gasto = (caso.value.segundos || SEGUNDOS) - segundosRestantes.value

  try {
    const data = await callApi({
      action: 'plantao_avaliar',
      dados: {
        token: getToken(),
        curso: cursoAtual(),
        id_plantao: idPlantao.value,
        numero: casoAtual.value + 1,
        perfil: caso.value.perfil,
        queixa: caso.value.queixa,
        resposta: resposta.value,
        tempo_seg: gasto,
        expirou: !!expirou
      }
    }, { timeoutMs: TIMEOUT_IA_MS })

    if (data.erro) throw new Error(data.mensagem)
    ultimo.value = data
  } catch (e) {
    // Sem avaliação, o caso não some do turno: entra como não concluído.
    // O detalhe é o texto que o backend mandou — é ele que diz o que quebrou.
    ultimo.value = {
      respondido: false,
      perfil: caso.value.perfil,
      mensagem: 'Não foi possível avaliar este caso agora. Ele fica registrado como não concluído.',
      detalhe: e && e.message ? String(e.message) : ''
    }
  } finally {
    resultados.value.push({ ...ultimo.value, perfil: caso.value.perfil })
    avaliando.value = false
    etapa.value = 'resultado'
  }
}

function proximoCaso() {
  if (casoAtual.value + 1 < totalCasos.value) {
    casoAtual.value++
    resposta.value = ''
    etapa.value = 'caso'
    iniciarCronometro(casos.value[casoAtual.value].segundos || SEGUNDOS)
    nextTick(() => respostaRef.value && respostaRef.value.focus())
  } else {
    etapa.value = 'resumo'
    carregarHistorico()
  }
}

function reiniciar() {
  etapa.value = 'intro'
  resultados.value = []
  resposta.value = ''
  casoAtual.value = 0
}

// Carrega histórico logo de cara se já houver uma sessão válida
if (estaAutenticado()) {
  logado.value = true
  carregarHistorico()
}

document.title = 'SENA | Modo Plantão'
</script>

<style scoped>
* { margin:0;padding:0;box-sizing:border-box; }

/* Fundo no wrapper full-width; largura máxima no .shell */
.page {
  --text:#23201a;--text-soft:#5c5647;--text-faint:#786f5e;
  --cyan:#0a7566;--gold:#9c5700;--success:#1c7a33;--danger:#c93f24;
  --border:rgba(35,32,26,0.12);--shadow:0 1px 2px rgba(35,32,26,0.06),0 24px 48px rgba(35,32,26,0.14);
  font-family:'Inter',sans-serif; min-height:100vh; color:var(--text); line-height:1.6;
  background:radial-gradient(ellipse at top left,rgba(201,63,36,0.13),transparent 32%),radial-gradient(ellipse at bottom right,rgba(156,87,0,0.08),transparent 34%),linear-gradient(180deg,#faf8f4,#f1ece2);
}
.shell { max-width:680px;margin:0 auto;padding:28px 18px 48px; }

.btn-voltar {
  display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;
  border:1px solid rgba(35,32,26,0.12);background:#ffffff;
  color:var(--text-soft);font-size:12px;font-weight:600;text-decoration:none;margin-bottom:16px;
  transition:all .18s;
}
.btn-voltar:hover { background:rgba(201,63,36,0.06);border-color:rgba(201,63,36,0.3);color:var(--danger); }

.hero {
  position:relative;overflow:hidden;
  background:linear-gradient(135deg,rgba(201,63,36,0.1),rgba(156,87,0,0.05)),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(250,248,244,0.99));
  border:1px solid rgba(201,63,36,0.22);border-radius:24px;padding:28px;margin-bottom:18px;box-shadow:var(--shadow);
}
.hero::before { content:'';position:absolute;top:-60px;right:-60px;width:180px;height:180px;border-radius:999px;background:radial-gradient(circle,rgba(201,63,36,0.18),transparent 70%); }
.eyebrow {
  position:relative;display:inline-flex;align-items:center;gap:7px;padding:5px 11px;border-radius:999px;
  background:rgba(201,63,36,0.12);border:1px solid rgba(201,63,36,0.25);color:#c93f24;
  font-size:10px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;margin-bottom:12px;
}
.eyebrow::before { content:'';width:6px;height:6px;border-radius:999px;background:#c93f24;box-shadow:0 0 8px rgba(201,63,36,0.55); }
h1 { position:relative;font-size:clamp(24px,5vw,34px);font-weight:800;letter-spacing:-.03em;margin-bottom:8px; }
.sub { position:relative;color:var(--text-soft);font-size:14px; }

.card {
  position:relative;background:#ffffff;border:1px solid rgba(35,32,26,0.1);
  border-radius:18px;padding:20px 20px 20px 24px;margin-bottom:14px;
  box-shadow:0 1px 2px rgba(35,32,26,0.04),0 8px 20px rgba(35,32,26,0.05);
}
.card::before { content:'';position:absolute;left:0;top:14px;bottom:14px;width:4px;border-radius:999px;background:linear-gradient(180deg,var(--danger),var(--gold)); }
.card-title {
  font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;
  color:var(--text-faint);margin-bottom:12px;
}
.regras ul { list-style:none;display:grid;gap:9px; }
.regras li { font-size:13px;color:var(--text-soft);padding-left:16px;position:relative; }
.regras li::before { content:'·';position:absolute;left:4px;color:var(--danger);font-weight:800; }

.aviso-erro {
  padding:12px 14px;border-radius:12px;border:1px solid rgba(201,63,36,0.25);
  background:rgba(201,63,36,0.06);color:#c93f24;font-size:13px;margin-bottom:12px;
}

/* Mensagem técnica que veio do backend: discreta, mas visível — é ela que
   diz o que quebrou quando a avaliação falha. */
.detalhe-erro {
  margin-top:8px;font-size:11.5px;line-height:1.45;color:var(--text-faint);
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
  word-break:break-word;text-align:left;
}

.btn-principal {
  width:100%;padding:15px;border-radius:12px;border:none;
  background:var(--danger);color:#ffffff;
  font-family:inherit;font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
  cursor:pointer;transition:transform .15s,opacity .15s;
}
.btn-principal:hover:not(:disabled) { transform:translateY(-1px); }
.btn-principal:disabled { opacity:.45;cursor:not-allowed;transform:none; }
.btn-secundario {
  display:block;width:100%;margin-top:10px;padding:13px;border-radius:12px;text-align:center;
  border:1px solid var(--border);background:transparent;color:var(--text-soft);
  font-size:12px;font-weight:700;text-decoration:none;
}

/* ── Barra do turno ─────────────────────────────────────────────── */
.barra-turno { display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px; }
.passos { display:flex;gap:8px;list-style:none;margin:0;padding:0; }
.passo {
  width:28px;height:28px;border-radius:9px;display:grid;place-items:center;
  font-size:12px;font-weight:800;color:var(--text-faint);
  background:rgba(35,32,26,0.04);border:1px solid rgba(35,32,26,0.07);
}
.passo.feito { color:var(--success);border-color:rgba(28,122,51,0.3);background:rgba(28,122,51,0.08); }
.passo.atual { color:var(--danger);border-color:rgba(201,63,36,0.4);background:rgba(201,63,36,0.1); }

.cronometro {
  font-family:'JetBrains Mono',monospace;font-size:24px;font-weight:700;
  color:var(--text);padding:4px 14px;border-radius:10px;
  background:rgba(35,32,26,0.03);border:1px solid var(--border);
  font-variant-numeric:tabular-nums;
}
.cronometro.alerta { color:var(--danger);border-color:rgba(201,63,36,0.4);background:rgba(201,63,36,0.08); }
.cronometro.esgotado { opacity:.5; }

/* ── Caso ───────────────────────────────────────────────────────── */
.caso-topo { display:flex;align-items:center;justify-content:space-between;margin-bottom:10px; }
.caso-num { font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text-faint); }
.caso-urgencia { font-size:10px;font-weight:800;padding:3px 9px;border-radius:999px;text-transform:uppercase;letter-spacing:.08em; }
.urg-alta { background:rgba(201,63,36,0.12);color:#c93f24;border:1px solid rgba(201,63,36,0.25); }
.urg-média, .urg-media { background:rgba(156,87,0,0.12);color:var(--gold);border:1px solid rgba(156,87,0,0.25); }
.caso-perfil { font-size:22px;font-weight:800;letter-spacing:-.02em;margin-bottom:8px; }
.caso-queixa { font-size:14px;color:var(--text);margin-bottom:10px;font-style:italic; }
.caso-desc { font-size:13px;color:var(--text-soft);line-height:1.7;margin-bottom:14px; }
.caso-label { font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text-faint);margin-bottom:6px; }
.caso-resist { list-style:none;display:grid;gap:5px; }
.caso-resist li { font-size:13px;color:#c93f24;padding-left:14px;position:relative; }
.caso-resist li::before { content:'';position:absolute;left:0;top:6px;width:5px;height:5px;border-radius:999px;background:currentColor; }

.resposta {
  width:100%;min-height:180px;resize:vertical;border-radius:12px;
  border:1px solid rgba(35,32,26,0.08);background:rgba(35,32,26,0.03);color:var(--text);
  padding:14px;font-family:inherit;font-size:14px;line-height:1.7;outline:none;
  transition:border-color .18s;
}
.resposta:focus { border-color:rgba(201,63,36,0.35); }
.resposta::placeholder { color:#8a8171; } /* era #4a5568 — 2.62:1, reprovava 1.4.3 */
.resposta-rodape { display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;flex-wrap:wrap; }
.contador { font-size:12px;color:var(--text-faint);font-variant-numeric:tabular-nums; }
.contador.ok { color:var(--success); }
.btn-enviar { width:auto;padding:12px 22px; }

/* ── Resultado ──────────────────────────────────────────────────── */
.nota-grande { font-size:56px;font-weight:800;letter-spacing:-.04em;line-height:1; }
.nota-grande.ok { color:var(--success); }
.nota-grande.baixa { color:var(--danger); }
.nota-de { font-size:20px;font-weight:600;color:var(--text-faint);margin-left:2px; }
.nota-sub { font-size:13px;color:var(--text-soft);margin:6px 0 18px; }
.bloco { margin-bottom:14px; }
.bloco-label { font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;margin-bottom:5px; }
.bloco-label.ok { color:var(--success); }
.bloco-label.atencao { color:var(--gold); }
.bloco-label.proximo { color:var(--cyan); }
.bloco p { font-size:13px;color:var(--text-soft);line-height:1.75; }
.nao-concluido { padding:20px;text-align:center;color:var(--text-faint);font-size:14px; }

/* ── Resumo ─────────────────────────────────────────────────────── */
.resumo-linha { display:flex;align-items:center;justify-content:space-between;gap:12px; }
.resumo-status { font-size:12px;color:var(--text-soft); }
.resumo-nota { font-size:26px;font-weight:800;font-variant-numeric:tabular-nums; }
.resumo-nota.ok { color:var(--success); }
.resumo-nota.baixa { color:var(--danger); }
.resumo-nota.vazio { color:var(--text-faint); }
.resumo-fb { font-size:12px;color:var(--text-soft);margin-top:10px;line-height:1.7; }
.resumo-fb strong { color:var(--gold); }

/* ── Histórico ──────────────────────────────────────────────────── */
.turno { display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(35,32,26,0.05);flex-wrap:wrap; }
.turno:last-child { border-bottom:none; }
.turno-data { font-size:12px;color:var(--text-soft);min-width:110px; }
.turno-notas { display:flex;gap:5px;flex:1; }
.pill {
  min-width:34px;text-align:center;padding:2px 7px;border-radius:7px;font-size:12px;font-weight:700;
  font-variant-numeric:tabular-nums;background:rgba(35,32,26,0.04);color:var(--text-faint);
}
.pill.ok { background:rgba(28,122,51,0.12);color:var(--success); }
.pill.baixa { background:rgba(201,63,36,0.12);color:var(--danger); }
.turno-media { font-size:12px;color:var(--text-faint); }

.footer { text-align:center;padding:22px 0;color:var(--text-faint);font-size:12px; }

@media (max-width: 480px) {
  .shell { padding:16px 14px 32px; }
  .hero { padding:20px 18px;border-radius:20px; }
  .card { padding:16px 14px; }
  .cronometro { font-size:20px; }
  .btn-enviar { width:100%; }
  .resposta-rodape { flex-direction:column;align-items:stretch; }
}
</style>

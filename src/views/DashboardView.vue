<template>
<div class="dash-page">
  <!-- LOADER ANIMADO -->
  <div class="loading-overlay" id="loadingEl">
    <div class="loader-logo">S</div>
    <div class="loader-text">Carregando</div>
  </div>

  <!-- MODAL EMAIL -->
  <div class="modal-overlay" id="modalOverlay">
    <div class="modal-card">
      <div class="modal-icon">S</div>
      <h2>Identificação do Aluno</h2>
      <p>Informe o e-mail da sua matrícula para acessar seu painel de progresso no SENA.</p>
      <input class="modal-input" type="email" id="emailInput" placeholder="seu@email.com" autocomplete="email" />
      <div class="modal-error" id="emailError"></div>
      <button class="btn-primary" id="btnConfirmarEmail" @click="confirmarEmail">Acessar meu painel</button>
      <div class="modal-note">IBSDH — Instituto Bruno Sena de Desenvolvimento Humano</div>
    </div>
  </div>

  <!-- MODAL ONBOARDING -->
  <div class="modal-overlay" id="onboardingModal">
    <div class="modal-card" style="max-width:500px;">
      <div class="modal-icon" style="background:rgba(110,231,255,0.1);border-color:rgba(110,231,255,0.2);color:var(--cyan);">👋</div>
      <h2>Bem-vindo ao SENA!</h2>
      <div id="onboardingSteps">
        <div class="onboard-step active">
          <p style="font-size:15px;">Este é o seu painel de progresso. Aqui você acompanha sua evolução clínica.</p>
          <div style="text-align:left;background:rgba(110,231,255,0.05);padding:14px;border-radius:12px;margin-bottom:16px;">
            <div style="font-size:12px;color:var(--cyan);font-weight:700;margin-bottom:6px;">📊 VISÃO GERAL</div>
            <div style="font-size:13px;color:var(--text-soft);">Veja suas notas, sequência de prática e posição no ranking.</div>
          </div>
        </div>
        <div class="onboard-step">
          <p style="font-size:15px;">Os módulos são liberados conforme você avança.</p>
          <div style="text-align:left;background:rgba(126,240,194,0.05);padding:14px;border-radius:12px;margin-bottom:16px;">
            <div style="font-size:12px;color:var(--success);font-weight:700;margin-bottom:6px;">🔓 LIBERAÇÃO PROGRESSIVA</div>
            <div style="font-size:13px;color:var(--text-soft);">Complete todas as aulas de um módulo para desbloquear o próximo.</div>
          </div>
        </div>
        <div class="onboard-step">
          <p style="font-size:15px;">Pratique regularmente para manter sua sequência!</p>
          <div style="text-align:left;background:rgba(255,107,136,0.05);padding:14px;border-radius:12px;margin-bottom:16px;">
            <div style="font-size:12px;color:var(--danger);font-weight:700;margin-bottom:6px;">🔥 STREAK</div>
            <div style="font-size:13px;color:var(--text-soft);">Pratique todos os dias para acumular dias consecutivos e não perder o ritmo.</div>
          </div>
        </div>
      </div>
      <button class="btn-primary" @click="avancarOnboarding">Próximo</button>
      <button class="btn-secondary" @click="pularOnboarding">Pular tour</button>
    </div>
  </div>

  <!-- MODAL WHATSAPP -->
  <div class="modal-overlay" id="modalWpp">
    <div class="modal-card">
      <div class="modal-icon" style="background:rgba(37,211,102,0.1);border-color:rgba(37,211,102,0.25);color:#25d366;">💬</div>
      <h2>Ativar alertas no WhatsApp</h2>
      <div class="wpp-step active" id="wppStep1">
        <p>Receba uma mensagem automática se ficar mais de 10 dias sem praticar. É gratuito — basta ativar em 2 passos.</p>
        <p style="color:var(--text-faint);font-size:12px;margin-bottom:16px;">Passo 1 de 2 — Informe seu número</p>
        <input class="modal-input" type="tel" id="wppNumero" placeholder="+55 11 99999-9999" />
        <div class="modal-error" id="wppError"></div>
        <button class="btn-primary" @click="wppPasso2">Continuar</button>
        <button class="btn-secondary" @click="fecharModalWpp">Agora não</button>
      </div>
      <div class="wpp-step" id="wppStep2">
        <p>Passo 2 de 2 — Ative o serviço enviando esta mensagem exata para o número abaixo:</p>
        <div class="wpp-code" style="background:rgba(255,255,255,0.05);padding:10px;border-radius:6px;font-family:monospace;margin:10px 0;">I allow callmebot to send me messages</div>
        <a id="wppLink" href="#" target="_blank" class="btn-wpp" style="display:inline-block; margin-bottom:16px; text-decoration:none;">📲 Abrir WhatsApp e enviar</a>
        <p style="color:var(--text-faint);font-size:12px;margin-bottom:16px;">Após enviar a mensagem, clique em "Já ativei"</p>
        <button class="btn-primary" @click="confirmarWpp">✓ Já ativei</button>
        <button class="btn-secondary" @click="fecharModalWpp">Cancelar</button>
      </div>
      <div class="wpp-step" id="wppStep3">
        <p style="font-size:32px;margin-bottom:12px;">✅</p>
        <p>Perfeito! Você receberá uma mensagem no WhatsApp se ficar mais de 10 dias sem praticar.</p>
        <button class="btn-primary" @click="fecharModalWpp" style="margin-top:8px;">Entendi</button>
      </div>
    </div>
  </div>

  <div class="shell" id="appShell">

    <div class="cert-banner" id="certBanner">
      <h2>🏆 Você está elegível para a certificação!</h2>
      <p>Concluiu todas as aulas do curso. Emita agora seu certificado oficial do IBSDH.</p>
      <button class="btn-cert" @click="irParaCertificado">Emitir meu certificado</button>
    </div>

    <!-- HERO -->
    <div class="hero" id="hero">
      <div class="hero-top">
        <div class="seal">S</div>
        <div class="hero-copy">
          <div class="eyebrow">Painel de progresso</div>
          <h1>SENA</h1>
          <div class="hero-sub" id="heroSub">Carregando...</div>
        </div>
        <div class="hero-right">
          <div class="hero-email" id="emailDisplay"></div>
          <div class="rank-badge" id="rankBadge">🏆 Ranking <span id="rankPos">—</span>º</div>
          <div style="display:flex;gap:8px;margin-top:4px;">
            <button class="acess-btn" @click="toggleTema" title="Alternar tema claro/escuro">☀️</button>
            <button class="acess-btn" @click="toggleAltoContraste" title="Alto contraste">◐</button>
            <button class="acess-btn" @click="toggleReduzirMovimento" title="Reduzir animações">⊘</button>
          </div>
          <button class="hero-sair" @click="sair">Trocar e-mail</button>
        </div>
      </div>
      <div class="hero-stats">
        <div class="hero-stat">
          <div class="hero-stat-value" id="heroAprovadas">0</div>
          <div class="hero-stat-label">Aprovadas</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-value" id="heroSequencia">0</div>
          <div class="hero-stat-label">Dias de prática</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-value" id="heroPosicao">—</div>
          <div class="hero-stat-label">Posição ranking</div>
        </div>
      </div>
      <div class="overall-progress">
        <div class="progress-header">
          <span class="progress-label">Progresso geral</span>
          <span class="progress-count" id="progressCount">0 / 0 aulas</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" id="progressFill" style="width:0%"></div>
        </div>
      </div>
    </div>

    <!-- CHECKLIST INICIAL -->
    <div id="checklistInicial" style="display:none;margin-bottom:22px;padding:20px;border-radius:16px;border:1px solid rgba(110,231,255,0.2);background:rgba(110,231,255,0.03);">
      <div style="font-size:13px;font-weight:700;color:var(--cyan);margin-bottom:12px;">✅ Comece por aqui</div>
      <div style="display:grid;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-soft);"><span style="color:var(--success);">✓</span> Complete a primeira aula para desbloquear o próximo conteúdo</div>
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-soft);"><span style="color:var(--success);">✓</span> Ative os alertas no WhatsApp para não perder o ritmo</div>
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-soft);"><span style="color:var(--success);">✓</span> Explore o ranking e veja sua posição</div>
      </div>
    </div>

    <!-- STREAK -->
    <div class="streak-bar" id="streakBar">
      <div class="streak-fire">🔥</div>
      <div class="streak-info">
        <div class="streak-title" id="streakTitle">Sequência ativa!</div>
        <div class="streak-sub" id="streakSub">Continue praticando para não perder</div>
      </div>
      <div class="streak-count" id="streakCount">0</div>
    </div>

    <!-- INFO CARDS -->
    <div class="info-row">
      <div class="info-card">
        <div class="info-card-label">Aprovadas</div>
        <div class="info-card-value success" id="countAprov">—</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Pendentes</div>
        <div class="info-card-value gold" id="countPend">—</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Média geral</div>
        <div class="info-card-value cyan" id="mediaGeral">—</div>
      </div>
    </div>

    <!-- META SEMANAL -->
    <div style="margin-bottom:22px;padding:18px;border-radius:16px;border:1px solid rgba(110,231,255,0.2);background:rgba(110,231,255,0.03);">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--cyan);text-transform:uppercase;letter-spacing:.08em;">Sua meta semanal</div>
          <div style="font-size:14px;color:var(--text-soft);" id="metaTexto">Defina uma meta de prática</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="meta-btn" data-meta="3" @click="definirMeta(3)">3x/semana</button>
          <button class="meta-btn" data-meta="5" @click="definirMeta(5)">5x/semana</button>
          <button class="meta-btn" data-meta="7" @click="definirMeta(7)">Todos os dias</button>
        </div>
      </div>
      <div style="margin-top:12px;height:6px;border-radius:999px;background:rgba(255,255,255,0.06);overflow:hidden;">
        <div id="metaProgress" style="height:100%;border-radius:999px;background:linear-gradient(90deg,var(--cyan),#9be9ff);width:0%;transition:width .6s;"></div>
      </div>
    </div>

    <!-- CONQUISTAS -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px;" id="conquistasContainer"></div>

    <!-- NAVEGAÇÃO PREMIUM -->
    <div class="premium-nav" id="premium-nav">
      <div class="section-title">Explore</div>
      <div class="premium-grid">
        <router-link to="/ranking.html" class="premium-card" id="premRanking">
          <div class="premium-icon" style="background: rgba(126,240,194,0.1); border-color: rgba(126,240,194,0.2);">🏆</div>
          <div>
            <div class="premium-title">Ranking</div>
            <div class="premium-sub">Compare-se com outros alunos</div>
          </div>
          <span class="premium-arrow">→</span>
        </router-link>
        <router-link to="/desafio.html" class="premium-card" id="premDesafio">
          <div class="premium-icon" style="background: rgba(245,193,99,0.1); border-color: rgba(245,193,99,0.2);">⚡</div>
          <div>
            <div class="premium-title">Desafio Semanal</div>
            <div class="premium-sub">Teste seus conhecimentos</div>
          </div>
          <span class="premium-arrow">→</span>
        </router-link>
        <router-link to="/mentor.html" class="premium-card" id="premMentor">
          <div class="premium-icon" style="background: rgba(110,231,255,0.1); border-color: rgba(110,231,255,0.2);">🎓</div>
          <div>
            <div class="premium-title">Mentor IA</div>
            <div class="premium-sub">Feedback personalizado</div>
          </div>
          <span class="premium-arrow">→</span>
        </router-link>
        <router-link :to="{ path: '/plantao.html', query: { curso: CURSO } }" class="premium-card">
          <div class="premium-icon" style="background: rgba(255,107,136,0.1); border-color: rgba(255,107,136,0.2);">🚨</div>
          <div>
            <div class="premium-title">Modo Plantão</div>
            <div class="premium-sub">3 casos em sequência, com tempo</div>
          </div>
          <span class="premium-arrow">→</span>
        </router-link>
      </div>
    </div>

    <!-- GRÁFICO DE EVOLUÇÃO -->
    <GraficoEvolucao :pontos="dadosGrafico" />

    <!-- MAPA DE JORNADA -->
    <div class="journey-section">
      <div class="journey-label">Sua jornada</div>
      <div class="journey-track" id="journeyTrack"></div>
    </div>

    <!-- MÓDULOS -->
    <div class="section-title">Módulos do curso</div>
    <div class="modules" id="modulesContainer"></div>

    <!-- BANNER WHATSAPP -->
    <div class="wpp-banner" id="wppBanner">
      <div class="wpp-banner-icon">💬</div>
      <div class="wpp-banner-text">
        <div class="wpp-banner-title">Alertas no WhatsApp</div>
        <div class="wpp-banner-sub" id="wppBannerSub">Receba uma mensagem se ficar mais de 10 dias sem praticar</div>
      </div>
      <button class="btn-wpp" id="btnWpp" @click="abrirModalWpp">Ativar grátis</button>
    </div>

    <!-- RELATÓRIO -->
    <div class="relatorio-banner">
      <div style="flex:1;min-width:200px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);margin-bottom:4px;">Relatório de Evolução Clínica</div>
        <div style="font-size:13px;color:var(--text-soft);">Gerado pela IA com base em todas as suas avaliações — assinatura clínica, padrões de força e recomendações personalizadas.</div>
      </div>
      <button @click="gerarRelatorio" id="btnRelatorio" class="btn-relatorio">✨ Gerar relatório</button>
    </div>

    <!-- Modal relatório -->
    <div id="relatorioOverlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.82);backdrop-filter:blur(8px);z-index:9999;place-items:start center;padding:20px;overflow-y:auto;">
      <div style="width:100%;max-width:680px;background:linear-gradient(180deg,rgba(16,21,29,0.99),rgba(10,14,20,1));border:1px solid var(--border);border-radius:22px;box-shadow:var(--shadow-premium);overflow:hidden;">
        <div style="padding:22px 24px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin-bottom:4px;">IBSDH — Relatório Oficial</div>
            <div style="font-size:18px;font-weight:800;letter-spacing:-.02em;">Relatório de Evolução Clínica</div>
          </div>
          <button @click="fecharRelatorio" style="padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:var(--text-soft);font-family:'Inter',sans-serif;font-size:12px;cursor:pointer;">Fechar</button>
        </div>
        <div id="relatorioConteudo" style="padding:24px;"></div>
      </div>
    </div>

    <div class="footer">
      IBSDH &mdash; <router-link to="/certificado.html">Emitir certificado</router-link>
    </div>
  </div>

  <!-- MOBILE NAV -->
  <div class="mobile-nav" id="mobileNav">
    <a href="#" @click.prevent="scrollPara('hero')" class="mobile-nav-item">🏠<span>Início</span></a>
    <a href="#" @click.prevent="scrollPara('modulesContainer')" class="mobile-nav-item">📚<span>Aulas</span></a>
    <a href="#" @click.prevent="scrollPara('premium-nav')" class="mobile-nav-item">🏆<span>Extra</span></a>
  </div>
  <button class="btn-flutuante" @click="praticarProximaAula" title="Praticar agora">⚡</button>
</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useAccessibility } from '../composables/useAccessibility'
import { callApi } from '../composables/useApi'
import GraficoEvolucao from '../components/GraficoEvolucao.vue'

// ── ACESSIBILIDADE (composable compartilhado) ──────────────────────
// Usa as mesmas chaves de localStorage que o dashboard.html original já usava.
const { carregarPreferencias, toggleTema, toggleAltoContraste, toggleReduzirMovimento, limparClasses } =
  useAccessibility({ tema: 'sena_tema', altoContraste: 'sena_alto_contraste', reduzirMovimento: 'sena_reduzir_movimento' })

const urlParams = new URLSearchParams(window.location.search)
const CURSO = urlParams.get('curso') || 'Practitioner'
const APPS_SCRIPT_URL = '/api'
const CALLMEBOT_NUMBER = '34631001117'

let MODULOS = []
let TITULOS = {}
let TOTAL_AULAS = 0
let email = ''
let progresso = {}
let montado = true

// Loader visibility
function mostrarLoader() {
  document.getElementById('loadingEl').classList.remove('hidden')
}
function ocultarLoader() {
  document.getElementById('loadingEl').classList.add('hidden')
}

// Onboarding
let onboardingStepAtual = 0
let onboardingSteps = []
function mostrarOnboarding() {
  const jaViu = localStorage.getItem('sena_onboarding_visto')
  if (!jaViu) {
    document.getElementById('onboardingModal').classList.add('visible')
    atualizarOnboarding()
  }
}
function atualizarOnboarding() {
  onboardingSteps.forEach((step, idx) => {
    step.style.display = idx === onboardingStepAtual ? 'block' : 'none'
  })
  const btn = document.querySelector('#onboardingModal .btn-primary')
  btn.textContent = onboardingStepAtual === onboardingSteps.length - 1 ? 'Começar' : 'Próximo'
}
function avancarOnboarding() {
  if (onboardingStepAtual < onboardingSteps.length - 1) {
    onboardingStepAtual++
    atualizarOnboarding()
  } else {
    pularOnboarding()
  }
}
function pularOnboarding() {
  localStorage.setItem('sena_onboarding_visto', 'true')
  document.getElementById('onboardingModal').classList.remove('visible')
  document.getElementById('checklistInicial').style.display = 'block'
}

// Metas
function definirMeta(dias) {
  localStorage.setItem('sena_meta_semanal_' + email, dias)
  document.querySelectorAll('.meta-btn').forEach(btn => {
    btn.classList.toggle('ativo', parseInt(btn.dataset.meta) === dias)
  })
  atualizarMeta()
}
function atualizarMeta() {
  const meta = parseInt(localStorage.getItem('sena_meta_semanal_' + email) || '0')
  const historico = JSON.parse(localStorage.getItem('sena_datas_pratica_' + email) || '[]')
  const hoje = new Date()
  const umaSemanaAtras = new Date(hoje.getTime() - 7 * 86400000)
  const praticasSemana = historico.filter(data => {
    const d = new Date(data)
    return d >= umaSemanaAtras && d <= hoje
  }).length
  const pct = meta > 0 ? Math.min(100, Math.round((praticasSemana / meta) * 100)) : 0
  document.getElementById('metaProgress').style.width = pct + '%'
  document.getElementById('metaTexto').textContent = meta > 0 ? praticasSemana + ' de ' + meta + ' práticas esta semana' : 'Defina uma meta de prática'
}

// Conquistas
function calcularConquistas() {
  const conquistas = []
  const totalAprovadas = Object.values(progresso).filter(p => p.aprovado === 'SIM').length
  if (totalAprovadas >= 1) conquistas.push({ icone: '🎯', nome: 'Primeira aprovação', desc: 'Aprovou a primeira aula' })
  if (totalAprovadas >= 5) conquistas.push({ icone: '📚', nome: 'Estudioso', desc: '5 aulas aprovadas' })
  if (totalAprovadas >= 10) conquistas.push({ icone: '💪', nome: 'Dedicado', desc: '10 aulas aprovadas' })
  const streak = calcularStreak()
  if (streak >= 3) conquistas.push({ icone: '🔥', nome: 'Sequência de 3 dias', desc: '3 dias seguidos praticando' })
  if (streak >= 7) conquistas.push({ icone: '⚡', nome: 'Imparável', desc: '7 dias seguidos' })
  return conquistas
}
function renderConquistas() {
  const container = document.getElementById('conquistasContainer')
  if (!container) return
  const conquistas = calcularConquistas()
  container.innerHTML = conquistas.map(c =>
    `<div class="conquista-badge">
      <span style="font-size:16px;">${c.icone}</span>
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--text);">${c.nome}</div>
        <div style="font-size:10px;color:var(--text-faint);">${c.desc}</div>
      </div>
    </div>`
  ).join('')
}

// Gráfico de evolução — os dados vão para o componente GraficoEvolucao.vue,
// que desenha em SVG (nítido em qualquer tela, acompanha o tema e tem tooltip).
const dadosGrafico = ref([])

function montarDadosGrafico() {
  const pontos = []
  MODULOS.forEach(mod => {
    mod.aulas.forEach(a => {
      const p = progresso[a.aula]
      if (p && p.melhor_nota) {
        pontos.push({
          aula: a.aula,
          rotulo: a.aula.replace('Aula_', 'Aula '),
          titulo: a.titulo || '',
          nota: Number(p.melhor_nota),
          notaMinima: Number(a.nota_minima || 7),
          tentativas: Number(p.tentativas || 0)
        })
      }
    })
  })
  dadosGrafico.value = pontos
}

// Mobile
function scrollPara(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }) }
function praticarProximaAula() {
  for (let mod of MODULOS) {
    for (let aula of mod.aulas) {
      const p = progresso[aula.aula]
      if (!p || p.aprovado !== 'SIM') {
        abrirSimulador(aula.aula)
        return
      }
    }
  }
  irParaCertificado()
}

function solicitarNotificacoes() {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
}

async function verificarAcesso(emailCheck) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'verificar_acesso', email: emailCheck, curso: CURSO })
  })
  if (!res.ok) throw new Error('Servidor indisponível')
  return await res.json()
}

function mostrarModal() {
  document.getElementById('modalOverlay').classList.add('visible')
  setTimeout(() => document.getElementById('emailInput').focus(), 100)
}

function onEmailInputKeydown(e) {
  if (e.key === 'Enter') confirmarEmail()
}

async function confirmarEmail() {
  const val = (document.getElementById('emailInput').value || '').trim().toLowerCase()
  const err = document.getElementById('emailError')
  const btn = document.getElementById('btnConfirmarEmail')
  if (!val) { err.textContent = 'Informe seu e-mail.'; return }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { err.textContent = 'E-mail inválido.'; return }
  err.textContent = ''
  btn.disabled = true
  btn.textContent = 'Verificando acesso...'
  let acesso = null
  try {
    acesso = await verificarAcesso(val)
  } catch (e) {
    btn.disabled = false
    btn.textContent = 'Acessar meu painel'
    err.textContent = 'Não foi possível verificar seu acesso. Tente novamente em instantes.'
    return
  }
  btn.disabled = false
  btn.textContent = 'Acessar meu painel'
  if (!acesso || !acesso.liberado) {
    err.textContent = (acesso && acesso.mensagem) || 'Acesso não autorizado para este e-mail.'
    return
  }
  email = val
  localStorage.setItem('sena_email', email)
  document.getElementById('modalOverlay').classList.remove('visible')
  mostrarLoader()
  carregarProgresso()
}

function sair() {
  localStorage.removeItem('sena_email')
  location.reload()
}

function fecharRelatorio() {
  document.getElementById('relatorioOverlay').style.display = 'none'
}

async function gerarRelatorio() {
  const btn = document.getElementById('btnRelatorio')
  const overlay = document.getElementById('relatorioOverlay')
  const conteudo = document.getElementById('relatorioConteudo')
  btn.disabled = true
  btn.textContent = '⏳ Gerando...'
  overlay.style.display = 'grid'
  conteudo.innerHTML = '<div style="text-align:center;padding:48px;color:var(--text-faint);">A IA está analisando sua evolução clínica...</div>'
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'relatorio_evolucao', email: email, curso: CURSO })
    })
    const data = await res.json()
    if (data.insuficiente) {
      conteudo.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-soft);">' + data.mensagem + '</div>'
      return
    }
    if (data.erro) throw new Error(data.mensagem)
    const stats = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">' +
      '<div style="text-align:center;padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);"><div style="font-size:24px;font-weight:800;color:var(--success);">' + data.aulas_aprovadas + '</div><div style="font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.08em;">Aprovadas</div></div>' +
      '<div style="text-align:center;padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);"><div style="font-size:24px;font-weight:800;color:var(--cyan);">' + data.media_geral + '</div><div style="font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.08em;">Média geral</div></div>' +
      '<div style="text-align:center;padding:14px;border-radius:12px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);"><div style="font-size:24px;font-weight:800;color:var(--gold);">' + data.total_aulas + '</div><div style="font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.08em;">Realizadas</div></div>' +
      '</div>'
    const analise = '<div style="padding:18px;border-radius:14px;border:1px solid rgba(224,192,120,0.15);background:rgba(224,192,120,0.04);">' +
      '<div style="font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);margin-bottom:12px;">Análise da IA — Supervisão Clínica</div>' +
      '<div style="font-size:14px;color:var(--text-soft);line-height:1.8;white-space:pre-line;">' + String(data.analise || '').replace(/</g, '&lt;') + '</div>' +
      '</div>'
    const dataGerada = '<div style="text-align:right;font-size:11px;color:var(--text-faint);margin-top:14px;">Gerado em ' + (data.data_geracao || '') + ' · ' + (data.curso || '') + '</div>'
    conteudo.innerHTML = stats + analise + dataGerada
  } catch (e) {
    conteudo.innerHTML = '<div style="padding:24px;text-align:center;color:var(--danger);">Erro ao gerar relatório. Tente novamente.</div>'
  } finally {
    btn.disabled = false
    btn.textContent = '✨ Gerar relatório'
  }
}

function calcularStreak() {
  const historico = JSON.parse(localStorage.getItem('sena_datas_pratica_' + email) || '[]')
  if (!historico.length) return 0
  const datas = [...new Set(historico)].sort().reverse()
  const hoje = new Date().toISOString().slice(0, 10)
  const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (datas[0] !== hoje && datas[0] !== ontem) return 0
  let streak = 1
  for (let i = 1; i < datas.length; i++) {
    const prev = new Date(datas[i - 1])
    const curr = new Date(datas[i])
    const diff = (prev - curr) / 86400000
    if (diff === 1) streak++
    else break
  }
  return streak
}

function registrarPraticaHoje() {
  const hoje = new Date().toISOString().slice(0, 10)
  const key = 'sena_datas_pratica_' + email
  const historico = JSON.parse(localStorage.getItem(key) || '[]')
  if (!historico.includes(hoje)) {
    historico.push(hoje)
    localStorage.setItem(key, JSON.stringify(historico.slice(-60)))
  }
}

function renderStreak(streak) {
  const bar = document.getElementById('streakBar')
  if (streak < 1) { bar.classList.remove('active'); return }
  bar.classList.add('active')
  document.getElementById('streakCount').textContent = streak + (streak === 1 ? ' dia' : ' dias')
  document.getElementById('heroSequencia').textContent = streak
  if (streak >= 7) {
    document.getElementById('streakTitle').textContent = '🔥 Sequência incrível!'
    document.getElementById('streakSub').textContent = streak + ' dias seguidos praticando — você está on fire!'
  } else if (streak >= 3) {
    document.getElementById('streakTitle').textContent = 'Sequência ativa!'
    document.getElementById('streakSub').textContent = streak + ' dias seguidos — continue assim!'
  } else {
    document.getElementById('streakTitle').textContent = 'Você está praticando!'
    document.getElementById('streakSub').textContent = 'Pratique amanhã para manter a sequência'
  }
}

function diasSemPraticar() {
  const historico = JSON.parse(localStorage.getItem('sena_datas_pratica_' + email) || '[]')
  if (!historico.length) return 999
  const ultima = historico.sort().slice(-1)[0]
  return Math.floor((Date.now() - new Date(ultima)) / 86400000)
}

function wppSalvo() { return localStorage.getItem('sena_wpp_' + email) }
function abrirModalWpp() {
  if (wppSalvo()) return
  document.querySelectorAll('.wpp-step').forEach(s => s.classList.remove('active'))
  document.getElementById('wppStep1').classList.add('active')
  document.getElementById('wppNumero').value = ''
  document.getElementById('wppError').textContent = ''
  document.getElementById('modalWpp').classList.add('visible')
}
function fecharModalWpp() { document.getElementById('modalWpp').classList.remove('visible') }
function wppPasso2() {
  const num = (document.getElementById('wppNumero').value || '').replace(/\s/g, '')
  const err = document.getElementById('wppError')
  if (!num || num.length < 10) { err.textContent = 'Informe um número válido com DDD.'; return }
  err.textContent = ''
  const numLimpo = num.replace(/\D/g, '')
  const numFinal = numLimpo.startsWith('55') ? numLimpo : '55' + numLimpo
  localStorage.setItem('sena_wpp_pendente_' + email, numFinal)
  const msg = encodeURIComponent('I allow callmebot to send me messages')
  document.getElementById('wppLink').href = 'https://wa.me/' + CALLMEBOT_NUMBER + '?text=' + msg
  document.querySelectorAll('.wpp-step').forEach(s => s.classList.remove('active'))
  document.getElementById('wppStep2').classList.add('active')
}
function confirmarWpp() {
  const numFinal = localStorage.getItem('sena_wpp_pendente_' + email)
  if (numFinal) {
    localStorage.setItem('sena_wpp_' + email, numFinal)
    localStorage.removeItem('sena_wpp_pendente_' + email)
  }
  document.querySelectorAll('.wpp-step').forEach(s => s.classList.remove('active'))
  document.getElementById('wppStep3').classList.add('active')
  atualizarBannerWpp()
}
function atualizarBannerWpp() {
  const numSalvo = wppSalvo()
  const btn = document.getElementById('btnWpp')
  const sub = document.getElementById('wppBannerSub')
  if (numSalvo) {
    btn.textContent = '✓ Ativo'
    btn.classList.add('ativo')
    const numMask = '+' + numSalvo.slice(0, 2) + ' (' + numSalvo.slice(2, 4) + ') ****-' + numSalvo.slice(-4)
    sub.textContent = 'Alertas ativos para ' + numMask
  }
}
async function enviarAlertaWpp(numero, mensagem) {
  try {
    const apikey = localStorage.getItem('sena_wpp_apikey_' + email) || ''
    const url = 'https://api.callmebot.com/whatsapp.php?phone=' + numero + '&text=' + encodeURIComponent(mensagem) + '&apikey=' + apikey
    await fetch(url, { mode: 'no-cors' })
  } catch (e) {}
}
function verificarAlertaInatividade() {
  const numSalvo = wppSalvo()
  if (!numSalvo) return
  const dias = diasSemPraticar()
  if (dias < 10) return
  const keyUltimoAlerta = 'sena_wpp_ultimo_alerta_' + email
  const ultimoAlerta = localStorage.getItem(keyUltimoAlerta)
  const hoje = new Date().toISOString().slice(0, 10)
  if (ultimoAlerta) {
    const diffDias = (Date.now() - new Date(ultimoAlerta)) / 86400000
    if (diffDias < 7) return
  }
  localStorage.setItem(keyUltimoAlerta, hoje)
  const msg = '⚠️ Olá! Faz ' + dias + ' dias que você não pratica no SENA. Que tal retomar hoje? Acesse: https://sena-ibsdh.netlify.app/dashboard.html'
  enviarAlertaWpp(numSalvo, msg)
}

// O backend devolve só { posicao, total } — nunca a lista de alunos. A versão
// anterior pedia o ranking inteiro e procurava a própria posição aqui, o que
// entregaria o e-mail de toda a turma ao navegador de qualquer aluno.
async function buscarPosicaoRanking() {
  const badge = document.getElementById('rankBadge')
  try {
    const data = await callApi({ action: 'posicao_ranking', email: email, curso: CURSO })
    if (!montado) return
    if (!data || data.erro || !data.posicao) {
      // Sem posição (aluno ainda sem registro no curso): o badge não faz
      // sentido e some, em vez de ficar num "—" permanente.
      if (badge) badge.style.display = 'none'
      return
    }
    document.getElementById('rankPos').textContent = data.posicao
    document.getElementById('heroPosicao').textContent = data.posicao + 'º'
    // "3º de 42" diz muito mais que "3º" — a mesma posição significa coisas
    // diferentes numa turma de 5 e numa de 500.
    if (badge && data.total) badge.innerHTML = '🏆 Ranking ' + data.posicao + 'º de ' + data.total
  } catch (e) {
    if (badge) badge.style.display = 'none'
    console.warn('[SENA] posição no ranking indisponível:', e.message)
  }
}

async function carregarProgresso() {
  try {
    const [resEst, resProg] = await Promise.all([
      fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'estrutura_curso', curso: CURSO }) }),
      fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'progresso', email: email, curso: CURSO }) })
    ])
    const estrutura = await resEst.json()
    if (!montado) return
    if (estrutura && !estrutura.erro && estrutura.modulos) {
      MODULOS = estrutura.modulos
      TOTAL_AULAS = estrutura.totalAulas
      TITULOS = {}
      MODULOS.forEach(mod => mod.aulas.forEach(a => TITULOS[a.aula] = a.titulo))
    }
    progresso = await resProg.json() || {}
    if (!montado) return

    ocultarLoader()

    if (!MODULOS.length) {
      document.getElementById('loadingEl').classList.remove('hidden')
      document.querySelector('.loader-logo').style.display = 'none'
      document.querySelector('.loader-text').textContent = 'Nenhuma aula encontrada para o curso "' + CURSO + '". Verifique a Base_Aulas.'
      return
    }
    renderDashboard()
    buscarPosicaoRanking()
    verificarAlertaInatividade()
    setupPremiumMouseTracking()
    setupScrollAnimations()
    mostrarOnboarding()
    solicitarNotificacoes()
  } catch (err) {
    document.querySelector('.loader-logo').style.display = 'none'
    document.querySelector('.loader-text').textContent = 'Erro ao carregar progresso. Recarregue a página.'
  }
}

function setupPremiumMouseTracking() {
  document.querySelectorAll('.premium-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect()
      card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
      card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
    })
  })
}

function setupScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible')
    })
  }, { threshold: 0.1 })
  document.querySelectorAll('.module-card, .premium-card, .info-card').forEach(card => observer.observe(card))
}

function renderDashboard() {
  document.getElementById('appShell').classList.add('visible')
  document.getElementById('heroSub').textContent = CURSO.replace(/_/g, ' ') + ' — IBSDH'
  const parts = email.split('@')
  document.getElementById('emailDisplay').textContent = parts[0].slice(0, 2) + '***@' + parts[1]
  const TOTAL = TOTAL_AULAS
  let aprovadas = 0, somaNotas = 0, comNota = 0
  MODULOS.forEach(mod => mod.aulas.forEach(a => {
    const p = progresso[a.aula]
    if (p && p.aprovado === 'SIM') aprovadas++
    if (p && p.melhor_nota) { somaNotas += Number(p.melhor_nota); comNota++ }
  }))
  const media = comNota > 0 ? (somaNotas / comNota).toFixed(1) : null
  const pct = Math.round((aprovadas / TOTAL) * 100)
  document.getElementById('progressCount').textContent = aprovadas + ' / ' + TOTAL + ' aulas'
  document.getElementById('progressFill').style.width = pct + '%'
  document.getElementById('countAprov').textContent = aprovadas
  document.getElementById('countPend').textContent = TOTAL - aprovadas
  document.getElementById('mediaGeral').textContent = media ? media + '/10' : '—'
  document.getElementById('heroAprovadas').textContent = aprovadas
  if (aprovadas >= TOTAL) document.getElementById('certBanner').classList.add('visible')
  const streak = calcularStreak()
  renderStreak(streak)
  atualizarBannerWpp()
  const bloqueados = calcularBloqueados()
  renderJornada(bloqueados)
  const container = document.getElementById('modulesContainer')
  container.innerHTML = ''
  MODULOS.forEach((mod, idx) => {
    const bloqueado = bloqueados[idx]
    const aprovMod = mod.aulas.filter(a => { const p = progresso[a.aula]; return p && p.aprovado === 'SIM' }).length
    const totalMod = mod.aulas.length
    const completo = aprovMod === totalMod
    const pctMod = Math.round((aprovMod / totalMod) * 100)
    let badgeClass, badgeText
    if (bloqueado) { badgeClass = 'locked'; badgeText = '🔒 Bloqueado' }
    else if (completo) { badgeClass = 'done'; badgeText = 'Completo ✓' }
    else if (aprovMod > 0) { badgeClass = 'partial'; badgeText = aprovMod + '/' + totalMod + ' aprovadas' }
    else { badgeClass = 'pending'; badgeText = 'Não iniciado' }
    const card = document.createElement('div')
    card.className = 'module-card' + (bloqueado ? ' locked' : '') + (completo ? ' complete' : '')
    card.innerHTML =
      '<div class="module-header" onclick="toggleModulo(this)">' +
        '<div class="module-num">' + (idx + 1) + '</div>' +
        '<div class="module-info">' +
          '<div class="module-title">' + mod.nome + '</div>' +
          '<div class="module-meta">' + totalMod + ' aula' + (totalMod !== 1 ? 's' : '') + ' · ' + aprovMod + ' aprovada' + (aprovMod !== 1 ? 's' : '') + '</div>' +
        '</div>' +
        '<span class="module-badge ' + badgeClass + '">' + badgeText + '</span>' +
        '<span class="module-chevron">▼</span>' +
      '</div>' +
      '<div class="module-progress"><div class="mod-track"><div class="mod-fill" style="width:' + pctMod + '%"></div></div></div>' +
      '<div class="aulas-list">' + renderAulas(mod.aulas, bloqueado) + '</div>'
    container.appendChild(card)
  })
  const primeiroModuloAberto = MODULOS.findIndex((mod, idx) => {
    return !bloqueados[idx] && !mod.aulas.every(a => { const p = progresso[a.aula]; return p && p.aprovado === 'SIM' })
  })
  if (primeiroModuloAberto !== -1) {
    setTimeout(() => {
      const cards = document.querySelectorAll('.module-card')
      if (cards[primeiroModuloAberto]) cards[primeiroModuloAberto].classList.add('open')
    }, 100)
  }

  atualizarMeta()
  renderConquistas()
  montarDadosGrafico()
  setupScrollAnimations()
}

function renderJornada(bloqueados) {
  const track = document.getElementById('journeyTrack')
  track.innerHTML = ''
  const totalModulos = MODULOS.length
  const modulosCompletos = MODULOS.filter((mod, idx) => {
    return !bloqueados[idx] && mod.aulas.every(a => { const p = progresso[a.aula]; return p && p.aprovado === 'SIM' })
  }).length
  document.querySelector('.journey-label').innerHTML = 'Sua jornada <span style="color:var(--cyan);font-weight:400;">(' + modulosCompletos + '/' + totalModulos + ' módulos completos)</span>'
  MODULOS.forEach((mod, idx) => {
    const bloqueado = bloqueados[idx]
    const aprovMod = mod.aulas.filter(a => { const p = progresso[a.aula]; return p && p.aprovado === 'SIM' }).length
    const totalMod = mod.aulas.length
    const completo = aprovMod === totalMod
    let estado = bloqueado ? 'locked' : completo ? 'done' : 'active'
    let icone = completo ? '✓' : bloqueado ? '🔒' : (idx + 1)
    const nomePartes = mod.nome.split('—')
    const nomeCompleto = nomePartes.length > 1 ? nomePartes[1].trim() : mod.nome
    if (idx > 0) {
      const prevCompleto = MODULOS[idx - 1].aulas.every(a => { const p = progresso[a.aula]; return p && p.aprovado === 'SIM' })
      const connClass = prevCompleto ? 'done' : (bloqueados[idx] ? 'locked' : 'active')
      const conn = document.createElement('div')
      conn.className = 'journey-connector ' + connClass
      track.appendChild(conn)
    }
    const node = document.createElement('div')
    node.className = 'journey-node ' + estado
    node.innerHTML = '<div class="journey-tooltip">' + nomeCompleto + '</div><div class="journey-circle">' + icone + '</div><div class="journey-num">M' + (idx + 1) + '</div>'
    if (!bloqueado) {
      node.style.cursor = 'pointer'
      node.addEventListener('click', function () {
        const cards = document.querySelectorAll('.module-card')
        if (cards[idx]) {
          cards[idx].scrollIntoView({ behavior: 'smooth', block: 'center' })
          setTimeout(function () {
            if (!cards[idx].classList.contains('open')) {
              document.querySelectorAll('.module-card.open').forEach(c => c.classList.remove('open'))
              cards[idx].classList.add('open')
            }
          }, 400)
        }
      })
    }
    track.appendChild(node)
  })
}

function calcularBloqueados() {
  const b = [false]
  for (let i = 1; i < MODULOS.length; i++) {
    const anteriorOk = MODULOS[i - 1].aulas.every(a => { const p = progresso[a.aula]; return p && p.aprovado === 'SIM' })
    b.push(b[i - 1] ? true : !anteriorOk)
  }
  return b
}

function renderAulas(aulasList, bloqueado) {
  return aulasList.map(a => {
    const p = progresso[a.aula]
    const aprovado = p && p.aprovado === 'SIM'
    const reprovado = p && p.melhor_nota && p.aprovado !== 'SIM'
    const nota = p && p.melhor_nota ? Number(p.melhor_nota).toFixed(1) : null
    const status = aprovado ? 'approved' : reprovado ? 'rejected' : 'pending'
    const icon = aprovado ? '✓' : reprovado ? '✗' : '·'
    const titulo = a.titulo || a.aula
    const numDisplay = a.aula.replace('Aula_', '')
    let btnHtml = ''
    if (!bloqueado) {
      if (aprovado) btnHtml = '<button class="btn-praticar rever" data-aula="' + a.aula + '" onclick="abrirSimulador(this.dataset.aula)">Rever</button>'
      else if (reprovado) btnHtml = '<button class="btn-praticar retry" data-aula="' + a.aula + '" onclick="abrirSimulador(this.dataset.aula)">Tentar novamente</button>'
      else btnHtml = '<button class="btn-praticar" data-aula="' + a.aula + '" onclick="abrirSimulador(this.dataset.aula)">Praticar →</button>'
    }
    const notaHtml = nota ? '<span class="aula-nota ' + status + '">' + nota + '</span>' : '<span class="aula-nota pending">—</span>'
    return '<div class="aula-row' + (bloqueado ? ' locked' : '') + '">' +
      '<div class="aula-status ' + status + '">' + icon + '</div>' +
      '<div class="aula-info"><div class="aula-num">Aula ' + numDisplay + '</div><div class="aula-title">' + titulo + '</div></div>' +
      notaHtml + btnHtml +
      '</div>'
  }).join('')
}

function toggleModulo(header) {
  const card = header.parentElement
  if (card.classList.contains('locked')) return
  const jaAberto = card.classList.contains('open')
  document.querySelectorAll('.module-card.open').forEach(c => c.classList.remove('open'))
  if (!jaAberto) card.classList.add('open')
}

function abrirSimulador(codigoAula) {
  registrarPraticaHoje()
  const url = '/index.html?email=' + encodeURIComponent(email) + '&curso=' + encodeURIComponent(CURSO) + '&aula=' + encodeURIComponent(codigoAula)
  window.open(url, '_blank')
}

function irParaCertificado() {
  window.open('/certificado.html', '_blank')
}

function onStorageEvent(e) {
  if (e.key !== 'sena_progresso_atualizado') return
  if (!e.newValue) return
  try {
    const sinal = JSON.parse(e.newValue)
    if (sinal.curso !== CURSO) return
    if (Date.now() - sinal.ts > 30000) return
    mostrarToastAtualizacao(sinal.aula, sinal.nota, sinal.aprovado)
    setTimeout(recarregarProgressoSilencioso, 800)
  } catch (err) {}
}

function mostrarToastAtualizacao(aula, nota, aprovado) {
  const existing = document.getElementById('toastAtualiz')
  if (existing) existing.remove()
  const numAula = String(aula).replace('Aula_', '')
  const cor = aprovado ? 'rgba(126,240,194,0.12)' : 'rgba(255,107,136,0.12)'
  const borda = aprovado ? 'rgba(126,240,194,0.25)' : 'rgba(255,107,136,0.2)'
  const txtCor = aprovado ? '#7ef0c2' : '#ff6b88'
  const icone = aprovado ? '✓' : '✗'
  const msg = aprovado ? 'Aula ' + numAula + ' aprovada com ' + Number(nota).toFixed(1) + '/10' : 'Aula ' + numAula + ' — ' + Number(nota).toFixed(1) + '/10 (não aprovada)'
  const toast = document.createElement('div')
  toast.id = 'toastAtualiz'
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;background:' + cor + ';border:1px solid ' + borda + ';border-radius:14px;padding:14px 18px;font-family:Inter,sans-serif;font-size:14px;font-weight:600;color:' + txtCor + ';box-shadow:0 16px 32px rgba(0,0,0,0.35);display:flex;align-items:center;gap:10px;animation:toastIn .25s ease;max-width:320px;'
  toast.innerHTML = '<span style="font-size:16px">' + icone + '</span><span>' + msg + ' &mdash; Atualizando painel...</span>'
  document.body.appendChild(toast)
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity .3s'; setTimeout(() => toast.remove(), 300) }, 4000)
}

async function recarregarProgressoSilencioso() {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'progresso', email: email, curso: CURSO })
    })
    const novoProg = await res.json()
    if (novoProg && !novoProg.erro) {
      progresso = novoProg
      if (MODULOS.length) renderDashboard()
    }
  } catch (err) {}
}

// ── MONTAGEM ─────────────────────────────────────────────────────────
// Funções chamadas a partir de HTML gerado dinamicamente (innerHTML) via
// onclick="..." precisam estar acessíveis globalmente, já que esse HTML
// não passa pelo compilador de templates do Vue.
window.toggleModulo = toggleModulo
window.abrirSimulador = abrirSimulador

onMounted(async () => {
  document.title = 'SENA | Painel de Progresso'
  carregarPreferencias()
  onboardingSteps = document.querySelectorAll('.onboard-step')

  mostrarLoader()
  const salvo = localStorage.getItem('sena_email')
  if (salvo && !/\{\{/.test(salvo) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(salvo)) {
    try {
      const acesso = await verificarAcesso(salvo)
      if (!montado) return
      if (acesso && acesso.liberado) {
        email = salvo
        carregarProgresso()
      } else {
        localStorage.removeItem('sena_email')
        ocultarLoader()
        mostrarModal()
      }
    } catch (e) {
      if (!montado) return
      localStorage.removeItem('sena_email')
      ocultarLoader()
      mostrarModal()
    }
  } else {
    ocultarLoader()
    mostrarModal()
  }

  document.getElementById('emailInput').addEventListener('keydown', onEmailInputKeydown)

  window.addEventListener('storage', onStorageEvent)
})

onUnmounted(() => {
  montado = false
  document.getElementById('emailInput')?.removeEventListener('keydown', onEmailInputKeydown)
  window.removeEventListener('storage', onStorageEvent)
  delete window.toggleModulo
  delete window.abrirSimulador
  limparClasses()
})
</script>

<style>
    body {
      --bg: #05070a;
      --panel: rgba(16,21,29,0.7);
      --border: rgba(112,141,173,0.15);
      --text: #edf3f8;
      --text-soft: #9aa7b5;
      --text-faint: #5a6470;
      --cyan: #6ee7ff;
      --cyan-dim: rgba(110,231,255,0.12);
      --gold: #e0c078;
      --gold-dim: rgba(224,192,120,0.12);
      --success: #7ef0c2;
      --success-dim: rgba(126,240,194,0.1);
      --danger: #ff6b88;
      --danger-dim: rgba(255,107,136,0.1);
      --shadow: 0 20px 48px rgba(0,0,0,0.38);
      --shadow-premium: 0 4px 6px rgba(0,0,0,0.1), 0 12px 24px rgba(0,0,0,0.3), 0 24px 48px rgba(0,0,0,0.2);
      --r-xl: 22px; --r-lg: 16px; --r-md: 12px;
    }
    
    
    /* Transições suaves para troca de tema */
    .dash-page,
.dash-page .hero,
.dash-page .module-card,
.dash-page .info-card,
.dash-page .premium-card,
.dash-page .btn-praticar,
.dash-page .aula-row {
      transition: background-color 0.4s ease, border-color 0.4s ease, color 0.4s ease, transform 0.2s ease;
    }

    .dash-page {
      font-family: 'Inter', sans-serif;
      /* No HTML original o fundo ficava no body, que por padrão propaga a
         pintura para a tela inteira. Numa div comum isso não acontece, então
         precisa do min-height para cobrir a viewport quando o conteúdo é
         curto (tela de e-mail, loader) e não sobrar área sem fundo. */
      min-height: 100vh;
      background-color: var(--bg);
      background-image: 
        radial-gradient(ellipse at top left, rgba(110,231,255,0.07), transparent 30%),
        radial-gradient(ellipse at bottom right, rgba(224,192,120,0.05), transparent 28%),
        linear-gradient(180deg, transparent 0%, #090c11 100%);
      color: var(--text);
      line-height: 1.6;
    }

    /* Scrollbar customizada */
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
    ::-webkit-scrollbar-thumb { background: rgba(110,231,255,0.2); border-radius: 10px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(110,231,255,0.4); }

    /* LOADER ANIMADO */
    .dash-page .loading-overlay {
      position: fixed; inset: 0; background: var(--bg); z-index: 99999;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      transition: opacity 0.6s ease, visibility 0.6s ease;
    }
    .dash-page .loading-overlay.hidden { opacity: 0; visibility: hidden; pointer-events: none; }
    
    .dash-page .loader-logo {
      width: 72px; height: 72px; border-radius: 20px;
      background: var(--cyan-dim); border: 2px solid rgba(110,231,255,0.4);
      display: grid; place-items: center;
      font-size: 32px; font-weight: 800; color: var(--cyan);
      box-shadow: 0 0 20px rgba(110,231,255,0.2);
      animation: pulseLoader 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate;
      margin-bottom: 24px;
    }
    .dash-page .loader-text {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 14px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--cyan);
      animation: pulseText 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite alternate;
    }
    @keyframes pulseLoader {
      0% { transform: scale(0.95); box-shadow: 0 0 10px rgba(110,231,255,0.1); border-color: rgba(110,231,255,0.2); }
      100% { transform: scale(1.05); box-shadow: 0 0 40px rgba(110,231,255,0.6); border-color: var(--cyan); }
    }
    @keyframes pulseText {
      0% { opacity: 0.5; }
      100% { opacity: 1; }
    }

    /* Modais */
    .dash-page .modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(8px); z-index:9999; place-items:center; padding:24px; }
    .dash-page .modal-overlay.visible { display:grid; }
    .dash-page .modal-card { width:100%; max-width:440px; max-height:90vh; overflow-y:auto; background:linear-gradient(180deg,rgba(16,21,29,0.99) 0%,rgba(10,14,20,1) 100%); border:1px solid var(--border); border-radius:var(--r-xl); box-shadow:var(--shadow-premium); padding:36px 30px 30px; text-align:center; animation:popIn .2s ease; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
    @keyframes popIn { from{opacity:0;transform:scale(.96) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
    .dash-page .modal-icon { width:52px;height:52px;margin:0 auto 18px;border-radius:16px;display:grid;place-items:center;background:var(--cyan-dim);border:1px solid rgba(110,231,255,0.2);font-size:20px;font-weight:800;color:var(--cyan); }
    .dash-page .modal-card h2 { font-size:20px;font-weight:800;letter-spacing:-.02em;margin-bottom:8px; }
    .dash-page .modal-card p  { color:var(--text-soft);font-size:14px;line-height:1.7;margin-bottom:22px; }
    .dash-page .modal-input { width:100%;padding:13px 16px;border-radius:var(--r-md);border:1px solid rgba(255,255,255,0.09);background:rgba(5,9,13,0.6);color:var(--text);font-family:'Inter',sans-serif;font-size:15px;outline:none;text-align:center;transition:border-color .18s,box-shadow .18s;margin-bottom:10px; }
    .dash-page .modal-input:focus { border-color:rgba(110,231,255,0.32);box-shadow:0 0 0 3px rgba(110,231,255,0.07); }
    .dash-page .modal-input::placeholder { color:#3d4a56; }
    .dash-page .modal-error { color:var(--danger);font-size:13px;min-height:18px;margin-bottom:10px; }
    .dash-page .btn-primary { width:100%;padding:14px 20px;border:none;border-radius:var(--r-md);background:linear-gradient(135deg,var(--cyan),#9be9ff);color:#061018;font-family:'Inter',sans-serif;font-size:13px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;transition:all .2s cubic-bezier(.4,0,.2,1); }
    .dash-page .btn-primary:hover { transform:translateY(-1px);box-shadow:0 12px 24px rgba(110,231,255,0.2); }
    .dash-page .btn-primary:active { transform:scale(0.98); }
    .dash-page .btn-primary:disabled { opacity:.55;cursor:not-allowed;transform:none;box-shadow:none; }
    .dash-page .btn-secondary { width:100%;margin-top:10px;padding:14px 20px;border:1px solid rgba(255,255,255,0.09);border-radius:var(--r-md);background:transparent;color:var(--text-soft);font-family:'Inter',sans-serif;font-size:13px;font-weight:700;letter-spacing:.03em;cursor:pointer;transition:all .18s ease; }
    .dash-page .btn-secondary:hover { background:rgba(255,255,255,0.05);color:var(--text); }
    .dash-page .modal-note { margin-top:14px;color:var(--text-faint);font-size:11px; }

    /* Onboarding */
    .dash-page .onboard-step { display:none; }
    .dash-page .onboard-step.active { display:block; }

    /* Modal WhatsApp (3 passos) */
    .dash-page .wpp-step { display:none; }
    .dash-page .wpp-step.active { display:block; }

    /* Tema Claro */
    body.tema-claro {
      --bg: #f8fafc;
      --panel: rgba(255,255,255,0.85);
      --border: rgba(112,141,173,0.2);
      --text: #1e293b;
      --text-soft: #64748b;
      --text-faint: #94a3b8;
      --cyan: #0891b2;
      --cyan-dim: rgba(8,145,178,0.1);
      --gold: #b45309;
      --gold-dim: rgba(180,83,9,0.1);
      --success: #059669;
      --success-dim: rgba(5,150,105,0.1);
      --danger: #dc2626;
      --danger-dim: rgba(220,38,38,0.1);
    }
    body.tema-claro { background-color: var(--bg); background-image: radial-gradient(circle at top left,rgba(8,145,178,0.08),transparent 28%), radial-gradient(circle at bottom right,rgba(180,83,9,0.06),transparent 22%), linear-gradient(180deg,transparent 0%,#e2e8f0 100%); }
    body.tema-claro .dash-page .hero { background: linear-gradient(180deg,rgba(255,255,255,0.95) 0%,rgba(241,245,249,0.98) 100%); border-color: rgba(112,141,173,0.25); }
    body.tema-claro .dash-page .hero::before { background: linear-gradient(135deg,rgba(8,145,178,0.1),transparent 40%),linear-gradient(225deg,rgba(180,83,9,0.08),transparent 35%); }
    body.tema-claro .dash-page .seal { background: radial-gradient(circle at 30% 30%,rgba(8,145,178,0.2),transparent 45%),linear-gradient(180deg,rgba(255,255,255,1),rgba(241,245,249,1)); border-color: rgba(8,145,178,0.3); }
    body.tema-claro .dash-page .eyebrow { background: rgba(8,145,178,0.08); border-color: rgba(8,145,178,0.2); color: var(--gold); }
    body.tema-claro .dash-page .acess-btn { background: rgba(8,145,178,0.08); border-color: rgba(8,145,178,0.2); color: var(--text); }
    body.tema-claro .dash-page .acess-btn:hover { background: rgba(8,145,178,0.15); }
    body.tema-claro .dash-page .card,
body.tema-claro .dash-page .premium-card,
body.tema-claro .dash-page .module-card,
body.tema-claro .dash-page .info-card { background: rgba(255,255,255,0.7); border-color: rgba(112,141,173,0.2); }
    body.tema-claro .dash-page .module-header { background: rgba(255,255,255,0.6); border-color: rgba(112,141,173,0.2); }
    body.tema-claro .dash-page .aula-row { background: rgba(255,255,255,0.5); border-color: rgba(112,141,173,0.15); }
    body.tema-claro .dash-page .aula-row:hover { background: rgba(255,255,255,0.8); }
    body.tema-claro .dash-page .aula-row.concluido { background: rgba(5,150,105,0.1); border-color: rgba(5,150,105,0.3); }
    body.tema-claro .dash-page .btn-praticar { background: linear-gradient(135deg,var(--cyan),rgba(8,145,178,0.85)); color: #fff; }
    body.tema-claro .dash-page .btn-praticar.retry { background: rgba(220,38,38,0.15); color: var(--danger); border: 1px solid rgba(220,38,38,0.3); }
    body.tema-claro .dash-page .btn-praticar.rever { background: rgba(112,141,173,0.15); color: var(--text-soft); border: 1px solid rgba(112,141,173,0.25); }
    body.tema-claro .dash-page .aula-status.pending { background: rgba(112,141,173,0.15); color: var(--text-faint); }
    body.tema-claro .dash-page .aula-status.approved { background: rgba(5,150,105,0.15); color: var(--success); }
    body.tema-claro .dash-page .aula-status.rejected { background: rgba(220,38,38,0.15); color: var(--danger); }
    body.tema-claro .dash-page .btn-primary { background: linear-gradient(135deg,var(--cyan),rgba(8,145,178,0.85)); color: #fff; }
    body.tema-claro .dash-page .btn-secondary { background: rgba(112,141,173,0.15); color: var(--text); border-color: rgba(112,141,173,0.25); }
    body.tema-claro .dash-page .btn-secondary:hover { background: rgba(112,141,173,0.25); }
    body.tema-claro .dash-page .mobile-nav { background: rgba(255,255,255,0.95); border-top-color: rgba(112,141,173,0.2); }
    body.tema-claro .dash-page .mobile-nav-item { color: var(--text-soft); }
    body.tema-claro .dash-page .mobile-nav-item:hover { background: rgba(8,145,178,0.08); color: var(--cyan); }
    body.tema-claro .dash-page .mobile-nav-item.active { color: var(--cyan); background: rgba(8,145,178,0.12); }
    body.tema-claro .dash-page .progress-bar { background: rgba(112,141,173,0.15); }
    body.tema-claro .dash-page .progress-fill { background: linear-gradient(90deg,var(--cyan),rgba(8,145,178,0.85)); }
    body.tema-claro .dash-page .conquista-badge { background: rgba(8,145,178,0.08); border-color: rgba(8,145,178,0.2); }
    body.tema-claro .dash-page .meta-btn { background: rgba(8,145,178,0.08); border-color: rgba(8,145,178,0.2); }
    body.tema-claro .dash-page .meta-btn:hover { background: rgba(8,145,178,0.15); }
    body.tema-claro .dash-page .meta-btn.ativo { background: var(--cyan); color: #fff; }
    body.tema-claro .dash-page .rank-badge { background: rgba(180,83,9,0.1); border-color: rgba(180,83,9,0.2); }
    body.tema-claro .dash-page .hero-stats { border-top-color: rgba(112,141,173,0.2); }
    body.tema-claro .dash-page .hero-stat { border-right-color: rgba(112,141,173,0.15); }

    /* Acessibilidade - Alto Contraste Aprimorado */
    body.alto-contraste {
      --bg: #000000;
      --panel: #000000;
      --border: #ffffff;
      --text: #ffffff;
      --text-soft: #ffffff;
      --text-faint: #cccccc;
      --cyan: #00ffff;
      --cyan-dim: #000000;
      --gold: #ffd700;
      --gold-dim: #000000;
      --success: #00ff00;
      --success-dim: #000000;
      --danger: #ff0000;
      --danger-dim: #000000;
    }
    
    body.alto-contraste,
body.alto-contraste .dash-page .hero,
body.alto-contraste .dash-page .module-card,
body.alto-contraste .dash-page .info-card,
body.alto-contraste .dash-page .premium-card {
      background: var(--bg) !important;
      background-image: none !important; /* Remove gradientes decorativos */
    }

    body.alto-contraste .dash-page * {
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }

    body.alto-contraste .dash-page .hero,
body.alto-contraste .dash-page .card,
body.alto-contraste .dash-page .premium-card,
body.alto-contraste .dash-page .module-card,
body.alto-contraste .dash-page .info-card,
body.alto-contraste .dash-page .module-header,
body.alto-contraste .dash-page .aula-row {
      border: 3px solid #ffffff !important;
      box-shadow: none !important;
    }
    
    body.alto-contraste .dash-page .btn-primary {
      background: #00ffff !important;
      color: #000000 !important;
      border: 3px solid #00ffff !important;
      font-weight: 800;
    }
    
    body.alto-contraste .dash-page .btn-secondary,
body.alto-contraste .dash-page .btn-ghost,
body.alto-contraste .dash-page .meta-btn {
      background: #000000 !important;
      color: #ffffff !important;
      border: 3px solid #ffffff !important;
      font-weight: 700;
    }
    body.alto-contraste .dash-page .meta-btn.ativo {
      background: #00ffff !important;
      color: #000000 !important;
      border-color: #00ffff !important;
    }
    
    body.alto-contraste .dash-page .progress-bar { background: #000; border: 3px solid #fff; }
    body.alto-contraste .dash-page .progress-fill { background: #00ffff !important; }
    
    body.alto-contraste .dash-page .aula-status.pending { background: #000; border: 3px solid #fff; color: #fff; }
    body.alto-contraste .dash-page .aula-status.approved { background: #000; border: 3px solid #00ff00; color: #00ff00; }
    body.alto-contraste .dash-page .aula-status.rejected { background: #000; border: 3px solid #ff0000; color: #ff0000; }
    
    body.alto-contraste .dash-page .btn-praticar { background: #00ffff !important; color: #000000 !important; border: 3px solid #00ffff !important; font-weight: 800; box-shadow: none !important; }
    body.alto-contraste .dash-page .btn-praticar.retry { background: #ff0000 !important; color: #ffffff !important; border: 3px solid #ff0000 !important; }
    body.alto-contraste .dash-page .btn-praticar.rever { background: #000000 !important; color: #ffffff !important; border: 3px solid #ffffff !important; }
    
    body.alto-contraste .dash-page .conquista-badge,
body.alto-contraste .dash-page .rank-badge {
      background: #000 !important;
      border: 3px solid currentColor !important;
    }
    
    body.alto-contraste .dash-page .mobile-nav {
      background: #000 !important;
      border-top: 3px solid #fff !important;
    }
    body.alto-contraste .dash-page .mobile-nav-item.active {
      border: 3px solid #00ffff;
    }
    body.alto-contraste .dash-page .btn-flutuante {
      background: #00ffff !important;
      color: #000000 !important;
      border: 3px solid #00ffff !important;
      box-shadow: none !important;
    }
    
    body.reduzir-movimento .dash-page * {
      animation: none !important;
      transition: none !important;
      scroll-behavior: auto !important;
    }

    /* Conquistas */
    .dash-page .conquista-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 10px;
      background: rgba(110,231,255,0.05);
      border: 1px solid rgba(110,231,255,0.15);
      font-size: 12px;
    }

    /* Meta */
    .dash-page .meta-btn {
      padding: 8px 14px;
      border-radius: 8px;
      border: 1px solid rgba(110,231,255,0.2);
      background: rgba(110,231,255,0.05);
      color: var(--cyan);
      font-family: 'Inter', sans-serif;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all .2s;
    }
    .dash-page .meta-btn:hover { background: rgba(110,231,255,0.12); border-color: rgba(110,231,255,0.4); }
    .dash-page .meta-btn.ativo { background: var(--cyan); color: #061018; border-color: var(--cyan); font-weight: 800; }

    /* Botões de acessibilidade */
    .dash-page .acess-btn {
      width: 32px; height: 32px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.03);
      color: var(--text-soft);
      font-size: 16px;
      cursor: pointer;
      transition: all .2s;
      display: grid; place-items: center;
    }
    .dash-page .acess-btn:hover { background: rgba(255,255,255,0.08); }

    /* Mobile */
    .dash-page .mobile-nav {
      display: none;
      position: fixed;
      bottom: 0; left: 0; right: 0;
      background: rgba(10,14,20,0.95);
      backdrop-filter: blur(12px);
      border-top: 1px solid rgba(255,255,255,0.08);
      padding: 8px 16px;
      z-index: 1000;
      justify-content: space-around;
    }
    .dash-page .mobile-nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      color: var(--text-faint);
      text-decoration: none;
      font-size: 10px;
    }
    .dash-page .btn-flutuante {
      display: none;
      position: fixed;
      bottom: 80px; right: 20px;
      width: 56px; height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--cyan), #9be9ff);
      color: #061018;
      font-size: 24px;
      border: none;
      box-shadow: 0 8px 24px rgba(110,231,255,0.4);
      cursor: pointer;
      z-index: 999;
    }
    @media (max-width: 768px) {
      .dash-page .mobile-nav { display: flex; }
      .dash-page .btn-flutuante { display: grid; place-items: center; }
      .dash-page { padding-bottom: 70px; }
    }

    /* Shell e estrutura */
    .dash-page .shell { display:none; max-width:1100px; margin:0 auto; padding:32px 24px 60px; }
    .dash-page .shell.visible { display:block; }
    .dash-page .section-title {
      font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
      color: var(--text-faint); margin-bottom: 14px; display: flex; align-items: center; gap: 8px;
    }
    .dash-page .section-title::after { content:''; flex:1; height:1px; background: rgba(255,255,255,0.06); }

    /* Hero */
    .dash-page .hero { 
      background: linear-gradient(180deg, rgba(16,21,29,0.7) 0%, rgba(10,14,20,0.8) 100%), 
                  linear-gradient(135deg, rgba(110,231,255,0.3), rgba(224,192,120,0.2), rgba(110,231,255,0.1));
      background-origin: border-box;
      background-clip: padding-box, border-box;
      border: 1px solid transparent;
      border-radius: 26px;
      box-shadow: var(--shadow-premium);
      padding: 28px;
      margin-bottom: 22px;
      position: relative;
      overflow: hidden;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .dash-page .hero::before { content:''; position:absolute; inset:0; background:linear-gradient(135deg,rgba(110,231,255,0.06),transparent 40%),linear-gradient(225deg,rgba(224,192,120,0.04),transparent 35%); pointer-events:none; }
    .dash-page .hero-top { display:flex; align-items:center; gap:18px; flex-wrap:wrap; position:relative; z-index:1; }
    .dash-page .seal { width:64px; height:64px; flex-shrink:0; border-radius:20px; display:grid; place-items:center; background:radial-gradient(circle at 30% 30%,rgba(110,231,255,0.22),transparent 50%),linear-gradient(180deg,rgba(20,28,38,0.96),rgba(10,14,20,1)); border:1px solid rgba(110,231,255,0.2); font-size:26px; font-weight:800; color:var(--text); }
    .dash-page .hero-copy { flex:1; min-width:200px; }
    .dash-page .eyebrow { display:inline-flex; align-items:center; gap:7px; padding:5px 11px; border-radius:999px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); color:var(--gold); font-size:10px; font-weight:700; letter-spacing:.13em; text-transform:uppercase; margin-bottom:10px; }
    .dash-page .eyebrow::before { content:''; width:6px; height:6px; border-radius:999px; background:var(--gold); box-shadow:0 0 8px rgba(224,192,120,0.55); }
    .dash-page .hero h1 { font-family:'Space Grotesk', sans-serif; font-size:clamp(28px,5vw,40px); font-weight:700; letter-spacing:-.04em; line-height:1; margin-bottom:6px; }
    .dash-page .hero-sub { color:var(--text-soft); font-size:14px; }
    .dash-page .hero-right { text-align:right; flex-shrink:0; display:flex; flex-direction:column; align-items:flex-end; gap:6px; }
    .dash-page .hero-email { font-size:13px; color:var(--cyan); font-weight:600; }
    .dash-page .hero-sair { font-size:11px; color:var(--text-faint); text-decoration:none; cursor:pointer; background:none; border:none; font-family:inherit; padding:0; transition:color .2s; }
    .dash-page .hero-sair:hover { color:var(--text-soft); }
    .dash-page .hero-stats { display:flex; gap:24px; margin-top:20px; padding-top:20px; border-top:1px solid rgba(255,255,255,0.06); position:relative; z-index:1; }
    .dash-page .hero-stat { flex:1; }
    .dash-page .hero-stat-value { font-size:24px; font-weight:800; color:var(--cyan); margin-bottom:4px; }
    .dash-page .hero-stat-label { font-size:11px; color:var(--text-faint); text-transform:uppercase; letter-spacing:0.08em; }
    .dash-page .rank-badge { display:inline-flex; align-items:center; gap:6px; padding:5px 10px; border-radius:999px; background:rgba(224,192,120,0.1); border:1px solid rgba(224,192,120,0.2); font-size:11px; font-weight:700; color:var(--gold); }
    .dash-page .rank-badge span { font-family:'JetBrains Mono',monospace; font-size:13px; }

    /* Streak */
    .dash-page .streak-bar { display:none; margin-bottom:16px; padding:14px 20px; border-radius:var(--r-lg); border:1px solid rgba(255,107,136,0.15); background:rgba(255,107,136,0.05); display:flex; align-items:center; gap:12px; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
    .dash-page .streak-bar.active { display:flex; }
    .dash-page .streak-fire { font-size:22px; line-height:1; }
    .dash-page .streak-info { flex:1; }
    .dash-page .streak-title { font-size:13px; font-weight:700; color:var(--text); }
    .dash-page .streak-sub { font-size:11px; color:var(--text-soft); margin-top:1px; }
    .dash-page .streak-count { font-family:'JetBrains Mono',monospace; font-size:24px; font-weight:700; color:var(--danger); }

    /* Progresso geral */
    .dash-page .overall-progress { margin-top:22px; position:relative; z-index:1; }
    .dash-page .progress-header { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:10px; }
    .dash-page .progress-label { font-size:12px; font-weight:700; color:var(--text-soft); letter-spacing:.08em; text-transform:uppercase; }
    .dash-page .progress-count { font-family:'JetBrains Mono',monospace; font-size:13px; color:var(--cyan); }
    .dash-page .progress-track { height:6px; border-radius:999px; background:rgba(255,255,255,0.06); overflow:hidden; }
    .dash-page .progress-fill { height:100%; border-radius:999px; background:linear-gradient(90deg,var(--cyan),#9be9ff); transition:width .8s cubic-bezier(.4,0,.2,1); box-shadow:0 0 12px rgba(110,231,255,0.35); }

    /* Info cards */
    .dash-page .info-row { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:22px; }
    .dash-page .info-card { background:var(--panel); border:1px solid rgba(255,255,255,0.08); border-radius:var(--r-lg); padding:16px; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); transition: transform .2s, border-color .2s, background-color 0.4s; }
    .dash-page .info-card:hover { transform: translateY(-2px); border-color: rgba(110,231,255,0.3); }
    .dash-page .info-card-label { font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--text-faint); margin-bottom:6px; }
    .dash-page .info-card-value { font-size:15px; font-weight:700; }
    .dash-page .info-card-value.cyan { color:var(--cyan); }
    .dash-page .info-card-value.success { color:var(--success); }
    .dash-page .info-card-value.gold { color:var(--gold); }

    /* Navegação premium */
    .dash-page .premium-nav { margin-bottom:24px; }
    .dash-page .premium-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
    .dash-page .premium-card {
      display:flex; align-items:center; gap:12px; padding:16px; border-radius:16px;
      border:1px solid rgba(255,255,255,0.08); background:var(--panel);
      text-decoration:none; transition:all 0.2s cubic-bezier(0.4,0,0.2,1), background-color 0.4s;
      position:relative; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2); overflow:hidden;
    }
    .dash-page .premium-card::before {
      content:''; position:absolute; inset:0;
      background: radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(110,231,255,0.1), transparent 40%);
      opacity:0; transition:opacity 0.3s; pointer-events:none;
    }
    .dash-page .premium-card:hover::before { opacity:1; }
    .dash-page .premium-card:hover { transform:translateY(-4px); border-color:rgba(110,231,255,0.5); box-shadow:0 8px 24px rgba(0,0,0,0.3); }
    .dash-page .premium-icon { width:44px; height:44px; border-radius:12px; display:grid; place-items:center; font-size:20px; flex-shrink:0; }
    .dash-page .premium-title { font-size:14px; font-weight:700; color:var(--text); margin-bottom:2px; }
    .dash-page .premium-sub { font-size:11px; color:var(--text-faint); }
    .dash-page .premium-arrow { position:absolute; right:16px; top:50%; transform:translateY(-50%); color:var(--text-faint); opacity:0; transition:opacity 0.2s; }
    .dash-page .premium-card:hover .premium-arrow { opacity:1; }

    /* Jornada */
    .dash-page .journey-section { margin-bottom:22px; }
    .dash-page .journey-label { font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--text-faint); margin-bottom:14px; }
    .dash-page .journey-track { display:flex; align-items:center; gap:0; padding:4px 0 16px; overflow-x:auto; scrollbar-width:none; }
    .dash-page .journey-track::-webkit-scrollbar { display:none; }
    .dash-page .journey-node { flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:6px; position:relative; }
    .dash-page .journey-circle {
      width:48px; height:48px; border-radius:50%; display:grid; place-items:center;
      font-size:14px; font-weight:800; border:2px solid;
      transition:transform .2s,box-shadow .2s; position:relative; z-index:1;
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    }
    .dash-page .journey-node.done .journey-circle    { background:var(--success-dim); border-color:var(--success); color:var(--success); }
    .dash-page .journey-node.active .journey-circle  { background:var(--cyan-dim); border-color:var(--cyan); color:var(--cyan); box-shadow:0 0 18px rgba(110,231,255,0.3); animation:pulse 2s ease-in-out infinite; }
    .dash-page .journey-node.locked .journey-circle  { background:rgba(255,255,255,0.03); border-color:rgba(255,255,255,0.1); color:var(--text-faint); }
    @keyframes pulse { 0%,100%{box-shadow:0 0 14px rgba(110,231,255,0.25)} 50%{box-shadow:0 0 28px rgba(110,231,255,0.5)} }
    .dash-page .journey-node .journey-tooltip {
      position:absolute; bottom:calc(100% + 10px); left:50%; transform:translateX(-50%);
      background:rgba(10,14,20,0.97); border:1px solid var(--border); border-radius:8px;
      padding:6px 10px; font-size:11px; font-weight:600; color:var(--text);
      white-space:nowrap; pointer-events:none; opacity:0; transition:opacity .15s; z-index:10;
    }
    .dash-page .journey-node .journey-tooltip::after { content:''; position:absolute; top:100%; left:50%; transform:translateX(-50%); border:5px solid transparent; border-top-color:rgba(10,14,20,0.97); }
    .dash-page .journey-node:hover .journey-tooltip { opacity:1; }
    .dash-page .journey-num { font-size:9px; font-weight:700; color:var(--text-faint); letter-spacing:.06em; }
    .dash-page .journey-node.done .journey-num   { color:var(--success); }
    .dash-page .journey-node.active .journey-num { color:var(--cyan); }
    .dash-page .journey-connector { flex-shrink:0; height:2px; width:32px; margin-top:-28px; position:relative; z-index:0; }
    .dash-page .journey-connector.done   { background:var(--success); }
    .dash-page .journey-connector.active { background:linear-gradient(90deg,var(--success),rgba(110,231,255,0.3)); }
    .dash-page .journey-connector.locked { background:rgba(255,255,255,0.07); }

    /* Módulos */
    .dash-page .modules { display:grid; gap:14px; margin-bottom:22px; }
    .dash-page .module-card { 
      background:var(--panel); border:1px solid rgba(255,255,255,0.08); border-radius:var(--r-xl);
      overflow:hidden; transition:border-color .2s, transform .2s, background-color 0.4s, opacity .6s ease, transform .6s ease;
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow:0 4px 12px rgba(0,0,0,0.2);
      opacity:0; transform:translateY(20px);
    }
    .dash-page .module-card.visible { opacity:1; transform:translateY(0); }
    .dash-page .module-card.locked { opacity:.5; }
    .dash-page .module-card.complete { border-color:rgba(126,240,194,0.2); }
    .dash-page .module-card:hover:not(.locked) { border-color:rgba(110,231,255,0.3); }
    .dash-page .module-header { display:flex; align-items:center; gap:14px; padding:18px 20px; cursor:pointer; user-select:none; border-bottom:1px solid transparent; transition:border-color .2s; }
    .dash-page .module-card.open .module-header { border-bottom-color:rgba(255,255,255,0.06); }
    .dash-page .module-num { width:36px; height:36px; flex-shrink:0; border-radius:11px; display:grid; place-items:center; font-size:13px; font-weight:800; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); color:var(--text-soft); }
    .dash-page .module-card.complete .module-num { background:var(--success-dim); border-color:rgba(126,240,194,0.2); color:var(--success); }
    .dash-page .module-card.locked .module-num { background:rgba(255,255,255,0.03); color:var(--text-faint); }
    .dash-page .module-info { flex:1; min-width:0; }
    .dash-page .module-title { font-size:14px; font-weight:700; margin-bottom:3px; line-height:1.3; overflow-wrap: break-word; }
    .dash-page .module-meta { font-size:12px; color:var(--text-faint); }
    .dash-page .module-badge { flex-shrink:0; padding:4px 10px; border-radius:999px; font-size:11px; font-weight:700; letter-spacing:.06em; }
    .dash-page .module-badge.done    { background:var(--success-dim); color:var(--success); }
    .dash-page .module-badge.partial { background:var(--cyan-dim); color:var(--cyan); }
    .dash-page .module-badge.locked  { background:rgba(255,255,255,0.04); color:var(--text-faint); }
    .dash-page .module-badge.pending { background:var(--gold-dim); color:var(--gold); }
    .dash-page .module-chevron { flex-shrink:0; color:var(--text-faint); font-size:12px; transition:transform .2s; }
    .dash-page .module-card.open .module-chevron { transform:rotate(180deg); }
    .dash-page .module-progress { padding:0 20px 14px; display:none; }
    .dash-page .module-card.open .module-progress { display:block; }
    .dash-page .mod-track { height:3px; border-radius:999px; background:rgba(255,255,255,0.05); overflow:hidden; margin-top:2px; }
    .dash-page .mod-fill { height:100%; border-radius:999px; background:var(--cyan); transition:width .6s ease; }
    .dash-page .aulas-list { display:none; padding:0 12px 14px; gap:8px; }
    .dash-page .module-card.open .aulas-list { display:grid; }
    .dash-page .aula-row { display:flex; align-items:center; gap:12px; padding:13px 14px; border-radius:var(--r-md); border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03); transition:border-color .18s,background-color .4s; min-width: 0; }
    .dash-page .aula-row:not(.locked):hover { border-color:rgba(110,231,255,0.2); background-color:rgba(110,231,255,0.06); }
    .dash-page .aula-row.locked { opacity:.5; cursor:not-allowed; }
    .dash-page .aula-status { width:28px; height:28px; flex-shrink:0; border-radius:8px; display:grid; place-items:center; font-size:13px; }
    .dash-page .aula-status.pending  { background:rgba(255,255,255,0.08); color:var(--text-faint); border:1px solid rgba(255,255,255,0.15); }
    .dash-page .aula-status.approved { background:var(--success-dim); color:var(--success); border:1px solid rgba(126,240,194,0.3); }
    .dash-page .aula-status.rejected { background:var(--danger-dim); color:var(--danger); border:1px solid rgba(255,107,136,0.3); }
    .dash-page .aula-info { flex:1; min-width:0; }
    .dash-page .aula-num { font-size:10px; font-weight:700; color:var(--text-faint); letter-spacing:.1em; text-transform:uppercase; margin-bottom:2px; }
    .dash-page .aula-title { font-size:13px; font-weight:600; color:var(--text); line-height: 1.4; overflow-wrap: break-word; }
    .dash-page .aula-nota { font-family:'JetBrains Mono',monospace; font-size:12px; flex-shrink:0; padding:3px 8px; border-radius:6px; }
    .dash-page .aula-nota.approved { background:var(--success-dim); color:var(--success); }
    .dash-page .aula-nota.rejected { background:var(--danger-dim); color:var(--danger); }
    .dash-page .aula-nota.pending  { color:var(--text-faint); }
    .dash-page .btn-praticar { flex-shrink:0; padding:9px 18px; border:none; border-radius:10px; background:linear-gradient(135deg,var(--cyan),#9be9ff); color:#061018; font-family:'Inter',sans-serif; font-size:12px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; cursor:pointer; transition:all .2s cubic-bezier(.4,0,.2,1); white-space:nowrap; position:relative; overflow:hidden; box-shadow:0 2px 8px rgba(110,231,255,0.2); }
    .dash-page .btn-praticar:hover { transform:translateY(-1px); box-shadow:0 6px 14px rgba(110,231,255,0.25); }
    .dash-page .btn-praticar:active { transform:scale(0.98); }
    .dash-page .btn-praticar::after { content:''; position:absolute; top:50%; left:50%; width:0; height:0; border-radius:50%; background:rgba(255,255,255,0.3); transform:translate(-50%,-50%); transition:width 0.3s,height 0.3s; }
    .dash-page .btn-praticar:hover::after { width:100px; height:100px; }
    .dash-page .btn-praticar.retry { background:rgba(255,107,136,0.15); color:var(--danger); border:1px solid rgba(255,107,136,0.25); box-shadow:none; }
    .dash-page .btn-praticar.retry:hover { background:rgba(255,107,136,0.22); box-shadow:none; transform:translateY(-1px); }
    .dash-page .btn-praticar.rever { background:rgba(255,255,255,0.08); color:var(--text-soft); border:1px solid rgba(255,255,255,0.12); box-shadow:none; }
    .dash-page .btn-praticar.rever:hover { background:rgba(255,255,255,0.12); box-shadow:none; }

    /* Certificado & Banners */
    .dash-page .cert-banner { display:none; margin-bottom:22px; padding:24px 28px; border-radius:var(--r-xl); border:1px solid rgba(224,192,120,0.25); background:linear-gradient(135deg,rgba(224,192,120,0.08),rgba(126,240,194,0.05)); text-align:center; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow: var(--shadow-premium); }
    .dash-page .cert-banner.visible { display:block; }
    .dash-page .cert-banner h2 { font-size:20px; font-weight:800; color:var(--gold); margin-bottom:6px; }
    .dash-page .cert-banner p  { color:var(--text-soft); font-size:14px; margin-bottom:18px; }
    .dash-page .btn-cert { display:inline-block; padding:13px 28px; border-radius:var(--r-md); background:linear-gradient(135deg,var(--gold),#f0d090); color:#1a1000; font-weight:800; font-size:13px; letter-spacing:.07em; text-transform:uppercase; text-decoration:none; cursor:pointer; border:none; font-family:'Inter',sans-serif; transition:all .2s; }
    .dash-page .btn-cert:hover { transform:translateY(-1px); box-shadow:0 8px 20px rgba(224,192,120,0.3); }
    .dash-page .btn-cert:active { transform:scale(0.98); }

    .dash-page .wpp-banner { margin-bottom:18px; padding:16px 20px; border-radius:var(--r-lg); border:1px solid rgba(37,211,102,0.2); background:rgba(37,211,102,0.05); display:flex; align-items:center; gap:14px; flex-wrap:wrap; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
    .dash-page .wpp-banner-icon { font-size:24px; flex-shrink:0; }
    .dash-page .wpp-banner-text { flex:1; min-width:160px; }
    .dash-page .wpp-banner-title { font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:#25d366; margin-bottom:2px; }
    .dash-page .wpp-banner-sub { font-size:12px; color:var(--text-soft); }
    .dash-page .btn-wpp { flex-shrink:0; padding:9px 16px; border-radius:10px; background:rgba(37,211,102,0.12); border:1px solid rgba(37,211,102,0.25); color:#25d366; font-family:'Inter',sans-serif; font-size:11px; font-weight:800; cursor:pointer; white-space:nowrap; transition:background .18s; }
    .dash-page .btn-wpp:hover { background:rgba(37,211,102,0.2); }
    .dash-page .btn-wpp.ativo { background:rgba(37,211,102,0.06); color:var(--text-faint); border-color:rgba(37,211,102,0.1); cursor:default; }

    .dash-page .relatorio-banner { padding:20px 22px; border-radius:16px; border:1px solid rgba(224,192,120,0.18); background:linear-gradient(135deg,rgba(224,192,120,0.06),rgba(110,231,255,0.03)); margin-bottom:18px; display:flex; align-items:center; gap:16px; flex-wrap:wrap; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
    .dash-page .btn-relatorio { flex-shrink:0; padding:11px 20px; border-radius:11px; border:1px solid rgba(224,192,120,0.25); background:rgba(224,192,120,0.1); color:var(--gold); font-family:'Inter',sans-serif; font-size:12px; font-weight:800; cursor:pointer; transition:background .18s,transform .18s; }
    .dash-page .btn-relatorio:hover { background:rgba(224,192,120,0.2); transform:translateY(-1px); }
    .dash-page .btn-relatorio:active { transform:scale(0.98); }

    .dash-page .footer { text-align:center; padding:24px 0 0; color:var(--text-faint); font-size:12px; }
    .dash-page .footer a { color:var(--text-faint); text-decoration:none; transition: color .2s; }
    .dash-page .footer a:hover { color:var(--text-soft); }

    /* Responsividade */
    @media (max-width: 768px) {
      .dash-page .shell { padding:24px 16px 40px; }
      .dash-page .hero { padding:20px 18px; border-radius:20px; }
      .dash-page .hero h1 { font-size:28px; }
      .dash-page .hero-right .hero-email { display:none; }
      .dash-page .hero-stats { gap:12px; }
      .dash-page .hero-stat-value { font-size:20px; }
      .dash-page .info-row { grid-template-columns:1fr 1fr; }
      .dash-page .premium-grid { grid-template-columns:1fr; }
      .dash-page .premium-card { padding:14px; }
      .dash-page .premium-icon { width:36px; height:36px; font-size:16px; }
      .dash-page .module-header { padding:14px 16px; gap:10px; }
      .dash-page .module-title { font-size:13px; }
      .dash-page .aula-row { gap:10px; padding:12px 14px; }
      .dash-page .aula-title { font-size:12px; } 
      .dash-page .aula-num { font-size:9px; }
      .dash-page .btn-praticar { font-size:10px; padding:8px 12px; }
      .dash-page .aula-nota { font-size:11px; padding:2px 6px; }
      .dash-page .journey-connector { width:20px; }
      .dash-page .journey-circle { width:40px; height:40px; font-size:12px; }
    }
    
    @media (max-width: 550px) {
      .dash-page .aula-row { flex-wrap: wrap; gap: 10px; justify-content: flex-start; }
      .dash-page .aula-nota { margin-left: auto; } 
      .dash-page .btn-praticar { width: 100%; flex-basis: 100%; margin-top: 4px; display: flex; justify-content: center; text-align: center; }
    }
    
    @media (max-width: 480px) {
      .dash-page .info-row { grid-template-columns:1fr; }
      .dash-page .hero-stats { flex-direction:column; gap:8px; }
      .dash-page .module-num { width:30px; height:30px; font-size:12px; border-radius:9px; }
      .dash-page .module-badge { font-size:10px; padding:3px 7px; }
      .dash-page .cert-banner h2 { font-size:16px; }
      .dash-page .cert-banner p { font-size:13px; }
      .dash-page .journey-circle { width:36px; height:36px; font-size:11px; }
      .dash-page .journey-connector { width:16px; }
      .dash-page .module-title { font-size:12px; }
    }
    @keyframes toastIn {
      from { opacity:0; transform:translateY(12px) scale(0.97); }
      to   { opacity:1; transform:translateY(0) scale(1); }
    }
</style>

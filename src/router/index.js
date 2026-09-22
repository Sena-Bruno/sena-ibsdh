import { createRouter, createWebHistory } from 'vue-router'

// As rotas usam os MESMOS caminhos que o site já usa hoje (index.html,
// dashboard.html, mentor.html, ranking.html, desafio.html, certificado.html)
// para que links já existentes (e-mails, iframe do Hotmart Club, favoritos
// de alunos) continuem funcionando sem quebrar nada. Também adicionamos
// aliases "limpos" (/dashboard, /simulador etc.) para uso futuro.

const routes = [
  {
    path: '/',
    redirect: '/dashboard.html'
  },
  {
    path: '/index.html',
    alias: '/simulador',
    name: 'simulador',
    component: () => import('../views/SimuladorView.vue')
  },
  {
    path: '/dashboard.html',
    alias: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue')
  },
  {
    path: '/mentor.html',
    alias: '/mentor',
    name: 'mentor',
    component: () => import('../views/MentorView.vue')
  },
  {
    path: '/ranking.html',
    alias: '/ranking',
    name: 'ranking',
    component: () => import('../views/RankingView.vue')
  },
  {
    path: '/desafio.html',
    alias: '/desafio',
    name: 'desafio',
    component: () => import('../views/DesafioView.vue')
  },
  {
    path: '/certificado.html',
    alias: '/certificado',
    name: 'certificado',
    component: () => import('../views/CertificadoView.vue')
  },
  {
    path: '/plantao.html',
    alias: '/plantao',
    name: 'plantao',
    component: () => import('../views/PlantaoView.vue')
  },
  {
    // Piloto interno (etapa 4) — de propósito SEM link em nenhuma outra
    // tela (ver o cabeçalho de PacienteVivoView.vue e o gate do lado do
    // servidor em nucleo/sena_servico/api.py, exigir_piloto). Alcançável
    // só por quem já sabe a URL, enquanto o piloto for fechado.
    path: '/paciente-vivo.html',
    alias: '/paciente-vivo',
    name: 'paciente-vivo',
    component: () => import('../views/PacienteVivoView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

export default router

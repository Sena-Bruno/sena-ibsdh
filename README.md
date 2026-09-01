# SENA — IBSDH (Vue 3 + Vite)

Migração do sistema SENA (simulador clínico, painel de progresso, ranking,
desafio semanal, modo mentor e certificação) de HTML/JS puro para Vue 3 +
Vite + Vue Router.

## Rodando localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. As chamadas para `/api` não vão funcionar
localmente a menos que você tenha um proxy configurado — em produção, o
Netlify redireciona `/api/*` para o Apps Script (ver `netlify.toml`).

## Build de produção

```bash
npm run build
```

Gera a pasta `dist/`. É isso que o Netlify publica (`netlify.toml` já está
configurado com `command = "npm run build"` e `publish = "dist"`).

## Estrutura

```
src/
  views/              Uma view por página que já existia
    SimuladorView.vue     (era index.html — o simulador clínico)
    DashboardView.vue     (era dashboard.html)
    MentorView.vue        (era mentor.html)
    RankingView.vue       (era ranking.html)
    DesafioView.vue       (era desafio.html)
    CertificadoView.vue   (era certificado.html)
  composables/
    useApi.js              chamadas fetch('/api', ...) centralizadas
    useAccessibility.js     tema claro/escuro, alto contraste, reduzir movimento
  router/index.js      Rotas — usam os MESMOS caminhos de antes
                        (/index.html, /dashboard.html, /mentor.html, etc.)
                        mais aliases limpos (/dashboard, /mentor, etc.)
  style.css             Reset global + fontes (Inter, JetBrains Mono, Space Grotesk)
  App.vue                Só o <router-view />
  main.js                 Ponto de entrada
```

## O que mudou de verdade (e o que não mudou)

- **Backend**: nada mudou. Continua Apps Script + Google Sheets, acessado via
  proxy `/api` no Netlify. `netlify.toml` mantém exatamente a mesma URL do
  Apps Script.
- **URLs**: todas as páginas continuam nos mesmos endereços
  (`/dashboard.html`, `/mentor.html` etc.), então links já enviados por
  e-mail, o iframe do Hotmart Club e favoritos de alunos continuam
  funcionando sem quebrar.
- **`RankingView`, `DesafioView`, `CertificadoView`, `MentorView`**: foram
  reescritas de forma totalmente reativa (Composition API), usando
  `v-for`/`v-if` em vez de montar HTML manualmente. São as mais "Vue puro"
  do projeto.
- **`DashboardView` e `SimuladorView`** (as duas maiores e mais complexas,
  com lógica de chat, gravação de voz, modo supervisor etc.): migradas com
  uma abordagem mais conservadora — a lógica JS quase não mudou (mesmas
  variáveis, mesmas funções, mesmo `document.getElementById`), só passou a
  rodar dentro do ciclo de vida do Vue (`onMounted`/`onUnmounted`). Isso foi
  proposital: são as telas mais críticas do sistema (produção, alunos
  usando agora) e uma reescrita 100% reativa de milhares de linhas de
  lógica de uma vez teria um risco de regressão bem maior que o benefício
  imediato. Dá pra ir modernizando aos poucos, tela por tela, quando quiser.

## Bugs corrigidos após a migração

1. **Tema claro/escuro não sincronizava entre Dashboard e Simulador.**
   `dashboard.html` salvava a preferência em `sena_tema` /
   `sena_alto_contraste` / `sena_reduzir_movimento`; `index.html` salvava em
   `sen-tema` / `sen-alto-contraste` / `sen-reduzir-movimento` — chaves
   diferentes. Unificado: as duas telas agora usam as mesmas chaves
   (`sena_tema` etc.), então a preferência escolhida em uma vale na outra.
2. **Botão flutuante (⚡) do simulador não fazia nada** (chamava
   `acaoFlutuante()`, função que nunca existiu). Removido — não tinha
   comportamento definido.
3. **Bloco de CSS "órfão" no simulador** — um trecho de CSS mobile (~110
   linhas — chat, modal supervisor, prontuário, navegação mobile) tinha uma
   chave de fechamento sobrando e sem `@media (...)` de abertura, então
   esses estilos "mobile" se aplicavam em todas as telas. Envolvido em
   `@media (max-width: 768px)`, padrão usado no resto do arquivo.
4. **Banner do WhatsApp no Dashboard continuava clicável depois de
   ativado.** `atualizarBannerWpp()` tentava desativar o clique com
   `btn.onclick = null`, o que não tem efeito num botão ligado via `@click`
   do Vue. Corrigido checando o estado já ativo no início de
   `abrirModalWpp()`.
5. **Listener de teclado do campo de e-mail (Dashboard) e o
   `IntersectionObserver` de scroll-reveal (Simulador) não eram limpos ao
   sair da tela**, e os globais `window.toggleModulo`/`window.abrirSimulador`
   ficavam presos após o componente desmontar. Adicionado cleanup em
   `onUnmounted` para os três casos, além de uma flag de montagem no
   Dashboard para evitar escrever no DOM depois que a tela já foi trocada.
6. **`MentorView`/`RankingView` liam `curso`/`aula` da URL só uma vez**,
   sem reagir a mudanças de querystring dentro da mesma rota (SPA). Ajustado
   para reler a rota a cada chamada / observar mudanças.

## Próximos passos possíveis

- Extrair pedaços repetidos do Dashboard/Simulador (modal de e-mail, toggle
  de tema) para componentes reutilizáveis de verdade — hoje eles têm sua
  própria cópia de HTML/CSS.
- Ir convertendo o Dashboard/Simulador para reatividade "de verdade" aos
  poucos (ex: trocar `document.getElementById('heroAprovadas').textContent`
  por uma `ref` ligada ao template), tela por tela.
- Adicionar Pinia se o estado (e-mail do aluno, tema) precisar ser
  compartilhado entre mais telas no futuro.

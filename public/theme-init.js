// Aplica o tema antes da primeira pintura, para não piscar escuro e depois
// trocar para claro assim que o Vue montar. Claro é o padrão: só quem já
// escolheu escuro explicitamente (useAccessibility.js) sai daqui. Mantém as
// mesmas chaves de localStorage que o Dashboard e o Simulador usam para
// ler/gravar a preferência.
//
// Por que um arquivo separado em vez de <script> inline no index.html: o
// CSP do site é `script-src 'self'`, sem 'unsafe-inline' — decisão
// deliberada (ver netlify.toml) para barrar execução de HTML/JS injetado
// via innerHTML. Um <script> inline aqui seria bloqueado silenciosamente
// pelo navegador em produção; um arquivo de mesma origem carregado por
// <script src> passa no CSP normalmente.
(function () {
  try {
    if (localStorage.getItem('sena_tema') !== 'escuro') {
      document.body.classList.add('tema-claro');
    }
    if (localStorage.getItem('sena_alto_contraste') === 'true') {
      document.body.classList.add('alto-contraste');
    }
  } catch (e) {}
})();

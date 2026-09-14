<template>
  <!-- Primeiro elemento focável da página, invisível até receber foco.
       Sem ele, o teclado atravessa banner, hero, três botões de preferência,
       estatísticas e navegação antes de chegar ao conteúdo — em TODA visita.
       Vive aqui, e não em cada view, para valer nas oito rotas de uma vez. -->
  <a class="pular-para-conteudo" href="#conteudo">Pular para o conteúdo</a>
  <router-view />
</template>

<style>
/* Não é scoped: o alvo (#conteudo) vive dentro de cada view, e o link precisa
   ficar acima de qualquer overlay que a view desenhe. */
.pular-para-conteudo {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 100000;
  padding: 12px 20px;
  border-radius: 0 0 var(--sena-r-md) 0;
  background: var(--sena-cyan);
  color: var(--sena-on-acento);
  font-family: var(--sena-fonte);
  font-size: 14px;
  font-weight: var(--sena-w-medio);
  text-decoration: none;
  /* Fora da tela, mas ainda focável — display:none ou visibility:hidden
     tirariam o link da ordem de tabulação e ele deixaria de funcionar. */
  transform: translateY(-120%);
  transition: transform var(--sena-dur-media) var(--sena-ease);
}
.pular-para-conteudo:focus {
  transform: translateY(0);
}
</style>

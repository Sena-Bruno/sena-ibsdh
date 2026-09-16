<!-- Ícones de traço único (24x24, currentColor), para substituir emoji nos
     lugares onde o emoji fazia o papel de ícone de interface: não herdava
     cor de CSS, não reagia a hover/dark mode e renderizava de um jeito
     diferente em cada sistema operacional. Decorativo por padrão
     (aria-hidden) — o rótulo acessível já vem do elemento pai
     (aria-label, texto visível ao lado, etc.). -->
<template>
  <svg
    class="icone"
    :width="tamanho"
    :height="tamanho"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="nome === 'sol'">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </template>
    <template v-else-if="nome === 'casa'">
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
      <path d="M9 20v-6h6v6" />
    </template>
    <template v-else-if="nome === 'livro'">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 1 4 18.5v-13z" />
      <path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v18h5.5a2.5 2.5 0 0 0 2.5-2.5v-13z" />
    </template>
    <template v-else-if="nome === 'trofeu'">
      <path d="M7 3h10v4a5 5 0 0 1-10 0V3z" />
      <path d="M7 4H4v1a4 4 0 0 0 4 4" />
      <path d="M17 4h3v1a4 4 0 0 1-4 4" />
      <path d="M12 12v4" />
      <path d="M9 20h6" />
      <path d="M10 16h4v4h-4z" />
    </template>
    <template v-else-if="nome === 'chama'">
      <path d="M12 2c1.2 3-3 4.3-3 8a3 3 0 0 0 6 0c0-1-.6-1.8-.6-1.8 1.8 1 2.6 3 2.6 4.8a5 5 0 0 1-10 0c0-4.4 3.4-6.6 5-11z" />
    </template>
    <template v-else-if="nome === 'raio'">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
    </template>
    <template v-else-if="nome === 'chat'">
      <path d="M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
    </template>
    <template v-else-if="nome === 'microfone'">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 19v3" />
      <path d="M8 22h8" />
    </template>
    <template v-else-if="nome === 'lapis'">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </template>
    <template v-else-if="nome === 'usuario'">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </template>
    <template v-else-if="nome === 'formatura'">
      <path d="M12 3 2 8l10 5 10-5-10-5z" />
      <path d="M6 10.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-5.5" />
    </template>
    <template v-else-if="nome === 'alerta'">
      <path d="M12 3 2 20h20L12 3z" />
      <path d="M12 9.5v4" />
      <circle cx="12" cy="16.7" r="1" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="nome === 'busca'">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </template>
    <template v-else-if="nome === 'prancheta'">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <rect x="9" y="2" width="6" height="4" rx="1" />
    </template>
    <template v-else-if="nome === 'repetir'">
      <path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.6" />
      <path d="M4 4.5v4.1h4.1" />
      <path d="M4 13a8 8 0 0 0 13.7 5.7L20 16.4" />
      <path d="M20 19.5v-4.1h-4.1" />
    </template>
    <template v-else-if="nome === 'grupo'">
      <circle cx="9" cy="9" r="3.2" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" />
      <circle cx="18" cy="9.5" r="2.4" />
      <path d="M15.5 14.3c2.3.3 4.5 1.8 4.5 4.7" />
    </template>
    <template v-else-if="nome === 'diario'">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 3v18" />
      <path d="M12 8h5" />
      <path d="M12 12h5" />
    </template>
    <template v-else-if="nome === 'brilho'">
      <path d="M12 3l1.6 4.6L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.4L12 3z" />
      <path d="M19 15l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6.6-1.7z" />
    </template>
    <template v-else-if="nome === 'impressora'">
      <path d="M6 9V3h12v6" />
      <rect x="4" y="9" width="16" height="8" rx="1.5" />
      <path d="M6 17v4h12v-4" />
    </template>
    <template v-else-if="nome === 'check-circulo'">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.2 10.6 15 16 9" />
    </template>
    <template v-else-if="nome === 'cadeado'">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </template>
    <template v-else-if="nome === 'grafico'">
      <path d="M4 20V11" />
      <path d="M12 20V4" />
      <path d="M20 20v-8" />
    </template>
    <template v-else-if="nome === 'alvo'">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </template>
  </svg>
</template>

<script setup>
defineProps({
  nome: { type: String, required: true },
  tamanho: { type: [String, Number], default: 18 },
})
</script>

<style scoped>
.icone { display: block; flex-shrink: 0; }
</style>

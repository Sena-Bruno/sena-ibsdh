<!-- O corpo inteiro do paciente, em 3D — wrapper de ciclo de vida em torno
     de avatar3d.js (a cena Three.js de verdade, testável isolada, sem
     Vue). Este componente só monta o canvas, observa redimensionamento,
     traduz props → alvo da cena, e desmonta tudo direito.

     Fallback: se o navegador não conseguir dar um contexto WebGL (perfil
     restrito, navegador antigo, `--disable-gpu` de teste), emite
     `indisponivel` e não desenha nada — quem usa este componente
     (PacienteVivoView.vue) escuta esse evento e cai para o avatar 2D
     (AvatarPaciente.vue), que continua existindo por isso mesmo. -->

<template>
  <div
    ref="containerEl"
    class="avatar-3d-container"
    role="img"
    :aria-label="`Presença do paciente virtual, corpo inteiro`"
  >
    <canvas ref="canvasEl" class="avatar-3d-canvas"></canvas>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { criarAvatar3D } from '../composables/avatar3d.js'

const props = defineProps({
  // Mesma forma que `calcularParametrosAvatar3D` devolve (ver
  // sinaisCorporais.js): periodoRespiracaoS, anguloOlharRad, tensao,
  // presenca, opacidade, periodoFalaS. `null` até a primeira semana rodar
  // — a cena usa os valores neutros com que `criarAvatar3D` já nasce.
  parametros: { type: Object, default: null },
  falando: { type: Boolean, default: false },
  reduzirMovimento: { type: Boolean, default: false },
})

const emit = defineEmits(['indisponivel'])

const containerEl = ref(null)
const canvasEl = ref(null)
let controles = null
let observador = null

function aplicarParametros() {
  if (!controles) return
  if (props.parametros) controles.definirAlvo(props.parametros)
  controles.definirFalando(props.falando)
  controles.definirEstatico(props.reduzirMovimento)
}

onMounted(() => {
  try {
    controles = criarAvatar3D(canvasEl.value)
  } catch (e) {
    // Contexto WebGL indisponível — não é um bug para logar alto, é uma
    // capacidade do navegador que o wrapper Vue já sabe contornar.
    emit('indisponivel')
    return
  }

  aplicarParametros()

  observador = new ResizeObserver((entradas) => {
    const { width, height } = entradas[0].contentRect
    controles.redimensionar(width, height)
  })
  observador.observe(containerEl.value)
})

watch(() => [props.parametros, props.falando, props.reduzirMovimento], aplicarParametros, { deep: true })

onUnmounted(() => {
  observador?.disconnect()
  controles?.destruir()
})
</script>

<style scoped>
.avatar-3d-container {
  width: 100%;
  max-width: 200px;
  aspect-ratio: 3 / 4;
  margin: 0 auto;
}
.avatar-3d-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>

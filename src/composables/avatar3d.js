// A cena 3D do avatar do paciente — corpo humano de verdade (malha e
// esqueleto reais), posicionado pelos MESMOS sinais que o avatar 2D
// (AvatarPaciente.vue) já usava.
//
// ┌───────────────────────────────────────────────────────────────────────┐
// │  DE ONDE VEIO O MODELO, E POR QUÊ                                     │
// │                                                                       │
// │  `public/avatar/Michelle.glb` é um personagem de exemplo oficial do   │
// │  three.js (github.com/mrdoob/three.js, MIT), hospedado em             │
// │  threejs.org — originado da Mixamo/Adobe, a mesma fonte usada em      │
// │  incontáveis demos e produtos open-source. Baixado uma vez e          │
// │  versionado aqui (não é buscado de um CDN em produção) por dois       │
// │  motivos: a CSP do site (`netlify.toml`) só libera `connect-src       │
// │  'self'` mais os hosts específicos do backend — um `fetch` para       │
// │  threejs.org seria bloqueado em silêncio, exatamente como o comentário│
// │  de `usePacienteVivo.js` já explica para outro host — e porque um     │
// │  ambiente sem essa origem liberada (preview local, outra hospedagem)  │
// │  não pode depender de um terceiro estar no ar.                        │
// │                                                                       │
// │  Isto substitui a primeira versão (cápsulas e esferas coloridas       │
// │  procedurais) depois de feedback direto: parecia um boneco de         │
// │  brinquedo, não um paciente. As cápsulas evitavam de propósito         │
// │  qualquer semelhança com pessoa real (ver o comentário de             │
// │  AvatarPaciente.vue, a versão 2D) — a troca por um modelo humano de    │
// │  verdade é uma escolha consciente de produto, pedida explicitamente,  │
// │  não um relaxamento silencioso daquele cuidado.                       │
// └───────────────────────────────────────────────────────────────────────┘
//
// ┌───────────────────────────────────────────────────────────────────────┐
// │  OS SINAIS SÃO EXIBIDOS. A LEITURA DELES NUNCA É (mesma regra do 2D). │
// │  Nenhuma pose aqui "significa" humor — o corpo se move pelos mesmos   │
// │  sinais brutos que o avatar 2D já usava (olhar, tensão, presença).    │
// └───────────────────────────────────────────────────────────────────────┘
//
// A pose base (braços do T-pose original trazidos para o lado do corpo) e
// os eixos usados abaixo (`rotation.y` da cabeça = olhar, não inclinar;
// `rotation.z` do ombro = subir/descer o braço) vieram de calibração
// empírica renderizando o modelo de verdade e comparando screenshots —
// não é documentado pelo arquivo, e o esqueleto Mixamo não usa a
// convenção "X sempre é isto" de forma óbvia por fora.
//
// Este módulo não conhece Vue — ver AvatarPaciente3D.vue para o wrapper
// de ciclo de vida (mount/unmount, ResizeObserver, prop → alvo).

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

const MODELO_URL = '/avatar/Michelle.glb'
const DRACO_DECODER_PATH = '/draco/'

// Ombro em T-pose aponta para o lado (horizontal); ±1.5 rad em Z traz o
// braço para baixo, ao longo do corpo — ver o comentário de calibração
// acima. Esquerda e direita giram em sinais opostos (espelhados).
const OMBRO_Z_BASE = 1.5

let dracoLoaderCompartilhado = null
function obterDracoLoader() {
  if (!dracoLoaderCompartilhado) {
    dracoLoaderCompartilhado = new DRACOLoader()
    dracoLoaderCompartilhado.setDecoderPath(DRACO_DECODER_PATH)
  }
  return dracoLoaderCompartilhado
}

/**
 * Cria a cena, monta o loop de render e devolve os controles que
 * AvatarPaciente3D.vue usa. Lança se o navegador não conseguir dar um
 * contexto WebGL — quem chama decide o que fazer (o wrapper Vue cai para
 * o avatar 2D). O carregamento do modelo em si é assíncrono; até ele
 * terminar, a cena fica vazia (não é um erro — é só o tempo de baixar
 * ~3 MB uma vez, cacheados pelo navegador depois disso).
 */
export function criarAvatar3D(canvas) {
  // A criação do renderer é a parte SÍNCRONA que pode lançar por falta de
  // WebGL — precisa acontecer aqui fora, antes de qualquer `await`, para
  // o try/catch de AvatarPaciente3D.vue continuar pegando o erro.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  camera.position.set(0, 0, 5)
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b6459, 1.15))
  const direcional = new THREE.DirectionalLight(0xffffff, 0.65)
  direcional.position.set(1.4, 2.2, 2.6)
  scene.add(direcional)

  // O que o loop persegue a cada quadro — mesma forma que
  // calcularParametrosAvatar3D devolve. Populado com valores neutros até
  // o modelo (e portanto a pose real) existir.
  const alvo = {
    anguloOlharRad: 0,
    tensao: 0.3,
    presenca: 0.65,
    opacidade: 0.86,
    periodoRespiracaoS: 4,
    periodoFalaS: 0.32,
  }
  let falando = false
  let estatico = false
  function definirAlvo(novoAlvo) {
    Object.assign(alvo, novoAlvo)
  }
  function definirFalando(valor) {
    falando = !!valor
  }
  function definirEstatico(valor) {
    estatico = !!valor
  }

  // Preenchido só depois que o GLTF carregar — todo acesso é guardado por
  // `modelo` (null até lá), então `definirAlvo`/`definirFalando` podem ser
  // chamados a qualquer momento sem se importar com a corrida com o load.
  let modelo = null
  let ossos = null
  let materiaisComOpacidade = []
  let alturaModelo = 1

  const loader = new GLTFLoader()
  loader.setDRACOLoader(obterDracoLoader())
  let carregamentoCancelado = false
  loader.load(
    MODELO_URL,
    (gltf) => {
      if (carregamentoCancelado) return
      modelo = gltf.scene
      scene.add(modelo)

      ossos = {}
      gltf.scene.traverse((o) => {
        if (o.isBone) ossos[o.name] = o
        if (o.isMesh || o.isSkinnedMesh) {
          o.material.transparent = true
          materiaisComOpacidade.push(o.material)
        }
      })

      // Pose base: braços do T-pose original para o lado do corpo.
      if (ossos.mixamorigLeftArm) ossos.mixamorigLeftArm.rotation.z = -OMBRO_Z_BASE
      if (ossos.mixamorigRightArm) ossos.mixamorigRightArm.rotation.z = OMBRO_Z_BASE

      const caixa = new THREE.Box3().setFromObject(modelo)
      alturaModelo = Math.max(0.5, caixa.max.y - caixa.min.y)
      // Centraliza horizontalmente e ancora os pés em y=0 — não depender
      // de o modelo já vir centrado (nem sempre vem).
      const centroX = (caixa.max.x + caixa.min.x) / 2
      modelo.position.x -= centroX
      modelo.position.y -= caixa.min.y
      ajustarEnquadramento()
    },
    undefined,
    (erro) => {
      // Falha de rede/parse depois que o WebGL já funcionava — não tem
      // como avisar o wrapper Vue por exceção (o `criarAvatar3D` síncrono
      // já retornou). Fica uma cena vazia (transparente) em vez de
      // quebrar a tela; é visível no console para depuração.
      console.error('Paciente Vivo: falha ao carregar o avatar 3D', erro)
    }
  )

  let largura = 1
  let altura = 1
  function ajustarEnquadramento() {
    if (largura <= 0 || altura <= 0) return
    renderer.setSize(largura, altura, false)
    const aspecto = largura / altura
    // Margem de 12% acima da cabeça e abaixo dos pés — não é a altura
    // exata do modelo, senão o topo da cabeça encosta na borda do quadro.
    const alturaFrustum = alturaModelo * 1.24
    camera.left = (-alturaFrustum * aspecto) / 2
    camera.right = (alturaFrustum * aspecto) / 2
    camera.top = alturaFrustum * 0.94
    camera.bottom = camera.top - alturaFrustum
    camera.updateProjectionMatrix()
  }
  function redimensionar(novaLargura, novaAltura) {
    largura = novaLargura
    altura = novaAltura
    ajustarEnquadramento()
  }

  let anguloOlharAtual = 0
  let inclinacaoCabecaAtual = 0
  let tuckBracoAtual = 0
  let inclinacaoColunaAtual = 0
  let idFrame = null
  const relogio = new THREE.Clock()

  function quadro() {
    idFrame = requestAnimationFrame(quadro)
    const t = relogio.getElapsedTime()
    const passo = estatico ? 1 : 0.08

    for (const mat of materiaisComOpacidade) mat.opacity = alvo.opacidade

    if (!ossos) {
      renderer.render(scene, camera)
      return
    }

    // Olhar: rotation.y da cabeça é o eixo de giro esquerda/direita neste
    // esqueleto (confirmado renderizando — ver o cabeçalho do arquivo).
    anguloOlharAtual += (alvo.anguloOlharRad - anguloOlharAtual) * passo
    if (ossos.mixamorigHead) ossos.mixamorigHead.rotation.y = anguloOlharAtual

    // Tensão: cabeça pende um pouco para baixo/frente, braços se fecham
    // um pouco mais para dentro do que a pose base — o mesmo papel que a
    // sobrancelha tinha no avatar 2D, só que em postura.
    inclinacaoCabecaAtual += (alvo.tensao * 0.10 - inclinacaoCabecaAtual) * passo
    tuckBracoAtual += (alvo.tensao * 0.18 - tuckBracoAtual) * passo
    if (ossos.mixamorigHead) ossos.mixamorigHead.rotation.x = inclinacaoCabecaAtual
    if (ossos.mixamorigLeftArm) ossos.mixamorigLeftArm.rotation.x = -tuckBracoAtual
    if (ossos.mixamorigRightArm) ossos.mixamorigRightArm.rotation.x = -tuckBracoAtual

    // Presença: "parece longe" agora também é postura, não só opacidade —
    // a coluna se curva para frente quando a presença está baixa, o grau
    // de liberdade que o busto 2D não tinha espaço para mostrar.
    inclinacaoColunaAtual += ((1 - alvo.presenca) * 0.16 - inclinacaoColunaAtual) * passo
    if (ossos.mixamorigSpine1) ossos.mixamorigSpine1.rotation.x = inclinacaoColunaAtual * 0.5
    if (ossos.mixamorigSpine2) ossos.mixamorigSpine2.rotation.x = inclinacaoColunaAtual * 0.5

    if (estatico) {
      modelo.scale.setScalar(1)
      modelo.rotation.y = 0
    } else {
      // Respiração: um pulso de escala bem sutil no modelo inteiro — não
      // afeta o esqueleto (sem risco de deformar a pele), só o "peito
      // que enche e esvazia" em miniatura.
      const respiracao = 1 + 0.006 * Math.sin((2 * Math.PI * t) / alvo.periodoRespiracaoS)
      modelo.scale.set(respiracao, 1, respiracao)

      // Fala: sem morph target de boca neste modelo (nenhum blend shape
      // — verificado) — o substituto honesto é um aceno de cabeça bem
      // pequeno no ritmo da fala, não um "boca abrindo" que não existe
      // aqui. Balanço muito sutil de "vivo", igual ao 2D, quando parado.
      const cicloFala = falando ? Math.sin((2 * Math.PI * t) / alvo.periodoFalaS) * 0.035 : 0
      if (ossos.mixamorigHead) ossos.mixamorigHead.rotation.z = cicloFala

      modelo.rotation.y = 0.02 * Math.sin((2 * Math.PI * t) / 7.3)
    }

    renderer.render(scene, camera)
  }
  quadro()

  function destruir() {
    carregamentoCancelado = true
    if (idFrame !== null) cancelAnimationFrame(idFrame)
    if (modelo) {
      modelo.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        if (o.material) o.material.dispose()
      })
    }
    renderer.dispose()
  }

  return { redimensionar, definirAlvo, definirFalando, definirEstatico, destruir }
}

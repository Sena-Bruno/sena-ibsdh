// A cena 3D do avatar do paciente — corpo inteiro, procedural, sem malha
// baixada de lugar nenhum.
//
// ┌───────────────────────────────────────────────────────────────────────┐
// │  MESMA REGRA DE AvatarPaciente.vue (a versão 2D) E de corpo.py         │
// │                                                                       │
// │  OS SINAIS SÃO EXIBIDOS. A LEITURA DELES NUNCA É. Nenhuma pose aqui   │
// │  "significa" humor — o corpo se move pelos mesmos sinais brutos que   │
// │  o avatar 2D já usava (respiração, desvio de olhar, microtensão,      │
// │  presença), só que agora com um grau de liberdade que o busto 2D não  │
// │  tinha: POSTURA (o tronco pode se inclinar, os ombros podem se        │
// │  fechar) — o equivalente físico de "o corpo está na cadeira, mas      │
// │  parece longe".                                                      │
// │                                                                       │
// │  Geometria 100% procedural (cápsulas e esferas coloridas na cor da    │
// │  marca) — não um modelo humano baixado. Duas razões: a mesma do 2D    │
// │  (ilustrado, não fotorrealista, evita o vale da estranheza e questão  │
// │  de direito de imagem) e uma nova, prática — um modelo rigged de      │
// │  verdade tem proveniência e licença para checar, e "paciente"         │
// │  parecido com uma pessoa real é exatamente o problema que o 2D já     │
// │  evitava.                                                             │
// └───────────────────────────────────────────────────────────────────────┘
//
// Este módulo não conhece Vue — é a mesma separação de
// sena_nucleo/narrativa.py (o motor decide os números, quem desenha é
// outra camada): aqui a "camada que desenha" é testável sozinha, com um
// canvas de verdade, sem precisar montar componente nenhum. Ver
// AvatarPaciente3D.vue para o wrapper de ciclo de vida (mount/unmount,
// ResizeObserver, prop → alvo).

import * as THREE from 'three'

const COR_CORPO = 0x0a7566 // var(--cyan) de PacienteVivoView.vue
const COR_TRACO = 0xfaf8f4 // var(--bg) — mesmo par de cores do avatar 2D

// Enquadramento vertical da câmera ortográfica, em unidades de cena — só
// existe para caber a figura inteira (pés a cabeça) com uma margem, não
// representa nada clínico. Pés reais ficam perto de y=-0.02 (perna:
// centro 0.42, meia-altura 0.435) e o topo da cabeça perto de y=2.63
// (pescoço 1.97 + cabeça 0.33 + raio 0.33); os valores abaixo dão ~0.13
// de margem em cada ponta. Recalcule os dois juntos se a geometria do
// corpo mudar — cortar só um dos dois lados corta pé ou cabeça na tela.
const FRUSTUM_BASE = -0.15
const FRUSTUM_TOPO = 2.78
const ALTURA_FRUSTUM = FRUSTUM_TOPO - FRUSTUM_BASE

const PISCAR_PERIODO_S = 5.2 // mesmo ciclo do @keyframes avatar-piscar (2D)

function fatorAbertura(t) {
  const ciclo = (t % PISCAR_PERIODO_S) / PISCAR_PERIODO_S
  if (ciclo < 0.94) return 1
  if (ciclo < 0.97) return 1 - (ciclo - 0.94) / 0.03
  return (ciclo - 0.97) / 0.03
}

/**
 * Cria a cena, monta o loop de render e devolve os controles que
 * AvatarPaciente3D.vue usa. Lança se o navegador não conseguir dar um
 * contexto WebGL — quem chama decide o que fazer (o wrapper Vue cai para
 * o avatar 2D).
 */
export function criarAvatar3D(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

  const scene = new THREE.Scene()
  // Câmera SEM deslocamento vertical (y=0, olhando reto por -Z): o frustum
  // ortográfico (`redimensionar`) é definido em top/bottom relativos à
  // posição da câmera, não em Y absoluto do mundo — com a câmera em y=1.2
  // (erro da primeira versão), FRUSTUM_BASE/TOPO ficavam deslocados 1.2
  // para cima e cortavam as pernas fora do quadro. Em y=0 os dois
  // coincidem, e FRUSTUM_BASE/TOPO passam a valer como Y absoluto mesmo.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  camera.position.set(0, 0, 5)
  camera.lookAt(0, 0, 0)

  scene.add(new THREE.HemisphereLight(0xffffff, 0x35322a, 1.1))
  const direcional = new THREE.DirectionalLight(0xffffff, 0.5)
  direcional.position.set(1.4, 2.2, 2.4)
  scene.add(direcional)

  const materialCorpo = new THREE.MeshLambertMaterial({ color: COR_CORPO, transparent: true })
  const materialTraco = new THREE.MeshBasicMaterial({ color: COR_TRACO })

  const raiz = new THREE.Group()
  scene.add(raiz)

  const pernaGeo = new THREE.CapsuleGeometry(0.16, 0.55, 4, 8)
  const pernaEsq = new THREE.Mesh(pernaGeo, materialCorpo)
  pernaEsq.position.set(-0.18, 0.42, 0)
  const pernaDir = new THREE.Mesh(pernaGeo, materialCorpo)
  pernaDir.position.set(0.18, 0.42, 0)
  raiz.add(pernaEsq, pernaDir)

  const troncoGeo = new THREE.CapsuleGeometry(0.42, 0.7, 4, 12)
  const tronco = new THREE.Mesh(troncoGeo, materialCorpo)
  tronco.position.set(0, 1.27, 0)
  raiz.add(tronco)

  const bracoGeo = new THREE.CapsuleGeometry(0.11, 0.58, 4, 8)
  function criarBraco(lado) {
    const pivot = new THREE.Group()
    pivot.position.set(lado * 0.48, 1.55, 0)
    const braco = new THREE.Mesh(bracoGeo, materialCorpo)
    braco.position.set(0, -0.34, 0)
    pivot.add(braco)
    return pivot
  }
  const bracoEsq = criarBraco(-1)
  const bracoDir = criarBraco(1)
  raiz.add(bracoEsq, bracoDir)

  // Pivot no pescoço: gaze (rotation.y) e a leve inclinação de tensão
  // (rotation.x) giram este grupo, nunca a cabeça isolada de tudo mais.
  const pescoco = new THREE.Group()
  pescoco.position.set(0, 1.97, 0)
  raiz.add(pescoco)

  const cabecaGeo = new THREE.SphereGeometry(0.33, 24, 16)
  const cabeca = new THREE.Mesh(cabecaGeo, materialCorpo)
  cabeca.position.set(0, 0.33, 0)
  pescoco.add(cabeca)

  const olhoGeo = new THREE.SphereGeometry(0.045, 12, 8)
  const olhoEsq = new THREE.Mesh(olhoGeo, materialTraco)
  olhoEsq.position.set(-0.13, 0.36, 0.27)
  const olhoDir = new THREE.Mesh(olhoGeo, materialTraco)
  olhoDir.position.set(0.13, 0.36, 0.27)
  pescoco.add(olhoEsq, olhoDir)

  // Boca: só se abre quando `falando` — nunca por causa do estado (mesma
  // regra do 2D). Escala em Y, igual à `<ellipse>` de AvatarPaciente.vue.
  const bocaGeo = new THREE.BoxGeometry(0.16, 0.045, 0.02)
  const boca = new THREE.Mesh(bocaGeo, materialTraco)
  boca.position.set(0, 0.15, 0.32)
  pescoco.add(boca)

  function redimensionar(largura, altura) {
    if (largura <= 0 || altura <= 0) return
    renderer.setSize(largura, altura, false)
    const aspecto = largura / altura
    camera.left = (-ALTURA_FRUSTUM * aspecto) / 2
    camera.right = (ALTURA_FRUSTUM * aspecto) / 2
    camera.top = FRUSTUM_TOPO
    camera.bottom = FRUSTUM_BASE
    camera.updateProjectionMatrix()
  }

  // O que o loop persegue a cada quadro. `definirAlvo` é chamado pelo
  // wrapper Vue sempre que os sinais do paciente mudam (nova sessão); o
  // loop interpola suavemente até lá, em vez de saltar — o mesmo papel da
  // `transition: 900ms ease` do avatar 2D.
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

  let anguloOlharAtual = 0
  let inclinacaoAtual = 0
  let tensaoBracoAtual = 0
  let posturaAtual = 0
  let idFrame = null
  const relogio = new THREE.Clock()

  function quadro() {
    idFrame = requestAnimationFrame(quadro)
    const t = relogio.getElapsedTime()

    // Presença/opacidade e o alvo de postura/tensão se aplicam sempre,
    // parado ou não — "parece longe" tem que continuar visível mesmo com
    // `reduzir movimento` ativo, só sem a interpolação suave.
    const passo = estatico ? 1 : 0.08

    anguloOlharAtual += (alvo.anguloOlharRad - anguloOlharAtual) * passo
    pescoco.rotation.y = anguloOlharAtual

    inclinacaoAtual += (alvo.tensao * 0.09 - inclinacaoAtual) * passo
    tensaoBracoAtual += (-0.12 - 0.35 * alvo.tensao - tensaoBracoAtual) * passo
    posturaAtual += ((1 - alvo.presenca) * 0.14 - posturaAtual) * passo

    bracoEsq.rotation.z = tensaoBracoAtual
    bracoDir.rotation.z = -tensaoBracoAtual
    raiz.rotation.x = posturaAtual

    materialCorpo.opacity = alvo.opacidade

    if (estatico) {
      tronco.scale.y = 1
      pescoco.rotation.x = inclinacaoAtual
      boca.scale.y = falando ? 0.7 : 0.22
      olhoEsq.scale.y = olhoDir.scale.y = 1
      raiz.rotation.y = 0
    } else {
      tronco.scale.y = 1 + 0.018 * Math.sin((2 * Math.PI * t) / alvo.periodoRespiracaoS)
      pescoco.rotation.x = inclinacaoAtual

      const cicloFala = falando ? Math.sin((2 * Math.PI * t) / alvo.periodoFalaS) * 0.5 + 0.5 : 0
      boca.scale.y = 0.22 + cicloFala * 0.78

      const abertura = Math.max(0.04, fatorAbertura(t))
      olhoEsq.scale.y = olhoDir.scale.y = abertura

      // balanço muito sutil, só pra ler como "vivo" e não uma foto — o
      // mesmo espírito do `avatar-respirar` do 2D, aplicado ao corpo
      // inteiro que o 2D não tinha.
      raiz.rotation.y = 0.02 * Math.sin((2 * Math.PI * t) / 7.3)
    }

    renderer.render(scene, camera)
  }
  quadro()

  function destruir() {
    if (idFrame !== null) cancelAnimationFrame(idFrame)
    for (const geo of [pernaGeo, troncoGeo, bracoGeo, cabecaGeo, olhoGeo, bocaGeo]) geo.dispose()
    for (const mat of [materialCorpo, materialTraco]) mat.dispose()
    renderer.dispose()
  }

  return { redimensionar, definirAlvo, definirFalando, definirEstatico, destruir }
}

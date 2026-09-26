// Testes de sinaisCorporais.js — a ponte entre o estado emocional do
// simulador ao vivo e o avatar visual.
//
// O que mais importa testar aqui não é "os números estão certos" (são
// presets escolhidos por coerência, não dado — ver o cabeçalho do
// arquivo), é que a saída NUNCA produz um CSS quebrado. Um NaN em
// animation-duration não lança erro nenhum: a animação simplesmente para,
// em silêncio, e o sintoma só aparece como "o avatar ficou parado" sem
// nenhuma pista de por quê. É o mesmo motivo por trás dos testes de
// clamping em nucleo/sena_nucleo/testes/test_corpo.py.
//
// Roda com o runner embutido do Node, sem dependência: node --test src/

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  ESTADOS_CONHECIDOS,
  inferirSinaisCorporais,
  calcularEstilosAvatar,
  calcularParametrosAvatar3D,
  sinaisReaisParaAvatar,
} from './sinaisCorporais.js'

describe('inferirSinaisCorporais', () => {
  test('todo estado conhecido produz as cinco chaves de sinal', () => {
    const chaves = ['contatoVisual', 'microTensao', 'presenca', 'respiracaoPorMinuto', 'velocidadeDaFala']
    for (const estado of ESTADOS_CONHECIDOS) {
      const sinais = inferirSinaisCorporais(estado)
      for (const chave of chaves) {
        assert.ok(chave in sinais, `${estado} deveria ter a chave ${chave}`)
        assert.equal(typeof sinais[chave], 'number', `${estado}.${chave} deveria ser número`)
      }
    }
  })

  test('estado desconhecido cai em neutro, sem lançar erro', () => {
    assert.deepEqual(inferirSinaisCorporais('inexistente'), inferirSinaisCorporais('neutro'))
    assert.deepEqual(inferirSinaisCorporais(undefined), inferirSinaisCorporais('neutro'))
    assert.deepEqual(inferirSinaisCorporais(''), inferirSinaisCorporais('neutro'))
  })

  test('resistente e fechado são presets DIFERENTES, não pontos da mesma reta', () => {
    // A distinção que justifica presets por estado em vez de interpolar um
    // único eixo "quão aberto": fricção ativa (resistente) tem tensão ALTA
    // e presença moderada; retraimento (fechado) tem tensão mais baixa e
    // presença BAIXA. Um único eixo linear não capturaria isso.
    const resistente = inferirSinaisCorporais('resistente')
    const fechado = inferirSinaisCorporais('fechado')
    assert.ok(resistente.microTensao > fechado.microTensao)
    assert.ok(resistente.presenca > fechado.presenca)
  })

  test('devolve uma cópia — mutar o resultado não contamina o preset', () => {
    const a = inferirSinaisCorporais('aberto')
    a.contatoVisual = 999
    const b = inferirSinaisCorporais('aberto')
    assert.notEqual(b.contatoVisual, 999)
  })
})

describe('sinaisReaisParaAvatar', () => {
  const SINAIS_DO_BACKEND = {
    respiracao_por_minuto: 21.4,
    variabilidade_respiratoria: 0.42,
    latencia_de_resposta: 1.8,
    velocidade_da_fala: 132.5,
    contato_visual: 0.31,
    micro_tensao: 0.58,
    presenca: 0.4,
  }

  test('traduz snake_case do backend para o camelCase do avatar', () => {
    assert.deepEqual(sinaisReaisParaAvatar(SINAIS_DO_BACKEND), {
      respiracaoPorMinuto: 21.4,
      contatoVisual: 0.31,
      microTensao: 0.58,
      presenca: 0.4,
      velocidadeDaFala: 132.5,
    })
  })

  test('latencia_de_resposta e variabilidade_respiratoria ficam de fora de propósito', () => {
    const traduzido = sinaisReaisParaAvatar(SINAIS_DO_BACKEND)
    assert.ok(!('latenciaDeResposta' in traduzido))
    assert.ok(!('variabilidadeRespiratoria' in traduzido))
  })

  test('entrada ausente ou malformada cai no preset neutro, sem lançar erro', () => {
    assert.deepEqual(sinaisReaisParaAvatar(undefined), inferirSinaisCorporais('neutro'))
    assert.deepEqual(sinaisReaisParaAvatar(null), inferirSinaisCorporais('neutro'))
    assert.deepEqual(sinaisReaisParaAvatar('não é um objeto'), inferirSinaisCorporais('neutro'))
  })

  test('a saída alimenta calcularEstilosAvatar sem produzir CSS quebrado', () => {
    const estilos = calcularEstilosAvatar(sinaisReaisParaAvatar(SINAIS_DO_BACKEND))
    for (const valor of Object.values(estilos)) {
      assert.doesNotMatch(valor, /NaN|undefined|null/)
    }
  })
})

describe('calcularEstilosAvatar — amplificação em torno do neutro', () => {
  // Achado ao vivo (Paciente Vivo, sessão real): sinais reais raramente
  // ficam perto de 0 ou 1 — variam perto do neutro — e numa escala linear
  // direta isso virava 1-2px de diferença, invisível na prática. Estes
  // testes travam que a amplificação resolve isso sem quebrar os
  // extremos nem o piso de legibilidade.

  test('sinais EXATAMENTE no neutro não sofrem efeito nenhum da amplificação', () => {
    const doPreset = calcularEstilosAvatar(inferirSinaisCorporais('neutro'))
    const doMesmoValorNaoAmplificavel = calcularEstilosAvatar({
      contatoVisual: 0.55, microTensao: 0.30, presenca: 0.65,
      respiracaoPorMinuto: 16, velocidadeDaFala: 150,
    })
    assert.deepEqual(doPreset, doMesmoValorNaoAmplificavel)
  })

  test('um desvio moderado do neutro (não extremo) produz uma diferença visível, não só teórica', () => {
    // O caso que motivou o ajuste: um paciente com contato visual só um
    // pouco abaixo do neutro (0.55 → 0.40) — bem longe de qualquer
    // extremo, mas um desvio real, do tipo que uma sessão comum produz.
    const neutro = calcularEstilosAvatar({ contatoVisual: 0.55 })
    const desvioModerado = calcularEstilosAvatar({ contatoVisual: 0.40 })
    const pxNeutro = parseFloat(neutro.desvioOlhar)
    const pxDesviado = parseFloat(desvioModerado.desvioOlhar)
    // Sem amplificação (ganho 1x), 0.15 de diferença em 10px de faixa
    // daria só 1-2px — o achado original. Com amplificação, tem que
    // passar disso.
    assert.ok(pxDesviado - pxNeutro >= 3, `diferença de só ${pxDesviado - pxNeutro}px — ainda sutil demais`)
  })

  test('extremos (0 e 1) continuam clampados nos mesmos limites de sempre — amplificação não estoura', () => {
    const contatoZero = calcularEstilosAvatar({ contatoVisual: 0 })
    const contatoUm = calcularEstilosAvatar({ contatoVisual: 1 })
    assert.equal(parseFloat(contatoZero.desvioOlhar), 10) // teto: (1-0)*10
    assert.equal(parseFloat(contatoUm.desvioOlhar), 0)    // piso: (1-1)*10

    const presencaZero = calcularEstilosAvatar({ presenca: 0 })
    assert.ok(parseFloat(presencaZero.opacidadePresenca) >= 0.6, 'piso de opacidade não pode furar')
  })

  test('tensão moderada (não travada) já produz sobrancelha visivelmente diferente do neutro', () => {
    const neutro = calcularEstilosAvatar({ microTensao: 0.30 })
    const moderada = calcularEstilosAvatar({ microTensao: 0.45 })
    assert.notEqual(neutro.tensao, moderada.tensao)
    assert.ok(parseFloat(moderada.tensao) - parseFloat(neutro.tensao) >= 0.3)
  })
})

describe('calcularEstilosAvatar — nunca produz CSS quebrado', () => {
  test('todos os estados conhecidos produzem valores finitos e válidos', () => {
    for (const estado of ESTADOS_CONHECIDOS) {
      const estilos = calcularEstilosAvatar(inferirSinaisCorporais(estado))
      for (const [chave, valor] of Object.entries(estilos)) {
        assert.equal(typeof valor, 'string', `${estado}.${chave} deveria ser string`)
        assert.doesNotMatch(valor, /NaN|undefined|null/, `${estado}.${chave} = ${valor}`)
      }
    }
  })

  test('entrada undefined não quebra — cai no padrão neutro', () => {
    const estilos = calcularEstilosAvatar(undefined)
    assert.doesNotMatch(estilos.duracaoRespiracao, /NaN/)
    assert.doesNotMatch(estilos.duracaoFala, /NaN/)
  })

  test('entrada com campos faltando não quebra', () => {
    const estilos = calcularEstilosAvatar({ contatoVisual: 0.5 }) // sem os outros campos
    for (const valor of Object.values(estilos)) {
      assert.doesNotMatch(valor, /NaN/)
    }
  })

  test('entrada com NaN explícito não vaza para o CSS', () => {
    const estilos = calcularEstilosAvatar({
      respiracaoPorMinuto: NaN, contatoVisual: NaN, microTensao: NaN,
      presenca: NaN, velocidadeDaFala: NaN,
    })
    for (const valor of Object.values(estilos)) {
      assert.doesNotMatch(valor, /NaN/)
    }
  })

  test('duração da respiração nunca é zero ou negativa', () => {
    // 60/rpm com rpm=0 seria Infinity; um respiracaoPorMinuto de entrada
    // hostil (0, negativo) não pode produzir uma animação instantânea ou
    // que trava o navegador.
    const estilos = calcularEstilosAvatar({ respiracaoPorMinuto: 0 })
    const segundos = parseFloat(estilos.duracaoRespiracao)
    assert.ok(segundos > 0 && Number.isFinite(segundos))
  })

  test('contato visual 1.0 (olho no aluno) produz desvio de olhar zero', () => {
    const estilos = calcularEstilosAvatar({ contatoVisual: 1.0 })
    assert.equal(estilos.desvioOlhar, '0px')
  })

  test('presença 0 nunca deixa o avatar totalmente invisível', () => {
    // "Parece longe" é uma leitura, não "sumiu" — o piso de opacidade
    // garante que o paciente continua vísivel mesmo no presença mais baixo.
    const estilos = calcularEstilosAvatar({ presenca: 0 })
    assert.ok(parseFloat(estilos.opacidadePresenca) >= 0.6)
  })

  test('velocidade de fala muito alta não produz ciclo de boca perigosamente rápido', () => {
    // Piso de 0.2s por ciclo — abaixo disso entra em território de
    // animação rápida e repetitiva, risco real para quem tem epilepsia
    // fotossensível.
    const estilos = calcularEstilosAvatar({ velocidadeDaFala: 100000 })
    assert.ok(parseFloat(estilos.duracaoFala) >= 0.2)
  })

  test('mesmos sinais produzem sempre o mesmo resultado (determinístico)', () => {
    const sinais = inferirSinaisCorporais('resistente')
    assert.deepEqual(calcularEstilosAvatar(sinais), calcularEstilosAvatar(sinais))
  })
})

describe('calcularParametrosAvatar3D', () => {
  // O avatar 3D lê a MESMA amplificação que o 2D, só devolvida como número
  // em vez de string de CSS — por isso os testes aqui checam paridade com
  // calcularEstilosAvatar, não redescobrem a lógica de amplificação.

  test('tensão e presença batem com os mesmos números (não amplificados de novo) que o avatar 2D usa', () => {
    for (const estado of ESTADOS_CONHECIDOS) {
      const sinais = inferirSinaisCorporais(estado)
      const params3d = calcularParametrosAvatar3D(sinais)
      const estilos2d = calcularEstilosAvatar(sinais)
      assert.equal(params3d.tensao.toFixed(2), estilos2d.tensao)
      assert.equal(params3d.opacidade.toFixed(2), estilos2d.opacidadePresenca)
    }
  })

  test('contato visual total (1.0) produz ângulo de olhar zero', () => {
    const params = calcularParametrosAvatar3D({ contatoVisual: 1.0 })
    assert.equal(params.anguloOlharRad, 0)
  })

  test('nenhum contato visual (0.0) produz o ângulo máximo, nunca além dele', () => {
    const params = calcularParametrosAvatar3D({ contatoVisual: 0.0 })
    assert.ok(params.anguloOlharRad > 0)
    // mesmo com um contatoVisual hostil (negativo), o ângulo não pode
    // ultrapassar o máximo — clamp01 em `contato` garante isso.
    const paramsExtremo = calcularParametrosAvatar3D({ contatoVisual: -50 })
    assert.equal(paramsExtremo.anguloOlharRad, params.anguloOlharRad)
  })

  test('presença 0 nunca deixa a opacidade abaixo do piso de legibilidade', () => {
    const params = calcularParametrosAvatar3D({ presenca: 0 })
    assert.ok(params.opacidade >= 0.6)
  })

  test('entrada ausente ou malformada não produz NaN em nenhum campo', () => {
    for (const entrada of [undefined, null, {}, 'não é um objeto']) {
      const params = calcularParametrosAvatar3D(entrada)
      for (const [chave, valor] of Object.entries(params)) {
        assert.ok(Number.isFinite(valor), `${chave} = ${valor} não é finito`)
      }
    }
  })

  test('período de respiração e de fala nunca saem da faixa seguro (sem tremor rápido demais)', () => {
    const params = calcularParametrosAvatar3D({ respiracaoPorMinuto: 0, velocidadeDaFala: 100000 })
    assert.ok(params.periodoRespiracaoS > 0 && Number.isFinite(params.periodoRespiracaoS))
    assert.ok(params.periodoFalaS >= 0.2)
  })

  test('mesmos sinais produzem sempre o mesmo resultado (determinístico)', () => {
    const sinais = inferirSinaisCorporais('engajado')
    assert.deepEqual(calcularParametrosAvatar3D(sinais), calcularParametrosAvatar3D(sinais))
  })
})

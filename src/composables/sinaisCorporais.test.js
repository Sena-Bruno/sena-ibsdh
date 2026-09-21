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

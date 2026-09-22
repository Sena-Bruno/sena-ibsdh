// Testes de usePacienteVivo.js.
//
// Só a parte pura (mensagemDeErro) — o resto da função é fetch com token e
// timeout, que pertence a um teste de integração, não a este runner sem
// dependências (ver o cabeçalho de sinaisCorporais.test.js pelo mesmo
// raciocínio). O que mais importa travar aqui é que cada status HTTP que a
// API do Paciente Vivo pode devolver (ver api.py) vira uma frase que faz
// sentido para quem está lendo a tela, nunca um "undefined" ou um JSON cru.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mensagemDeErro, ErroPacienteVivo, pacienteVivoConfigurado } from './usePacienteVivo.js'

describe('mensagemDeErro', () => {
  test('cada status que a API do Paciente Vivo usa tem uma frase própria', () => {
    const casos = {
      401: /sessão/i,
      403: /piloto/i,
      503: /piloto/i,
      404: /não encontrado/i,
    }
    for (const [status, esperado] of Object.entries(casos)) {
      const msg = mensagemDeErro(Number(status), null)
      assert.match(msg, esperado, `status ${status} deveria mencionar o motivo certo`)
    }
  })

  test('erro de servidor (5xx) nunca repete o detalhe cru do servidor', () => {
    const msg = mensagemDeErro(500, 'Traceback (most recent call last)...')
    assert.doesNotMatch(msg, /Traceback/)
  })

  test('422 usa o detalhe do servidor quando existe, senão um texto genérico', () => {
    assert.equal(mensagemDeErro(422, 'tipo de prescrição desconhecido'), 'tipo de prescrição desconhecido')
    assert.match(mensagemDeErro(422, null), /inválidos/i)
  })

  test('status desconhecido cai para o detalhe do servidor, ou um texto genérico', () => {
    assert.equal(mensagemDeErro(418, 'sou um bule'), 'sou um bule')
    assert.match(mensagemDeErro(418, null), /não foi possível/i)
  })
})

describe('ErroPacienteVivo', () => {
  test('carrega status e a marca de sessão inválida', () => {
    const erro = new ErroPacienteVivo('sessão morta', { status: 401, sessaoInvalida: true })
    assert.equal(erro.message, 'sessão morta')
    assert.equal(erro.status, 401)
    assert.equal(erro.sessaoInvalida, true)
  })

  test('sem opções, não marca sessão inválida nem status', () => {
    const erro = new ErroPacienteVivo('qualquer coisa')
    assert.equal(erro.status, null)
    assert.equal(erro.sessaoInvalida, false)
  })
})

describe('pacienteVivoConfigurado', () => {
  test('é uma função que devolve um booleano', () => {
    assert.equal(typeof pacienteVivoConfigurado(), 'boolean')
  })
})

// Testes do que acontece quando a chamada ao backend NÃO dá certo.
//
// Por que este arquivo existe: o app inteiro fala com o Apps Script por
// fetch('/api'), e o /exec do Apps Script SEMPRE responde 302 para
// script.googleusercontent.com. O rewrite do Netlify não segue esse
// redirecionamento — quem segue é o navegador, e por isso o salto passa pelo
// connect-src do CSP. Quando esse domínio saiu da lista, todo fetch morreu com
// um TypeError e o aluno via "Failed to fetch" cru embaixo do campo de e-mail.
//
// Os dois testes abaixo guardam as duas pontas dessa história: o CSP do
// netlify.toml precisa continuar liberando o destino do redirecionamento, e
// uma falha de rede precisa continuar virando frase em português.
//
// Roda com o runner embutido do Node, sem dependência:  node --test src/

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { callApi, ehFalhaDeRede, MSG_FALHA_REDE } from './useApi.js'

describe('CSP do netlify.toml', () => {
  test('connect-src libera o destino do redirecionamento do Apps Script', () => {
    const toml = readFileSync(new URL('../../netlify.toml', import.meta.url), 'utf8')
    const csp = /Content-Security-Policy = "([^"]+)"/.exec(toml)
    assert.ok(csp, 'o header Content-Security-Policy sumiu do netlify.toml')

    const connect = /connect-src ([^;]+)/.exec(csp[1])
    assert.ok(connect, 'a diretiva connect-src sumiu do CSP')
    assert.ok(
      connect[1].includes('https://script.googleusercontent.com'),
      'sem script.googleusercontent.com no connect-src, todo fetch("/api") volta ' +
      'a falhar com "Failed to fetch" — o navegador é quem segue o 302 do Apps Script'
    )
  })
})

describe('ehFalhaDeRede', () => {
  test('TypeError (a requisição não saiu) conta como falha de rede', () => {
    assert.equal(ehFalhaDeRede(new TypeError('Failed to fetch')), true)
  })

  test('erro de HTTP ou JSON quebrado não conta', () => {
    assert.equal(ehFalhaDeRede(new Error('Servidor respondeu com erro 500')), false)
    assert.equal(ehFalhaDeRede(new SyntaxError('Unexpected token <')), false)
  })
})

describe('callApi', () => {
  test('traduz a falha de rede em vez de vazar "Failed to fetch"', async () => {
    const original = globalThis.fetch
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch') }
    try {
      await assert.rejects(
        () => callApi({ action: 'ping' }),
        (e) => e.message === MSG_FALHA_REDE
      )
    } finally {
      globalThis.fetch = original
    }
  })

  test('erro de HTTP continua informando o status', async () => {
    const original = globalThis.fetch
    globalThis.fetch = async () => ({ ok: false, status: 503 })
    try {
      await assert.rejects(
        () => callApi({ action: 'ping' }),
        (e) => e.message === 'Servidor respondeu com erro 503'
      )
    } finally {
      globalThis.fetch = original
    }
  })
})

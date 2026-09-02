// Testa buscarPosicaoRanking (posicao-ranking.gs) simulando a API do Sheets.
//
// Não há versão "original" para comparar — essa função nunca existiu no
// backend; o dashboard chamava uma action inexistente. Então aqui os testes
// são sobre o comportamento esperado: ordem do ranking, desempate, aluno fora
// do curso, aba vazia e a garantia de que nenhum e-mail vaza no retorno.

import fs from 'fs'
import vm from 'vm'

const ARQ = new URL('./posicao-ranking.gs', import.meta.url).pathname

const H_PROG = ['email', 'curso', 'aula', 'aprovado', 'melhor_nota', 'tentativas']

function criarSheet(headers, linhas) {
  const grid = [headers].concat(linhas)
  return {
    getLastRow: () => grid.length,
    getLastColumn: () => headers.length,
    getRange(linha, coluna, nLinhas, nColunas) {
      const nl = nLinhas === undefined ? 1 : nLinhas
      const nc = nColunas === undefined ? 1 : nColunas
      return {
        getValues: () => {
          const out = []
          for (let r = 0; r < nl; r++) {
            const row = grid[linha - 1 + r] || []
            out.push(row.slice(coluna - 1, coluna - 1 + nc))
          }
          return out
        }
      }
    }
  }
}

function carregar(sheet) {
  const sandbox = {
    CONFIG: { SHEET_ID: 'fake', SHEETS: { PROGRESSO: 'Progresso_Aluno' } },
    normalizarTexto: (v) => String(v || '').trim(),
    SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => (n === 'Progresso_Aluno' ? sheet : null) }) },
    registrarLog: () => {},
    Math, Object, String, Number, JSON, Date, isNaN,
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(ARQ, 'utf8'), sandbox)
  return sandbox
}

let falhas = 0
function checar(nome, ok, detalhe) {
  if (!ok) falhas++
  console.log(`${ok ? 'PASS' : 'FALHA'} — ${nome}${detalhe ? '\n   ' + detalhe : ''}`)
}

const P = 'Practitioner'
const M = 'Master_PNL'

// ── 1) ordem por aulas aprovadas ────────────────────────────────────────────
{
  const s = criarSheet(H_PROG, [
    ['ana@t.com',   P, 'Aula_1', 'SIM', 9.0, 1],
    ['ana@t.com',   P, 'Aula_2', 'SIM', 8.0, 1],
    ['ana@t.com',   P, 'Aula_3', 'SIM', 8.0, 1],
    ['bruno@t.com', P, 'Aula_1', 'SIM', 10,  1],
    ['bruno@t.com', P, 'Aula_2', 'SIM', 10,  1],
    ['caio@t.com',  P, 'Aula_1', 'NAO', 5.0, 3],
  ])
  const { buscarPosicaoRanking } = carregar(s)
  checar('mais aprovadas vem primeiro (ana 3 > bruno 2)',
    buscarPosicaoRanking('ana@t.com', P).posicao === 1)
  checar('bruno em 2º mesmo com média maior',
    buscarPosicaoRanking('bruno@t.com', P).posicao === 2)
  checar('caio, sem aprovação, em último',
    buscarPosicaoRanking('caio@t.com', P).posicao === 3)
  checar('total conta alunos, não linhas',
    buscarPosicaoRanking('ana@t.com', P).total === 3,
    'total=' + buscarPosicaoRanking('ana@t.com', P).total)
}

// ── 2) desempate pela média ─────────────────────────────────────────────────
{
  const s = criarSheet(H_PROG, [
    ['ana@t.com',   P, 'Aula_1', 'SIM', 7.0, 1],
    ['ana@t.com',   P, 'Aula_2', 'SIM', 7.0, 1],
    ['bruno@t.com', P, 'Aula_1', 'SIM', 9.5, 1],
    ['bruno@t.com', P, 'Aula_2', 'SIM', 9.5, 1],
  ])
  const { buscarPosicaoRanking } = carregar(s)
  checar('empate em aprovadas desempata pela média (bruno 9,5 > ana 7,0)',
    buscarPosicaoRanking('bruno@t.com', P).posicao === 1 &&
    buscarPosicaoRanking('ana@t.com', P).posicao === 2)
}

// ── 3) isolamento por curso ─────────────────────────────────────────────────
{
  const s = criarSheet(H_PROG, [
    ['ana@t.com',   P, 'Aula_1', 'SIM', 9.0, 1],
    ['bruno@t.com', M, 'Aula_1', 'SIM', 10,  1],
    ['bruno@t.com', M, 'Aula_2', 'SIM', 10,  1],
  ])
  const { buscarPosicaoRanking } = carregar(s)
  checar('aluno de outro curso não entra na conta',
    buscarPosicaoRanking('ana@t.com', P).total === 1)
  checar('aluno sem registro no curso volta posicao null',
    buscarPosicaoRanking('bruno@t.com', P).posicao === null)
  checar('mesmo aluno tem posição no curso dele',
    buscarPosicaoRanking('bruno@t.com', M).posicao === 1)
}

// ── 4) variações de "aprovado" e notas inválidas ────────────────────────────
{
  const s = criarSheet(H_PROG, [
    ['ana@t.com',   P, 'Aula_1', true,   9.0, 1],
    ['ana@t.com',   P, 'Aula_2', 'TRUE', 8.0, 1],
    ['bruno@t.com', P, 'Aula_1', 'sim',  8.0, 1],
    ['bruno@t.com', P, 'Aula_2', '',     '',  1],
  ])
  const { buscarPosicaoRanking } = carregar(s)
  checar('aceita true booleano, "TRUE" e "sim" minúsculo',
    buscarPosicaoRanking('ana@t.com', P).posicao === 1 &&
    buscarPosicaoRanking('bruno@t.com', P).posicao === 2)
}

// ── 5) e-mail com espaço/maiúsculas ─────────────────────────────────────────
{
  const s = criarSheet(H_PROG, [
    ['  Ana@T.com ', P, 'Aula_1', 'SIM', 9.0, 1],
  ])
  const { buscarPosicaoRanking } = carregar(s)
  checar('normaliza caixa e espaços dos dois lados',
    buscarPosicaoRanking('ANA@t.com ', P).posicao === 1)
}

// ── 6) bordas ───────────────────────────────────────────────────────────────
{
  const vazia = criarSheet(H_PROG, [])
  const { buscarPosicaoRanking } = carregar(vazia)
  checar('aba vazia não estoura', (() => {
    const r = buscarPosicaoRanking('ana@t.com', P)
    return r.posicao === null && r.total === 0
  })())

  const s = criarSheet(H_PROG, [['ana@t.com', P, 'Aula_1', 'SIM', 9, 1]])
  const ctx = carregar(s)
  checar('email vazio não estoura', ctx.buscarPosicaoRanking('', P).posicao === null)
  checar('curso indefinido não estoura', ctx.buscarPosicaoRanking('ana@t.com', undefined).posicao === null)
}

// ── 7) privacidade: o retorno não pode carregar e-mail nenhum ───────────────
{
  const s = criarSheet(H_PROG, [
    ['ana@t.com',   P, 'Aula_1', 'SIM', 9.0, 1],
    ['bruno@t.com', P, 'Aula_1', 'SIM', 8.0, 1],
  ])
  const { buscarPosicaoRanking } = carregar(s)
  const bruto = JSON.stringify(buscarPosicaoRanking('ana@t.com', P))
  checar('retorno não contém e-mail de ninguém',
    !bruto.includes('@'), 'retorno = ' + bruto)
  checar('retorno tem só posicao e total',
    JSON.stringify(Object.keys(JSON.parse(bruto)).sort()) === '["posicao","total"]')
}

console.log(falhas === 0 ? '\nTodos os testes passaram.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)

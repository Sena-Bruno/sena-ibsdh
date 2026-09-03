// Testa buscarTentativaAnterior (tentativa-anterior.gs) simulando o Sheets.
//
// Além do resultado, este harness conta QUANTAS células de texto longo foram
// lidas: a função existe para trazer o texto de UMA tentativa, e o modo errado
// de fazer isso (carregar a aba inteira) já derrubou a página do Mentor antes.

import fs from 'fs'
import vm from 'vm'

const ARQ = new URL('./tentativa-anterior.gs', import.meta.url).pathname

const H_AVAL = ['id_avaliacao', 'id_resposta', 'timestamp', 'email', 'curso', 'aula',
  'perfil', 'nota_total', 'nota_minima', 'aprovado', 'score', 'fortes', 'atencao',
  'prescricao', 'justificativa']
const H_RESP = ['id_resposta', 'timestamp', 'email', 'curso', 'aula', 'perfil',
  'resposta_texto', 'hash_resposta']

const LONGO = 'x'.repeat(4000)

let celulasLongasLidas = 0

function aval(id, idResp, ts, email, curso, aula, perfil, nota, aprovado, atencao) {
  return [id, idResp, ts, email, curso, aula, perfil, nota, 7, aprovado, 80,
    LONGO, atencao, LONGO, LONGO]
}
function resp(idResp, texto) {
  return [idResp, '2026-01-01', 'a@t.com', 'P', 'Aula_1', 'Ansioso', texto, 'hash']
}

function criarSheet(headers, linhas, colunasLongas) {
  const grid = [headers].concat(linhas)
  return {
    getLastRow: () => grid.length,
    getLastColumn: () => headers.length,
    getRange(l, c, nl, nc) {
      const linhasN = nl === undefined ? 1 : nl
      const colsN = nc === undefined ? 1 : nc
      // Conta leitura de coluna de texto longo, só a partir da linha 2: a
      // linha 1 é o cabeçalho, onde essas colunas guardam apenas o nome.
      if (l >= 2) {
        for (let k = 0; k < colsN; k++) {
          if (colunasLongas.includes(c - 1 + k)) celulasLongasLidas += linhasN
        }
      }
      return {
        getValues: () => {
          const out = []
          for (let r = 0; r < linhasN; r++) {
            const row = grid[l - 1 + r] || []
            out.push(row.slice(c - 1, c - 1 + colsN))
          }
          return out
        },
        getValue: () => (grid[l - 1] || [])[c - 1]
      }
    }
  }
}

function carregar(avaliacoes, respostas) {
  const sheets = {
    Avaliacoes_SENA: criarSheet(H_AVAL, avaliacoes, [11, 12, 13, 14]),
    Respostas_Aluno: criarSheet(H_RESP, respostas, [6])
  }
  const sandbox = {
    CONFIG: { SHEET_ID: 'f', SHEETS: { AVALIACOES: 'Avaliacoes_SENA', RESPOSTAS: 'Respostas_Aluno' } },
    normalizarTexto: (v) => String(v === undefined || v === null ? '' : v).trim(),
    SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => sheets[n] || null }) },
    registrarLog: () => {},
    Math, Object, String, Number, JSON, Date,
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

const A = 'ana@t.com', P = 'Practitioner', AULA = 'Aula_1'

// ── 1) duas tentativas: devolve a anterior, não a atual ─────────────────────
{
  const ctx = carregar(
    [
      aval('av1', 'rs1', '2026-01-01T10:00:00Z', A, P, AULA, 'Ansioso', 6.0, 'NAO', 'Faltou checar risco'),
      aval('av2', 'rs2', '2026-02-01T10:00:00Z', A, P, AULA, 'Ansioso', 8.5, 'SIM', 'Quase lá')
    ],
    [resp('rs1', 'primeira conduta'), resp('rs2', 'segunda conduta')]
  )
  const r = ctx.buscarTentativaAnterior(A, P, AULA)
  checar('devolve a anterior (av1), não a que acabou de ser enviada',
    r.anterior && r.anterior.id === 'av1', JSON.stringify(r.anterior && r.anterior.id))
  checar('traz o texto da resposta daquela tentativa',
    r.anterior.resposta === 'primeira conduta')
  checar('traz os pontos de atenção daquela tentativa',
    r.anterior.atencao === 'Faltou checar risco')
  checar('traz nota e aprovado', r.anterior.nota === 6 && r.anterior.aprovado === false)
  checar('não vaza campos internos',
    r.anterior.linha === undefined && r.anterior.idResposta === undefined,
    Object.keys(r.anterior).join(','))
}

// ── 2) primeira tentativa: não há anterior ──────────────────────────────────
{
  const ctx = carregar(
    [aval('av1', 'rs1', '2026-01-01T10:00:00Z', A, P, AULA, 'Ansioso', 6.0, 'NAO', 'x')],
    [resp('rs1', 'única conduta')]
  )
  checar('uma só tentativa devolve null', ctx.buscarTentativaAnterior(A, P, AULA).anterior === null)
}

// ── 3) exclusão explícita por id ────────────────────────────────────────────
{
  const ctx = carregar(
    [
      aval('av1', 'rs1', '2026-01-01T10:00:00Z', A, P, AULA, 'Ansioso', 6.0, 'NAO', 'a1'),
      aval('av2', 'rs2', '2026-02-01T10:00:00Z', A, P, AULA, 'Ansioso', 7.0, 'SIM', 'a2'),
      aval('av3', 'rs3', '2026-03-01T10:00:00Z', A, P, AULA, 'Ansioso', 9.0, 'SIM', 'a3')
    ],
    [resp('rs1', 'c1'), resp('rs2', 'c2'), resp('rs3', 'c3')]
  )
  checar('sem id: descarta a mais recente e devolve a seguinte',
    ctx.buscarTentativaAnterior(A, P, AULA).anterior.id === 'av2')
  checar('com id da atual: exclui aquela especificamente',
    ctx.buscarTentativaAnterior(A, P, AULA, 'av3').anterior.id === 'av2')
  // Se o chamador passar o id de uma tentativa antiga (fora do fluxo normal),
  // a mais recente passa a ser a "anterior" — comportamento explícito.
  checar('com id de uma antiga: devolve a mais recente',
    ctx.buscarTentativaAnterior(A, P, AULA, 'av1').anterior.id === 'av3')
}

// ── 4) ordena por timestamp, não pela ordem das linhas ──────────────────────
{
  const ctx = carregar(
    [
      aval('av2', 'rs2', '2026-03-01T10:00:00Z', A, P, AULA, 'Ansioso', 9.0, 'SIM', 'a2'),
      aval('av1', 'rs1', '2026-01-01T10:00:00Z', A, P, AULA, 'Ansioso', 6.0, 'NAO', 'a1')
    ],
    [resp('rs1', 'c1'), resp('rs2', 'c2')]
  )
  checar('linhas fora de ordem cronológica: usa o timestamp',
    ctx.buscarTentativaAnterior(A, P, AULA).anterior.id === 'av1')
}

// ── 5) isolamento por aluno, curso e aula ───────────────────────────────────
{
  const ctx = carregar(
    [
      aval('av1', 'rs1', '2026-01-01T10:00:00Z', A, P, AULA, 'Ansioso', 6.0, 'NAO', 'a1'),
      aval('av2', 'rs2', '2026-02-01T10:00:00Z', 'outro@t.com', P, AULA, 'Ansioso', 9, 'SIM', 'x'),
      aval('av3', 'rs3', '2026-02-02T10:00:00Z', A, 'Master', AULA, 'Ansioso', 9, 'SIM', 'x'),
      aval('av4', 'rs4', '2026-02-03T10:00:00Z', A, P, 'Aula_2', 'Ansioso', 9, 'SIM', 'x'),
      aval('av5', 'rs5', '2026-03-01T10:00:00Z', A, P, AULA, 'Cético', 8.0, 'SIM', 'a5')
    ],
    [resp('rs1', 'c1'), resp('rs5', 'c5')]
  )
  const r = ctx.buscarTentativaAnterior(A, P, AULA)
  checar('ignora outro aluno, outro curso e outra aula',
    r.anterior.id === 'av1', 'veio: ' + (r.anterior && r.anterior.id))
}

// ── 6) volume lido ──────────────────────────────────────────────────────────
{
  const avaliacoes = []
  const respostas = []
  for (let i = 0; i < 500; i++) {
    avaliacoes.push(aval('av' + i, 'rs' + i, '2026-01-' + String((i % 28) + 1).padStart(2, '0'),
      i % 5 === 0 ? A : 'outro' + i + '@t.com', P, AULA, 'Ansioso', 7, 'SIM', 'atencao ' + i))
    respostas.push(resp('rs' + i, 'conduta ' + i + ' ' + LONGO))
  }
  celulasLongasLidas = 0
  const ctx = carregar(avaliacoes, respostas)
  const r = ctx.buscarTentativaAnterior(A, P, AULA)
  checar('encontra a anterior numa base de 500 linhas', r.anterior !== null)
  // 1 célula de `atencao` + 1 de `resposta_texto`. Carregar as abas inteiras
  // seriam 500 × 4 + 500 = 2.500 células de texto longo.
  checar('lê no máximo 2 células de texto longo, não a aba inteira',
    celulasLongasLidas <= 2, 'células longas lidas: ' + celulasLongasLidas)
}

// ── 7) bordas ───────────────────────────────────────────────────────────────
{
  const ctx = carregar([], [])
  checar('aba vazia não estoura', ctx.buscarTentativaAnterior(A, P, AULA).anterior === null)

  const ctx2 = carregar(
    [
      aval('av1', 'rs-inexistente', '2026-01-01T10:00:00Z', A, P, AULA, 'Ansioso', 6, 'NAO', 'a1'),
      aval('av2', 'rs2', '2026-02-01T10:00:00Z', A, P, AULA, 'Ansioso', 8, 'SIM', 'a2')
    ],
    [resp('rs2', 'c2')]
  )
  const r = ctx2.buscarTentativaAnterior(A, P, AULA)
  checar('resposta não encontrada devolve texto vazio, não erro',
    r.anterior !== null && r.anterior.resposta === '')

  const ctx3 = carregar([aval('av1', 'rs1', '2026-01-01', A, P, AULA, 'x', 6, 'NAO', 'a')], [resp('rs1', 'c')])
  checar('parâmetros vazios não estouram',
    ctx3.buscarTentativaAnterior('', P, AULA).anterior === null &&
    ctx3.buscarTentativaAnterior(A, undefined, AULA).anterior === null &&
    ctx3.buscarTentativaAnterior(A, P, '').anterior === null)
}

console.log(falhas === 0 ? '\nTodos os testes passaram.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)

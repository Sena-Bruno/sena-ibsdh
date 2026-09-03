// Testa buscarEvolucaoPerfis (evolucao-perfis.gs) simulando a API do Sheets.

import fs from 'fs'
import vm from 'vm'

const ARQ = new URL('./evolucao-perfis.gs', import.meta.url).pathname

const H = ['id_avaliacao', 'id_resposta', 'timestamp', 'email', 'curso', 'aula', 'perfil',
  'nota_total', 'nota_minima', 'aprovado', 'score_objetivo_percentual', 'fortes',
  'atencao', 'prescricao', 'justificativa']

// linha completa, com as colunas de texto longo que a função NÃO deve precisar ler
function linha(ts, email, curso, perfil, nota, aprovado) {
  return ['av', 'rs', ts, email, curso, 'Aula_1', perfil, nota, 7, aprovado, 80,
    'x'.repeat(3000), 'y'.repeat(3000), 'z'.repeat(3000), 'w'.repeat(3000)]
}

let colunasLidas = 0

function criarSheet(linhas) {
  const grid = [H].concat(linhas)
  return {
    getLastRow: () => grid.length,
    getLastColumn: () => H.length,
    getRange(l, c, nl, nc) {
      const linhasN = nl === undefined ? 1 : nl
      const colsN = nc === undefined ? 1 : nc
      return {
        getValues: () => {
          // registra a largura do bloco de dados (a leitura do cabeçalho é
          // sempre a linha 1, e essa não conta)
          if (l > 1) colunasLidas = colsN
          const out = []
          for (let r = 0; r < linhasN; r++) {
            const row = grid[l - 1 + r] || []
            out.push(row.slice(c - 1, c - 1 + colsN))
          }
          return out
        }
      }
    }
  }
}

function carregar(sheet) {
  const sandbox = {
    CONFIG: { SHEET_ID: 'f', DEFAULT_NOTA_MINIMA: 7, SHEETS: { AVALIACOES: 'Avaliacoes_SENA' } },
    normalizarTexto: (v) => String(v || '').trim(),
    SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => (n === 'Avaliacoes_SENA' ? sheet : null) }) },
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

const A = 'ana@t.com'
const P = 'Practitioner'

// ── 1) agregação e ordem ────────────────────────────────────────────────────
{
  const s = criarSheet([
    linha('2026-01-01', A, P, 'Ansioso', 9.0, 'SIM'),
    linha('2026-01-02', A, P, 'Ansioso', 8.0, 'SIM'),
    linha('2026-01-03', A, P, 'Cético',  5.0, 'NAO'),
    linha('2026-01-04', A, P, 'Cético',  6.0, 'NAO'),
    linha('2026-01-05', A, P, 'Evitativo', 7.5, 'SIM'),
  ])
  const r = carregar(s).buscarEvolucaoPerfis(A, P)
  checar('agrupa por perfil', r.perfis.length === 3)
  checar('ordena do pior para o melhor — é a ordem acionável',
    r.perfis.map(p => p.perfil).join(',') === 'Cético,Evitativo,Ansioso',
    r.perfis.map(p => p.perfil + ':' + p.media).join(', '))
  checar('média com uma casa decimal', r.perfis[0].media === 5.5)
  checar('conta sessões e aprovadas',
    r.perfis[2].sessoes === 2 && r.perfis[2].aprovadas === 2)
  checar('devolve a nota mínima', r.nota_minima === 7)
}

// ── 2) última nota é a do timestamp mais recente, não a última linha ─────────
{
  const s = criarSheet([
    linha('2026-03-10', A, P, 'Ansioso', 9.5, 'SIM'),   // mais recente, vem primeiro
    linha('2026-01-05', A, P, 'Ansioso', 4.0, 'NAO'),
  ])
  const r = carregar(s).buscarEvolucaoPerfis(A, P)
  checar('última nota vem do timestamp mais recente, fora de ordem na planilha',
    r.perfis[0].ultima_nota === 9.5,
    'ultima_nota = ' + r.perfis[0].ultima_nota)
  checar('média ainda usa todas as sessões', r.perfis[0].media === 6.8)
}

// ── 3) isolamento por aluno e por curso ─────────────────────────────────────
{
  const s = criarSheet([
    linha('2026-01-01', A, P, 'Ansioso', 9.0, 'SIM'),
    linha('2026-01-02', 'outro@t.com', P, 'Cético', 3.0, 'NAO'),
    linha('2026-01-03', A, 'Master_PNL', 'Dissociado', 2.0, 'NAO'),
  ])
  const r = carregar(s).buscarEvolucaoPerfis(A, P)
  checar('não mistura outro aluno nem outro curso',
    r.perfis.length === 1 && r.perfis[0].perfil === 'Ansioso',
    JSON.stringify(r.perfis.map(p => p.perfil)))
}

// ── 4) lê só o bloco mínimo de colunas ──────────────────────────────────────
{
  colunasLidas = 0
  const s = criarSheet([linha('2026-01-01', A, P, 'Ansioso', 9.0, 'SIM')])
  carregar(s).buscarEvolucaoPerfis(A, P)
  // timestamp(2) .. aprovado(9) = 8 colunas; deixa de fora as 4 de texto longo
  checar('não carrega as colunas de texto longo da IA', colunasLidas === 8,
    'colunas lidas: ' + colunasLidas + ' (a aba tem ' + H.length + ')')
}

// ── 5) bordas ───────────────────────────────────────────────────────────────
{
  const vazia = carregar(criarSheet([])).buscarEvolucaoPerfis(A, P)
  checar('aba sem linhas devolve lista vazia, não erro',
    Array.isArray(vazia.perfis) && vazia.perfis.length === 0)

  const s = criarSheet([
    linha('2026-01-01', A, P, 'Ansioso', '', 'SIM'),      // nota vazia
    linha('2026-01-02', A, P, '',        8.0, 'SIM'),     // perfil vazio
    linha('2026-01-03', A, P, 'Cético',  7.0, 'SIM'),
  ])
  const r = carregar(s).buscarEvolucaoPerfis(A, P)
  checar('ignora linha sem nota e sem perfil, sem quebrar a média',
    r.perfis.length === 1 && r.perfis[0].perfil === 'Cético' && r.perfis[0].media === 7)

  const ctx = carregar(criarSheet([linha('2026-01-01', A, P, 'Ansioso', 9, 'SIM')]))
  checar('email vazio não estoura', ctx.buscarEvolucaoPerfis('', P).perfis.length === 0)
  checar('curso indefinido não estoura', ctx.buscarEvolucaoPerfis(A, undefined).perfis.length === 0)
}

console.log(falhas === 0 ? '\nTodos os testes passaram.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)

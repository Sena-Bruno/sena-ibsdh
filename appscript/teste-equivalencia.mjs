// Verifica que as funções corrigidas produzem EXATAMENTE o mesmo resultado que
// as originais, simulando a API do Google Sheets (SpreadsheetApp/CacheService).
// Também conta quantas células cada versão lê, para comprovar o ganho.

import fs from 'fs'
import vm from 'vm'

const ARQ_NOVO = new URL('./funcoes-corrigidas.gs', import.meta.url).pathname

// ── Mock do Sheets ───────────────────────────────────────────────────────────
// Mede o VOLUME de dados lido (bytes), não a contagem de células: o custo real
// da API do Sheets vem do tamanho do conteúdo, e uma célula de resposta_texto
// tem ~4.800 caracteres enquanto uma nota tem 3.
let celulasLidas = 0
let bytesLidos = 0

const tamanho = (v) => String(v === undefined || v === null ? '' : v).length

function criarSheet(nome, headers, linhas) {
  const grid = [headers].concat(linhas)
  return {
    nome,
    grid,
    getLastRow: () => grid.length,
    getLastColumn: () => headers.length,
    getDataRange() {
      return {
        getValues: () => {
          celulasLidas += grid.length * headers.length
          for (const r of grid) for (const v of r) bytesLidos += tamanho(v)
          return grid.map(r => r.slice())
        }
      }
    },
    getRange(linha, coluna, nLinhas, nColunas) {
      // getRange(linha, coluna) -> célula única
      const nl = nLinhas === undefined ? 1 : nLinhas
      const nc = nColunas === undefined ? 1 : nColunas
      return {
        getValues: () => {
          celulasLidas += nl * nc
          const out = []
          for (let r = 0; r < nl; r++) {
            const row = grid[linha - 1 + r] || []
            const fatia = row.slice(coluna - 1, coluna - 1 + nc)
            for (const v of fatia) bytesLidos += tamanho(v)
            out.push(fatia)
          }
          return out
        },
        getValue: () => {
          celulasLidas += 1
          const row = grid[linha - 1] || []
          bytesLidos += tamanho(row[coluna - 1])
          return row[coluna - 1]
        }
      }
    }
  }
}

// ── Dados de teste ───────────────────────────────────────────────────────────
const H_AVAL = ['id_avaliacao','id_resposta','timestamp','email','curso','aula','perfil',
  'nota_total','nota_minima','aprovado','score_objetivo_percentual','fortes','atencao',
  'prescricao','justificativa','versao_prompt','versao_base','modelo_ia','tempo_ms']

const H_RESP = ['id_resposta','timestamp','email','curso','aula','perfil','resposta_texto','hash_resposta']
const H_FEED = ['timestamp','email_mentor','id_avaliacao','feedback','moderado']

const PERFIS = ['Ansioso','Cético','Evitativo','Intelectualizador','Dissociado','Depressivo']
const CURSOS = ['Practitioner','Master_PNL']
const TEXTO_LONGO = 'x'.repeat(4800) // simula resposta_texto perto do limite de 5000

function gerarDados(nLinhas, seed = 1) {
  let s = seed
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648

  const aval = [], resp = []
  for (let i = 0; i < nLinhas; i++) {
    const idAval = 'aval-' + i
    const idResp = 'resp-' + i
    const email = 'aluno' + Math.floor(rnd() * 30) + '@teste.com'
    const curso = CURSOS[Math.floor(rnd() * CURSOS.length)]
    const aula = 'Aula_' + (1 + Math.floor(rnd() * 10))
    const perfil = PERFIS[Math.floor(rnd() * PERFIS.length)]
    const nota = Number((rnd() * 10).toFixed(1))
    const aprovado = nota >= 7 ? 'SIM' : 'NAO'
    // alguns textos curtos, para exercitar o filtro texto.length < 50
    const texto = rnd() < 0.15 ? 'curta' : TEXTO_LONGO

    aval.push([idAval, idResp, '2026-01-01', email, curso, aula, perfil, nota, 7, aprovado,
      80, 'fortes ' + i, 'atencao '.repeat(60), 'prescricao '.repeat(60), 'justif '.repeat(60),
      '3.0.0', '1.0.0', 'llama', 1200])
    resp.push([idResp, '2026-01-01', email, curso, aula, perfil, texto, 'hash'])
  }

  const feed = [
    ['2026-01-01', 'aluno1@teste.com', 'aval-3', 'feedback ja dado', 'NAO'],
    ['2026-01-01', 'aluno1@teste.com', 'aval-7', 'outro feedback', 'NAO'],
  ]
  return { aval, resp, feed }
}

// ── Implementações ORIGINAIS (como estão hoje no Apps Script) ────────────────
function buscarRankingPerfisORIGINAL(curso, ctx) {
  const sheet = ctx.sheets['Avaliacoes_SENA']
  if (!sheet) return { ranking: [] }
  const dados = sheet.getDataRange().getValues()
  const headers = dados[0]
  const iCurso = headers.indexOf('curso')
  const iPerfil = headers.indexOf('perfil')
  const iNota = headers.indexOf('nota_total')
  const iAprov = headers.indexOf('aprovado')
  const iEmail = headers.indexOf('email')

  const perfilMap = {}
  for (let i = 1; i < dados.length; i++) {
    const row = dados[i]
    if (String(row[iCurso]).trim() !== curso.trim()) continue
    const perfil = String(row[iPerfil] || '').trim()
    if (!perfil) continue
    if (!perfilMap[perfil]) perfilMap[perfil] = { total: 0, aprovacoes: 0, soma: 0, alunos: new Set() }
    perfilMap[perfil].total++
    perfilMap[perfil].soma += Number(row[iNota] || 0)
    if (String(row[iAprov]).trim().toUpperCase() === 'SIM') perfilMap[perfil].aprovacoes++
    perfilMap[perfil].alunos.add(String(row[iEmail]).toLowerCase().trim())
  }

  const ranking = Object.keys(perfilMap).map(function (perfil) {
    const d = perfilMap[perfil]
    return {
      perfil: perfil,
      taxa_aprovacao: Math.round((d.aprovacoes / d.total) * 100),
      media: Number((d.soma / d.total).toFixed(1)),
      total_sessoes: d.total,
      alunos_unicos: d.alunos.size
    }
  }).sort(function (a, b) { return b.taxa_aprovacao - a.taxa_aprovacao })

  return { ranking: ranking }
}

function buscarRespostasParaMentorORIGINAL(emailMentor, curso, aula, ctx) {
  const sheetAval = ctx.sheets['Avaliacoes_SENA']
  const sheetResp = ctx.sheets['Respostas_Aluno']
  const sheetFeed = ctx.sheets['Feedbacks_Mentor']
  if (!sheetAval || !sheetResp) return { itens: [] }

  const dadosAval = sheetAval.getDataRange().getValues()
  const headersA = dadosAval[0]
  const iEmailA = headersA.indexOf('email')
  const iCursoA = headersA.indexOf('curso')
  const iAulaA = headersA.indexOf('aula')
  const iIdRespA = headersA.indexOf('id_resposta')
  const iIdAvalA = headersA.indexOf('id_avaliacao')
  const iNota = headersA.indexOf('nota_total')
  const iAprov = headersA.indexOf('aprovado')
  const iFortes = headersA.indexOf('fortes')

  const dadosResp = sheetResp.getDataRange().getValues()
  const headersR = dadosResp[0]
  const iIdR = headersR.indexOf('id_resposta')
  const iTextoR = headersR.indexOf('resposta_texto')
  const respMap = {}
  for (let i = 1; i < dadosResp.length; i++) {
    respMap[String(dadosResp[i][iIdR])] = String(dadosResp[i][iTextoR] || '')
  }

  const jaAvaliados = new Set()
  if (sheetFeed && sheetFeed.getLastRow() > 1) {
    const feedDados = sheetFeed.getDataRange().getValues()
    const iEmailF = feedDados[0].indexOf('email_mentor')
    const iIdF = feedDados[0].indexOf('id_avaliacao')
    for (let i = 1; i < feedDados.length; i++) {
      if (String(feedDados[i][iEmailF]).toLowerCase() === emailMentor.toLowerCase()) {
        jaAvaliados.add(String(feedDados[i][iIdF]))
      }
    }
  }

  const itens = []
  for (let i = dadosAval.length - 1; i >= 1; i--) {
    const row = dadosAval[i]
    if (String(row[iEmailA]).toLowerCase() === emailMentor.toLowerCase()) continue
    if (String(row[iCursoA]).trim() !== curso.trim()) continue
    if (aula && String(row[iAulaA]).trim() !== aula.trim()) continue
    if (String(row[iAprov]).trim().toUpperCase() !== 'SIM') continue
    const idAval = String(row[iIdAvalA] || '')
    if (jaAvaliados.has(idAval)) continue
    const idResp = String(row[iIdRespA] || '')
    const texto = respMap[idResp] || ''
    if (texto.length < 50) continue
    itens.push({
      id_avaliacao: idAval,
      aula: String(row[iAulaA] || ''),
      nota: Number(row[iNota] || 0),
      fortes: String(row[iFortes] || ''),
      trecho: texto.substring(0, 500)
    })
    if (itens.length >= 5) break
  }
  return { itens: itens }
}

// ── Carrega as funções NOVAS do arquivo .gs ─────────────────────────────────
function carregarNovas(ctx) {
  const codigo = fs.readFileSync(ARQ_NOVO, 'utf8')
  const sandbox = {
    CONFIG: { SHEET_ID: 'fake' },
    normalizarTexto: (v) => String(v || '').trim(),
    SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => ctx.sheets[n] || null }) },
    CacheService: { getScriptCache: () => ctx.cache },
    Logger: { log: () => {} },
    Math, Object, String, Number, JSON, Date,
  }
  vm.createContext(sandbox)
  vm.runInContext(codigo, sandbox)
  return sandbox
}

// ── Execução dos testes ──────────────────────────────────────────────────────
let falhas = 0
function checar(nome, ok, detalhe) {
  if (!ok) falhas++
  console.log(`${ok ? 'PASS' : 'FALHA'} — ${nome}${detalhe ? '\n   ' + detalhe : ''}`)
}

function novoCache() {
  const store = {}
  return { get: (k) => store[k] || null, put: (k, v) => { store[k] = v } }
}

function montarCtx(dados) {
  return {
    sheets: {
      'Avaliacoes_SENA': criarSheet('Avaliacoes_SENA', H_AVAL, dados.aval),
      'Respostas_Aluno': criarSheet('Respostas_Aluno', H_RESP, dados.resp),
      'Feedbacks_Mentor': criarSheet('Feedbacks_Mentor', H_FEED, dados.feed),
    },
    cache: novoCache(),
  }
}

console.log('=== Equivalência: resultado novo === resultado original ===\n')

for (const [rotulo, n, seed] of [['base pequena', 30, 7], ['base média', 400, 42], ['base grande', 2000, 99]]) {
  const dados = gerarDados(n, seed)

  // Ranking
  for (const curso of CURSOS) {
    const ctxA = montarCtx(dados)
    const esperado = buscarRankingPerfisORIGINAL(curso, ctxA)
    const ctxB = montarCtx(dados)
    const sb = carregarNovas(ctxB)
    const obtido = sb.buscarRankingPerfis(curso)
    checar(`ranking_perfis — ${rotulo} / ${curso}`,
      JSON.stringify(obtido) === JSON.stringify(esperado),
      JSON.stringify(obtido) !== JSON.stringify(esperado)
        ? `esperado: ${JSON.stringify(esperado).slice(0, 200)}\n   obtido:   ${JSON.stringify(obtido).slice(0, 200)}` : '')
  }

  // Mentor — vários mentores e filtros de aula
  for (const [email, aula] of [['aluno1@teste.com', ''], ['aluno5@teste.com', ''], ['aluno2@teste.com', 'Aula_3']]) {
    const ctxA = montarCtx(dados)
    const esperado = buscarRespostasParaMentorORIGINAL(email, 'Practitioner', aula, ctxA)
    const ctxB = montarCtx(dados)
    const sb = carregarNovas(ctxB)
    const obtido = sb.buscarRespostasParaMentor(email, 'Practitioner', aula)
    checar(`buscar_mentor — ${rotulo} / ${email}${aula ? ' / ' + aula : ''}`,
      JSON.stringify(obtido) === JSON.stringify(esperado),
      JSON.stringify(obtido) !== JSON.stringify(esperado)
        ? `esperado: ${JSON.stringify(esperado).slice(0, 300)}\n   obtido:   ${JSON.stringify(obtido).slice(0, 300)}` : '')
  }
}

console.log('\n=== Volume de dados lido do Sheets (base de 2000 linhas) ===\n')
{
  const dados = gerarDados(2000, 99)
  const mb = (b) => (b / 1024 / 1024).toFixed(2) + ' MB'

  function medir(fn) {
    celulasLidas = 0; bytesLidos = 0
    fn()
    return { celulas: celulasLidas, bytes: bytesLidos }
  }

  const ctxA = montarCtx(dados)
  const antesRank = medir(() => buscarRankingPerfisORIGINAL('Practitioner', ctxA))

  const ctxB = montarCtx(dados)
  const sbB = carregarNovas(ctxB)
  const depoisRank = medir(() => sbB.buscarRankingPerfis('Practitioner'))
  const cacheRank = medir(() => sbB.buscarRankingPerfis('Practitioner')) // 2a chamada

  console.log(`ranking_perfis:  ${mb(antesRank.bytes)} -> ${mb(depoisRank.bytes)}` +
    `  (${(100 - depoisRank.bytes / antesRank.bytes * 100).toFixed(0)}% menos dados)`)
  console.log(`ranking_perfis (2a chamada, cache): ${mb(cacheRank.bytes)}`)
  checar('ranking lê menos dados que antes', depoisRank.bytes < antesRank.bytes)
  checar('cache evita releitura', cacheRank.bytes === 0)

  const ctxC = montarCtx(dados)
  const antesMentor = medir(() => buscarRespostasParaMentorORIGINAL('aluno1@teste.com', 'Practitioner', '', ctxC))

  const ctxD = montarCtx(dados)
  const sbD = carregarNovas(ctxD)
  const depoisMentor = medir(() => sbD.buscarRespostasParaMentor('aluno1@teste.com', 'Practitioner', ''))

  console.log(`buscar_mentor:   ${mb(antesMentor.bytes)} -> ${mb(depoisMentor.bytes)}` +
    `  (${(100 - depoisMentor.bytes / antesMentor.bytes * 100).toFixed(0)}% menos dados)`)
  checar('mentor lê menos dados que antes', depoisMentor.bytes < antesMentor.bytes)
  checar('mentor corta pelo menos 90% do volume', depoisMentor.bytes < antesMentor.bytes * 0.10,
    `redução real: ${(100 - depoisMentor.bytes / antesMentor.bytes * 100).toFixed(1)}%`)
}

console.log('\n=== Filtro "já avaliados" (exclusão via Feedbacks_Mentor) ===\n')
{
  // Monta um cenário controlado: todas as avaliações são candidatas válidas
  // (aprovadas, de outro aluno, texto longo). O mentor já comentou as 3 mais
  // recentes, então elas TÊM que ser puladas pelas duas versões.
  const aval = [], resp = []
  for (let i = 0; i < 10; i++) {
    aval.push(['aval-' + i, 'resp-' + i, '2026-01-01', 'outro@teste.com', 'Practitioner',
      'Aula_1', 'Ansioso', 9, 7, 'SIM', 80, 'fortes ' + i, 'a', 'p', 'j', '3.0.0', '1.0.0', 'llama', 1])
    resp.push(['resp-' + i, '2026-01-01', 'outro@teste.com', 'Practitioner', 'Aula_1',
      'Ansioso', TEXTO_LONGO, 'hash'])
  }
  const feed = [
    ['2026-01-01', 'mentor@teste.com', 'aval-9', 'ja comentei', 'NAO'],
    ['2026-01-01', 'mentor@teste.com', 'aval-8', 'ja comentei', 'NAO'],
    ['2026-01-01', 'mentor@teste.com', 'aval-7', 'ja comentei', 'NAO'],
    ['2026-01-01', 'OUTRO_MENTOR@teste.com', 'aval-6', 'de outro mentor', 'NAO'],
  ]
  const dados = { aval, resp, feed }

  const esperado = buscarRespostasParaMentorORIGINAL('mentor@teste.com', 'Practitioner', '', montarCtx(dados))
  const sb = carregarNovas(montarCtx(dados))
  const obtido = sb.buscarRespostasParaMentor('mentor@teste.com', 'Practitioner', '')

  const ids = obtido.itens.map(i => i.id_avaliacao)
  checar('exclui as avaliações já comentadas por este mentor',
    !ids.includes('aval-9') && !ids.includes('aval-8') && !ids.includes('aval-7'),
    'ids retornados: ' + JSON.stringify(ids))
  checar('NÃO exclui a comentada por outro mentor (aval-6)', ids.includes('aval-6'),
    'ids retornados: ' + JSON.stringify(ids))
  checar('resultado idêntico ao original neste cenário',
    JSON.stringify(obtido) === JSON.stringify(esperado))
  console.log('   ids retornados: ' + JSON.stringify(ids))

  // Mentor não pode ver as próprias respostas
  const proprias = { aval: aval.map(r => { const c = r.slice(); c[3] = 'mentor@teste.com'; return c }), resp, feed: [] }
  const sb2 = carregarNovas(montarCtx(proprias))
  checar('mentor não vê as próprias respostas',
    sb2.buscarRespostasParaMentor('mentor@teste.com', 'Practitioner', '').itens.length === 0)

  // Respostas curtas (<50 chars) devem ser ignoradas
  const curtas = { aval, resp: resp.map(r => { const c = r.slice(); c[6] = 'curta'; return c }), feed: [] }
  const sb3 = carregarNovas(montarCtx(curtas))
  checar('ignora respostas com menos de 50 caracteres',
    sb3.buscarRespostasParaMentor('mentor@teste.com', 'Practitioner', '').itens.length === 0)

  // Limite de 5 itens
  const sb4 = carregarNovas(montarCtx({ aval, resp, feed: [] }))
  checar('devolve no máximo 5 itens',
    sb4.buscarRespostasParaMentor('mentor@teste.com', 'Practitioner', '').itens.length === 5)
}

console.log('\n=== Casos de borda ===\n')
{
  // Abas vazias
  const vazio = { aval: [], resp: [], feed: [] }
  const ctx = montarCtx(vazio)
  const sb = carregarNovas(ctx)
  checar('ranking com aba vazia não estoura',
    JSON.stringify(sb.buscarRankingPerfis('Practitioner')) === '{"ranking":[]}')
  checar('mentor com aba vazia não estoura',
    JSON.stringify(sb.buscarRespostasParaMentor('a@b.com', 'Practitioner', '')) === '{"itens":[]}')

  // Parâmetros ausentes (o código antigo estourava com .toLowerCase() de undefined)
  const dados = gerarDados(50, 3)
  const ctx2 = montarCtx(dados)
  const sb2 = carregarNovas(ctx2)
  let okUndef = true
  try {
    sb2.buscarRespostasParaMentor(undefined, 'Practitioner', '')
    sb2.buscarRankingPerfis(undefined)
  } catch (e) { okUndef = false }
  checar('parâmetros indefinidos não estouram (novo)', okUndef)

  let originalEstoura = false
  try {
    buscarRespostasParaMentorORIGINAL(undefined, 'Practitioner', '', montarCtx(dados))
  } catch (e) { originalEstoura = true }
  console.log(`   (para comparar: a versão original ${originalEstoura ? 'ESTOURA' : 'não estoura'} com email indefinido)`)
}

console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} TESTE(S) FALHARAM`)
process.exit(falhas === 0 ? 0 : 1)

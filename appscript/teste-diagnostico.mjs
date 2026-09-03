// Testa o motor do diagnostico.gs — a parte que decide se uma resposta é
// OK, ERRO, FALTA NO SWITCH, VAZIO ou LENTO.
//
// Essa classificação é o valor todo do arquivo: um relatório que chama tudo
// de "erro" não ajuda a decidir nada. Especialmente "FALTA NO SWITCH" (o caso
// não foi colado no doPost) e "VAZIO" (respondeu certo, mas sem dados) — dois
// diagnósticos completamente diferentes que um relatório ingênuo confunde.

import fs from 'fs'
import vm from 'vm'

const ARQ = new URL('./diagnostico.gs', import.meta.url).pathname

function carregar(responder, relogio) {
  const linhas = []
  let agora = 0
  const sandbox = {
    Logger: { log: (s) => linhas.push(String(s)) },
    doPost: (e) => {
      const payload = JSON.parse(e.postData.contents)
      if (relogio) agora += relogio(payload.action)
      const r = responder(payload.action)
      if (r && r.lancar) throw new Error(r.lancar)
      return { getContent: () => r }
    },
    Date: class extends Date { getTime() { return agora } },
    Math, Object, String, Number, JSON, Array, RegExp,
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(ARQ, 'utf8'), sandbox)
  return { sandbox, linhas }
}

let falhas = 0
function checar(nome, ok, detalhe) {
  if (!ok) falhas++
  console.log(`${ok ? 'PASS' : 'FALHA'} — ${nome}${detalhe ? '\n   ' + detalhe : ''}`)
}

// Lê o status de uma linha da tabela: "action | ms | status | resposta"
function statusDe(linhas, action) {
  const l = linhas.find(x => x.startsWith(action + ' ') || x.startsWith(action + '|'))
  return l ? l.split('|')[2].trim() : '(sem linha)'
}

// ── classificação ───────────────────────────────────────────────────────────
{
  const respostas = {
    ok:      '{"nota":8.5,"aprovado":true}',
    erro:    '{"erro":true,"mensagem":"Aula não encontrada"}',
    switch:  '{"erro":true,"mensagem":"Ação desconhecida: titulos"}',
    vazio:   '{"turnos":[]}',
    objvaz:  '{}',
    lista:   '[]'
  }
  const { sandbox, linhas } = carregar((a) => respostas[a] || respostas.ok)
  sandbox.executarDiagnostico('teste', [
    { action: 'ok' }, { action: 'erro' }, { action: 'switch' },
    { action: 'vazio' }, { action: 'objvaz' }, { action: 'lista' }
  ])

  checar('resposta com dados → OK', statusDe(linhas, 'ok') === 'OK')
  checar('erro do backend → ERRO', statusDe(linhas, 'erro') === 'ERRO')
  // O ponto mais importante: sem isso, "não colei o caso no doPost" vira um
  // "erro" genérico e manda procurar o problema dentro da função.
  checar('"Ação desconhecida" → FALTA NO SWITCH, não ERRO',
    statusDe(linhas, 'switch') === 'FALTA NO SWITCH', statusDe(linhas, 'switch'))
  checar('lista vazia → VAZIO (respondeu certo, mas sem dados)',
    statusDe(linhas, 'vazio') === 'VAZIO', statusDe(linhas, 'vazio'))
  checar('objeto vazio → VAZIO', statusDe(linhas, 'objvaz') === 'VAZIO')
  checar('array vazio → VAZIO', statusDe(linhas, 'lista') === 'VAZIO')
}

// ── lentidão ────────────────────────────────────────────────────────────────
{
  // O travamento do Mentor não aparecia como erro: aparecia como espera.
  const { sandbox, linhas } = carregar(
    () => '{"itens":[{"id":"x"}]}',
    (a) => (a === 'lerdo' ? 20000 : 100)
  )
  sandbox.executarDiagnostico('teste', [{ action: 'rapido' }, { action: 'lerdo' }])
  checar('acima de 15s → LENTO', statusDe(linhas, 'lerdo') === 'LENTO', statusDe(linhas, 'lerdo'))
  checar('rápido continua OK', statusDe(linhas, 'rapido') === 'OK')
}

// ── exceção não tratada ─────────────────────────────────────────────────────
{
  const { sandbox, linhas } = carregar((a) =>
    a === 'quebra' ? { lancar: 'TypeError: x is not a function' } : '{"ok":1}')
  sandbox.executarDiagnostico('teste', [{ action: 'quebra' }])
  checar('exceção no doPost não derruba o diagnóstico',
    statusDe(linhas, 'quebra') === 'EXCEÇÃO', statusDe(linhas, 'quebra'))
  checar('a mensagem da exceção aparece no relatório',
    linhas.some(l => l.includes('is not a function')))
}

// ── resumo final ────────────────────────────────────────────────────────────
{
  const { sandbox, linhas } = carregar((a) =>
    a === 'ruim' ? '{"erro":true,"mensagem":"falhou"}' : '{"dado":1}')
  sandbox.executarDiagnostico('teste', [{ action: 'bom' }, { action: 'ruim' }])
  const texto = linhas.join('\n')
  checar('lista os problemas no fim, para não ter que reler a tabela',
    texto.includes('PRECISAM DE ATENÇÃO (1)') && texto.includes('ruim → ERRO'))

  const tudoBem = carregar(() => '{"dado":1}')
  tudoBem.sandbox.executarDiagnostico('teste', [{ action: 'a' }, { action: 'b' }])
  checar('quando tudo passa, diz isso claramente',
    tudoBem.linhas.join('\n').includes('Todas responderam OK'))
}

// ── aviso do e-mail de exemplo ──────────────────────────────────────────────
{
  const { sandbox, linhas } = carregar(() => '{"x":1}')
  sandbox.executarDiagnostico('teste', [{ action: 'a' }])
  checar('avisa se o e-mail de exemplo não foi trocado',
    linhas.some(l => l.includes('troque DIAG.EMAIL')))
}

console.log(falhas === 0 ? '\nTodos os testes passaram.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)

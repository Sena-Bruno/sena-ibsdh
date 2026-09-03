// Testa as funções migradas para o núcleo da Groq (migracao-groq.gs).
//
// O foco não é o texto que a IA devolve — isso não dá para testar. É o
// CONTRATO: mesmo formato de retorno da versão antiga, parâmetros certos
// chegando ao núcleo, e falha da IA não derrubando o que não depende dela.

import fs from 'fs'
import vm from 'vm'

const ARQ = new URL('./migracao-groq.gs', import.meta.url).pathname

function carregar(opcoes = {}) {
  const chamadas = []
  const logs = []

  const sandbox = {
    buscarProgressoAluno: () => opcoes.progresso || {},
    buscarBaseAula: () => {
      if (opcoes.baseAulaFalha) throw new Error('Aula não encontrada')
      return { titulo: opcoes.tituloAula || 'O CÓDIGO DA EXCELÊNCIA' }
    },
    chamarGroqTexto: (prompt, op) => {
      chamadas.push({ prompt, op })
      if (opcoes.iaFalha) throw new Error(opcoes.iaFalha)
      return opcoes.respostaIA === undefined
        ? '  Você já dominou o rapport; agora observe o que o silêncio revela.  '
        : opcoes.respostaIA
    },
    chamarGroqCore: (mensagens, op) => {
      chamadas.push({ mensagens, op })
      if (opcoes.iaFalha) throw new Error(opcoes.iaFalha)
      return opcoes.respostaIA === undefined
        ? '  E se eu não conseguir? Fico pensando nisso o tempo todo.  '
        : opcoes.respostaIA
    },
    PERFIS_CLINICOS: {
      Ansioso: {
        nome: 'Ansioso',
        descricao: 'Paciente agitado, fala acelerada',
        resistencias: ['Interrompe com "e se"', 'Antecipa problemas']
      }
    },
    extrairJSONRobusto: (bruto) => {
      // Réplica do comportamento do `Codigo.gs`: acha o primeiro objeto JSON
      // dentro do texto, mesmo cercado de markdown ou de prosa.
      const s = String(bruto)
      const i = s.indexOf('{')
      const f = s.lastIndexOf('}')
      if (i === -1 || f <= i) throw new Error('JSON não encontrado na resposta')
      return JSON.parse(s.slice(i, f + 1))
    },
    registrarLog: (tipo, email, curso, aula, mensagem) => logs.push({ tipo, mensagem }),
    Object, String, Number, JSON, Date, Math, Array,
  }
  vm.createContext(sandbox)
  vm.runInContext(fs.readFileSync(ARQ, 'utf8'), sandbox)
  return { sandbox, chamadas, logs }
}

let falhas = 0
function checar(nome, ok, detalhe) {
  if (!ok) falhas++
  console.log(`${ok ? 'PASS' : 'FALHA'} — ${nome}${detalhe ? '\n   ' + detalhe : ''}`)
}

console.log('=== gerarBoasVindas ===')

// ── contrato de retorno ─────────────────────────────────────────────────────
{
  const t = carregar({ progresso: { Aula_1: { aprovado: 'SIM' }, Aula_2: { aprovado: 'SIM' }, Aula_3: { aprovado: 'NAO' } } })
  const r = t.sandbox.gerarBoasVindas('ana@t.com', 'Practitioner', 'Aula_4', 'Ana')

  checar('devolve as três chaves de sempre',
    JSON.stringify(Object.keys(r).sort()) === '["aulas_aprovadas","mensagem","primeiro_acesso"]',
    Object.keys(r).join(','))
  checar('conta só as aulas aprovadas', r.aulas_aprovadas === 2, 'veio ' + r.aulas_aprovadas)
  checar('primeiro_acesso false quando já há aprovadas', r.primeiro_acesso === false)
  checar('mensagem vem sem espaços nas pontas',
    r.mensagem === 'Você já dominou o rapport; agora observe o que o silêncio revela.',
    JSON.stringify(r.mensagem))
}

// ── primeiro acesso ─────────────────────────────────────────────────────────
{
  const t = carregar({ progresso: {} })
  const r = t.sandbox.gerarBoasVindas('ana@t.com', 'Practitioner', 'Aula_1', 'Ana')
  checar('primeiro_acesso true sem nenhuma aprovada', r.primeiro_acesso === true)
  checar('o contexto do prompt reflete o primeiro acesso',
    /primeiro acesso/i.test(t.chamadas[0].prompt))
}

// ── parâmetros que chegam ao núcleo ─────────────────────────────────────────
//
// É o coração desta migração: max_tokens 120 era o bug que devolvia mensagem
// vazia. Se alguém baixar isso de novo, este teste cai.
{
  const t = carregar({ progresso: {} })
  t.sandbox.gerarBoasVindas('ana@t.com', 'Practitioner', 'Aula_1', 'Ana')
  const op = t.chamadas[0].op

  checar('pede 600 tokens, não 120', op.maxTokens === 600, 'maxTokens: ' + op.maxTokens)
  checar('mantém a temperatura alta da versão antiga (0.8)', op.temperature === 0.8)
  checar('usa system prompt próprio, não o de tutor',
    /SENA/.test(op.sistema) && /sem JSON/i.test(op.sistema), op.sistema)
}

// ── nome do aluno ───────────────────────────────────────────────────────────
{
  const t = carregar({ progresso: {} })
  t.sandbox.gerarBoasVindas('bruno.sena@hotmail.com', 'Practitioner', 'Aula_1', '')
  checar('sem nome, usa a parte do e-mail antes do @',
    /bruno\.sena/.test(t.chamadas[0].prompt) && !/hotmail/.test(t.chamadas[0].prompt.split('\n')[0]),
    t.chamadas[0].prompt.slice(0, 120))
}

// ── falha da IA não derruba o aluno ─────────────────────────────────────────
//
// A mensagem é decorativa. O que NÃO pode acontecer é o aluno ficar sem
// entrar na aula porque a Groq caiu.
{
  const t = carregar({ progresso: { Aula_1: { aprovado: 'SIM' } }, iaFalha: 'Nenhum modelo da Groq respondeu.' })
  let r, estourou = false
  try { r = t.sandbox.gerarBoasVindas('ana@t.com', 'Practitioner', 'Aula_2', 'Ana') }
  catch (e) { estourou = true }

  checar('não propaga a exceção da IA', estourou === false)
  checar('devolve mensagem vazia (a tela usa o texto padrão)', r && r.mensagem === '')
  checar('mas o resto do retorno continua correto',
    r && r.aulas_aprovadas === 1 && r.primeiro_acesso === false)
  // O ponto da migração: antes essa falha não aparecia em lugar nenhum.
  checar('registra a falha, que antes era silenciosa',
    t.logs.some(l => l.tipo === 'BOAS_VINDAS_ERROR'), JSON.stringify(t.logs))
}

// ── bordas ──────────────────────────────────────────────────────────────────
{
  const semTitulo = carregar({ progresso: {}, baseAulaFalha: true })
  const r1 = semTitulo.sandbox.gerarBoasVindas('ana@t.com', 'Practitioner', 'Aula_1', 'Ana')
  checar('aula sem título não impede a mensagem', r1.mensagem.length > 0)

  const vazia = carregar({ progresso: {}, respostaIA: '   ' })
  const r2 = vazia.sandbox.gerarBoasVindas('ana@t.com', 'Practitioner', 'Aula_1', 'Ana')
  checar('resposta só com espaços vira string vazia, não quebra', r2.mensagem === '')
}

console.log('\n=== responderComoPaciente ===')

// ── a conversa inteira chega ao núcleo ──────────────────────────────────────
//
// É o que diferencia esta função das outras: ela manda system + histórico +
// fala nova, não um prompt único. Se o histórico se perder, o paciente
// "esquece" o que foi dito e a sessão clínica deixa de fazer sentido.
{
  const t = carregar()
  const historico = [
    { role: 'terapeuta', texto: 'Bom dia, como você está?' },
    { role: 'paciente', texto: 'Não muito bem...' },
    { role: 'terapeuta', texto: 'O que te trouxe aqui?' }
  ]
  const r = t.sandbox.responderComoPaciente('Ansioso', historico, 'Practitioner', 'Aula_1', 'Respire comigo.')
  const msgs = t.chamadas[0].mensagens

  checar('devolve { resposta } como antes',
    JSON.stringify(Object.keys(r)) === '["resposta"]' &&
    r.resposta === 'E se eu não conseguir? Fico pensando nisso o tempo todo.',
    JSON.stringify(r))
  checar('primeira mensagem é o system com o perfil',
    msgs[0].role === 'system' && /Paciente agitado/.test(msgs[0].content))
  checar('o histórico inteiro é enviado, na ordem',
    msgs.length === 5, 'mensagens: ' + msgs.length)
  checar('terapeuta vira user e paciente vira assistant',
    msgs[1].role === 'user' && msgs[2].role === 'assistant' && msgs[3].role === 'user',
    msgs.map(m => m.role).join(','))
  checar('a fala nova entra por último',
    msgs[4].role === 'user' && msgs[4].content === 'Respire comigo.')
  checar('as resistências do perfil entram no system',
    /Antecipa problemas/.test(msgs[0].content))
}

// ── parâmetros ──────────────────────────────────────────────────────────────
{
  const t = carregar()
  t.sandbox.responderComoPaciente('Ansioso', [], 'Practitioner', 'Aula_1', 'oi')
  const op = t.chamadas[0].op
  checar('pede prosa, não JSON', op.json === false)
  checar('800 tokens, não 300 — o raciocínio come o orçamento', op.maxTokens === 800,
    'maxTokens: ' + op.maxTokens)
  checar('mantém a temperatura 0.85 que faz o paciente soar vivo', op.temperature === 0.85)
}

// ── primeira fala da sessão ─────────────────────────────────────────────────
{
  const t = carregar()
  t.sandbox.responderComoPaciente('Ansioso', [], 'Practitioner', 'Aula_1', 'Bom dia.')
  checar('sessão sem histórico manda só system + a fala', t.chamadas[0].mensagens.length === 2)

  const semArray = carregar()
  semArray.sandbox.responderComoPaciente('Ansioso', null, 'Practitioner', 'Aula_1', 'Bom dia.')
  checar('histórico null não quebra', semArray.chamadas[0].mensagens.length === 2)
}

// ── falhas ──────────────────────────────────────────────────────────────────
{
  const t = carregar()
  let msg = ''
  try { t.sandbox.responderComoPaciente('Inexistente', [], 'Practitioner', 'Aula_1', 'oi') }
  catch (e) { msg = e.message }
  checar('perfil inválido falha antes de gastar chamada de IA',
    /Perfil inválido/.test(msg) && t.chamadas.length === 0, msg)

  // Diferente das boas-vindas: aqui a resposta É a funcionalidade. Engolir a
  // falha deixaria o aluno falando sozinho com uma tela muda.
  const caiu = carregar({ iaFalha: 'Nenhum modelo da Groq respondeu.' })
  let estourou = false
  try { caiu.sandbox.responderComoPaciente('Ansioso', [], 'Practitioner', 'Aula_1', 'oi') }
  catch (e) { estourou = true }
  checar('falha da IA propaga — o aluno precisa saber', estourou === true)

  const semTema = carregar({ baseAulaFalha: true })
  const r = semTema.sandbox.responderComoPaciente('Ansioso', [], 'Practitioner', 'Aula_1', 'oi')
  checar('aula sem tema não impede a conversa', r.resposta.length > 0)
}

console.log('\n=== gerarReplayAnotado ===')

const RESPOSTA = 'Acolhi a respiração do paciente e devolvi o ritmo mais lento.'

function replayIA(obj) {
  return JSON.stringify(obj)
}

// ── o bug que não pode voltar ───────────────────────────────────────────────
//
// A versão original tinha ` + resposta + ` como TEXTO LITERAL dentro da crase:
// a IA recebia a string " + resposta + " e anotava o nada. O recurso ficou
// quebrado em silêncio até alguém ler o prompt. Este é o teste que impede a
// regressão — e foi por causa dele que pedi o Codigo.gs atualizado antes de
// migrar, em vez de partir da minha cópia velha.
{
  const t = carregar({ respostaIA: replayIA({ segmentos: [{ texto: RESPOSTA, tipo: 'forte', nota: 'bom rapport' }], ausencias: [] }) })
  t.sandbox.gerarReplayAnotado(RESPOSTA, 'fortes', 'atencao', 'prescricao', 'Ansioso', 'Practitioner', 'Aula_1')
  const user = t.chamadas[0].mensagens[1].content

  checar('a resposta do aluno chega interpolada no prompt',
    user.includes(RESPOSTA), user.slice(0, 200))
  checar('não sobrou o "+ resposta +" literal da versão antiga',
    !/\+\s*resposta\s*\+/.test(user))
}

// ── o rótulo que vazava como segmento ───────────────────────────────────────
{
  const t = carregar({ respostaIA: replayIA({ segmentos: [], ausencias: [] }) })
  t.sandbox.gerarReplayAnotado(RESPOSTA, '', '', '', '', 'Practitioner', 'Aula_1')
  const msgs = t.chamadas[0].mensagens
  const user = msgs[1].content

  checar('a resposta vai entre delimitadores, não colada num rótulo',
    user.indexOf('###RESPOSTA_INICIO###') < user.indexOf(RESPOSTA) &&
    user.indexOf(RESPOSTA) < user.indexOf('###RESPOSTA_FIM###'))
  checar('o prompt não começa mais com "Resposta do aluno:"',
    !/^Resposta do aluno:/.test(user), user.slice(0, 60))
  checar('o system manda segmentar só o que está entre as marcas',
    /APENAS o texto entre essas marcas/.test(msgs[0].content))
  checar('o feedback já gerado é marcado como contexto, não como fala do aluno',
    /NÃO faz parte da resposta do aluno/.test(user))
}

// ── parâmetros ──────────────────────────────────────────────────────────────
{
  const t = carregar({ respostaIA: replayIA({ segmentos: [], ausencias: [] }) })
  t.sandbox.gerarReplayAnotado(RESPOSTA, '', '', '', '', 'Practitioner', 'Aula_1')
  const op = t.chamadas[0].op
  checar('pede JSON', op.json === true)
  checar('mantém os 2000 tokens — o replay devolve o texto inteiro fatiado',
    op.maxTokens === 2000, 'maxTokens: ' + op.maxTokens)
  checar('mantém a temperatura 0.3 da versão antiga', op.temperature === 0.3)
}

// ── contrato de retorno ─────────────────────────────────────────────────────
{
  const t = carregar({ respostaIA: replayIA({
    segmentos: [
      { texto: 'Acolhi a respiração', tipo: 'forte', nota: 'rapport' },
      { texto: ' do paciente.', tipo: 'neutro', nota: '' }
    ],
    ausencias: ['Não checou o objetivo da sessão']
  }) })
  const r = t.sandbox.gerarReplayAnotado(RESPOSTA, '', '', '', '', 'Practitioner', 'Aula_1')

  checar('devolve segmentos e ausencias, sem erro',
    Array.isArray(r.segmentos) && Array.isArray(r.ausencias) && !r.erro, JSON.stringify(r))
  checar('preserva o texto e o tipo de cada segmento',
    r.segmentos[0].texto === 'Acolhi a respiração' && r.segmentos[0].tipo === 'forte')
  checar('preserva as ausências', r.ausencias[0] === 'Não checou o objetivo da sessão')
}

// ── o parser robusto entra no lugar do replace à mão ────────────────────────
//
// O `replace(/```json|```/g, '')` antigo só tirava as crases; texto antes ou
// depois do JSON derrubava o JSON.parse e o aluno via "não foi possível".
{
  const t = carregar({ respostaIA: 'Claro! Aqui está a anotação:\n```json\n' +
    replayIA({ segmentos: [{ texto: RESPOSTA, tipo: 'forte', nota: 'ok' }], ausencias: [] }) +
    '\n```\nEspero ter ajudado.' })
  const r = t.sandbox.gerarReplayAnotado(RESPOSTA, '', '', '', '', 'Practitioner', 'Aula_1')
  checar('JSON cercado de markdown e de prosa ainda é lido',
    !r.erro && r.segmentos.length === 1, JSON.stringify(r))
}

// ── higiene dos segmentos ───────────────────────────────────────────────────
//
// `seg.tipo` vira classe CSS direto na tela. Um tipo inventado pela IA daria
// uma classe inexistente e o trecho apareceria sem marcação, sem explicação.
{
  const t = carregar({ respostaIA: replayIA({
    segmentos: [
      { texto: 'a', tipo: 'excelente', nota: 'x' },
      { texto: '', tipo: 'forte', nota: 'y' },
      { tipo: 'forte' },
      'lixo',
      { texto: 'b', tipo: 'atencao' }
    ],
    ausencias: ['um', '  ', 'dois', 'tres', 'quatro']
  }) })
  const r = t.sandbox.gerarReplayAnotado(RESPOSTA, '', '', '', '', 'Practitioner', 'Aula_1')

  checar('tipo fora da lista vira neutro', r.segmentos[0].tipo === 'neutro')
  checar('segmento sem texto é descartado', r.segmentos.length === 2, JSON.stringify(r.segmentos))
  checar('nota ausente vira string vazia, não undefined', r.segmentos[1].nota === '')
  checar('ausências vazias somem e o teto de 3 é respeitado',
    r.ausencias.length === 3 && r.ausencias[1] === 'dois', JSON.stringify(r.ausencias))
}

// ── falhas ──────────────────────────────────────────────────────────────────
{
  const semTexto = carregar()
  const r0 = semTexto.sandbox.gerarReplayAnotado('   ', '', '', '', '', 'Practitioner', 'Aula_1')
  checar('resposta vazia nem chega a gastar chamada de IA',
    r0.erro === true && semTexto.chamadas.length === 0, JSON.stringify(r0))

  const quebrado = carregar({ respostaIA: 'não consegui gerar a anotação' })
  const r1 = quebrado.sandbox.gerarReplayAnotado(RESPOSTA, '', '', '', '', 'Practitioner', 'Aula_1')
  checar('JSON quebrado devolve { erro: true }, não estoura',
    r1.erro === true && /Não foi possível gerar o replay/.test(r1.mensagem), JSON.stringify(r1))

  // O replay é um extra dentro do resultado da aula: se ele estourar, leva
  // junto a nota e o feedback que o aluno já tinha na tela.
  const caiu = carregar({ iaFalha: 'Nenhum modelo da Groq respondeu.' })
  let estourou = false, r2
  try { r2 = caiu.sandbox.gerarReplayAnotado(RESPOSTA, '', '', '', '', 'Practitioner', 'Aula_1') }
  catch (e) { estourou = true }
  checar('falha da IA não propaga — o resultado da aula continua de pé', estourou === false)
  checar('vira { erro: true } que a tela já sabe mostrar', r2 && r2.erro === true)
  checar('e fica registrada, ao contrário da versão antiga',
    caiu.logs.some(l => l.tipo === 'REPLAY_ERROR'), JSON.stringify(caiu.logs))
}

console.log(falhas === 0 ? '\nTodos os testes passaram.' : `\n${falhas} falha(s).`)
process.exit(falhas === 0 ? 0 : 1)

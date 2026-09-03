// =============================================================================
// FUNÇÕES MIGRADAS PARA O NÚCLEO DA GROQ
//
// Cada função aqui substitui a versão do `Codigo.gs` que fazia sua própria
// chamada ao UrlFetchApp. Cole UMA POR VEZ, apagando a antiga, e rode
// `diagnosticarIA()` antes de migrar a seguinte.
//
// Por que uma por vez: entregar função pela metade já custou um ida e volta
// nesta sessão, e um erro aqui derruba a IA para os alunos. O ganho de migrar
// tudo de uma vez não compensa o risco de colar errado.
//
// O que cada migração ganha, além de menos código repetido:
//   - fallback para o próximo modelo quando o principal é descontinuado;
//   - retry em 429 (limite de taxa) e em falha de rede;
//   - detecção de resposta vazia, que modelos de raciocínio produzem quando
//     o max_tokens é apertado;
//   - erro de chave de API que falha alto em vez de virar "sem resposta".
// =============================================================================


// ── 1/5 · gerarBoasVindas ────────────────────────────────────────────────────
//
// Problemas da versão antiga, todos silenciosos:
//   - max_tokens 120: o modelo de raciocínio gastava o orçamento pensando e
//     devolvia content vazio. TODO aluno via o texto genérico da tela.
//   - JSON.parse direto no corpo da resposta, sem checar o status HTTP: um
//     erro da API virava `data.choices === undefined` e mensagem vazia.
//   - `.message.content.trim()` estoura se `content` vier null.
//   - nenhum registro: a falha não aparecia em lugar nenhum.

function gerarBoasVindas(email, curso, aula, nome) {
  const prog = buscarProgressoAluno(email, curso);
  const aprovadas = Object.values(prog).filter(function (p) { return p.aprovado === 'SIM'; }).length;
  const primeiroAcesso = aprovadas === 0;

  let base = '';
  try {
    const b = buscarBaseAula(curso, aula);
    base = b.titulo || '';
  } catch (e) { /* sem o título a mensagem fica mais genérica, mas sai */ }

  const nomeExibir = nome || String(email).split('@')[0];
  const contexto = primeiroAcesso
    ? 'É o primeiro acesso do aluno a este curso.'
    : 'O aluno já completou ' + aprovadas + ' aulas anteriores.';

  const prompt = `Você é o SENA, simulador clínico do IBSDH. Gere uma mensagem de boas-vindas personalizada e breve (máximo 2 frases) para o aluno ${nomeExibir} que está iniciando a ${aula} do curso de ${curso}. Tema desta aula: ${base}. ${contexto}
A mensagem deve ser direta, clínica, motivadora e única — sem ser genérica. Não use "olá" ou "bem-vindo". Termine com uma provocação clínica relacionada ao tema da aula.`;

  let msg = '';
  try {
    msg = String(chamarGroqTexto(prompt, {
      // 600, não 120: modelos de raciocínio consomem parte do orçamento
      // pensando antes de escrever a primeira palavra.
      maxTokens: 600,
      temperature: 0.8,
      sistema: 'Você é o SENA, simulador clínico do IBSDH. Responda em texto normal, sem JSON.'
    })).trim();
  } catch (e) {
    // A mensagem de boas-vindas é decorativa: se a IA não responder, o aluno
    // entra na aula do mesmo jeito e vê o texto padrão da tela. O que muda é
    // que agora fica registrado — antes a falha não aparecia em lugar nenhum.
    try { registrarLog('BOAS_VINDAS_ERROR', email, curso, aula, e.message, ''); } catch (e2) {}
  }

  // Mesmo formato de retorno da versão antiga: nenhum chamador precisa mudar.
  return { mensagem: msg, primeiro_acesso: primeiroAcesso, aulas_aprovadas: aprovadas };
}


// ── 2/5 · responderComoPaciente ──────────────────────────────────────────────
//
// A conversa com o paciente virtual — o recurso que o aluno mais usa.
//
// Esta é a única que NÃO usa chamarGroqTexto: ela precisa mandar a conversa
// inteira (system + histórico + fala nova), não um prompt único. Por isso
// chama o núcleo direto, que aceita o array de mensagens.
//
// Problemas da versão antiga:
//   - dois Logger.log despejavam a resposta CRUA da Groq no registro de
//     execução a cada chamada, incluindo 500 caracteres do que o paciente
//     "disse". Ruído em produção e log desnecessário de conteúdo de sessão.
//   - max_tokens 300 é apertado para modelo de raciocínio: o raciocínio come
//     o orçamento antes do texto. Funcionou nos testes, mas uma conversa mais
//     longa esvazia o content — e aí o aluno recebe erro no meio da sessão.
//   - `.content.trim()` estoura se content vier null.
//   - sem fallback de modelo e sem retry em 429.
//
// Ao contrário das boas-vindas, aqui a exceção NÃO é engolida: a resposta do
// paciente é a funcionalidade em si. Se a IA não responder, o aluno precisa
// saber, não continuar falando sozinho com uma tela muda.

function responderComoPaciente(nomePerfil, historico, curso, aula, mensagem) {
  const perfil = PERFIS_CLINICOS[nomePerfil];
  if (!perfil) throw new Error('Perfil inválido: ' + nomePerfil);

  let contextoAula = '';
  try {
    const base = buscarBaseAula(curso, aula);
    contextoAula = base.titulo ? 'Tema da sessão: ' + base.titulo + '.' : '';
  } catch (e) { /* sem o tema o paciente responde igual, só menos situado */ }

  const systemPrompt = `Você é um paciente virtual em uma sessão de ${curso}. 
Seu perfil psicológico: ${perfil.descricao}
Suas resistências típicas: ${perfil.resistencias.join(', ')}.
${contextoAula}

REGRAS ABSOLUTAS:
- Responda SEMPRE como o paciente, nunca como terapeuta ou avaliador.
- Mantenha o perfil psicológico consistente ao longo de toda a sessão.
- Respostas curtas e realistas (2-5 frases), como um paciente real responderia.
- Demonstre as resistências do seu perfil de forma natural, não exagerada.
- Nunca quebre o personagem, nunca explique que é uma IA.
- Se o terapeuta usar uma técnica bem aplicada, responda de forma levemente mais aberta.
- Se a abordagem for inadequada para o seu perfil, mantenha a resistência.
- Reaja ao que foi dito, não apenas responda perguntas.`;

  const mensagens = [{ role: 'system', content: systemPrompt }];
  if (Array.isArray(historico)) {
    historico.forEach(function (m) {
      mensagens.push({
        role: m.role === 'terapeuta' ? 'user' : 'assistant',
        content: m.texto
      });
    });
  }
  mensagens.push({ role: 'user', content: mensagem });

  const resposta = chamarGroqCore(mensagens, {
    json: false,        // o paciente fala em prosa, não em JSON
    maxTokens: 800,     // 300 era apertado: o raciocínio do modelo come o orçamento
    temperature: 0.85   // mesma da versão antiga — variação faz o paciente soar vivo
  });

  return { resposta: String(resposta).trim() };
}


// ── 3/5 · gerarReplayAnotado ─────────────────────────────────────────────────
//
// O replay marca a resposta do aluno trecho a trecho: verde no que funcionou,
// amarelo no que precisa de atenção, vermelho no que ficou inconsistente.
//
// ATENÇÃO ao migrar: a versão antiga tinha ` + resposta + ` como TEXTO LITERAL
// dentro da crase, e a IA nunca recebia a resposta do aluno. Isso já foi
// corrigido em produção (PR #18) e aqui está `${resposta}`. Existe um teste em
// `teste-migracao-groq.mjs` que cai se alguém desfizer isso.
//
// O que muda além da resiliência:
//
//   1. O rótulo "Resposta do aluno:" vazava como segmento. Ele abria o prompt
//      colado no texto, a IA o tratava como parte da resposta e devolvia
//      { "texto": "Resposta do aluno:", "tipo": "neutro" } como primeiro
//      segmento — o aluno via um rótulo do sistema marcado como se fosse
//      condução dele. Agora a resposta vai entre delimitadores, com instrução
//      explícita de que os segmentos reconstituem SOMENTE o texto do aluno.
//
//   2. `extrairJSONRobusto` no lugar do `replace(/```json|```/g, '')` feito à
//      mão. É a mesma função que a avaliação das aulas e o plantão já usam:
//      lida com markdown, com texto em volta e com chaves aninhadas. Manter
//      duas implementações, sendo uma pior, é o que faz elas divergirem.
//
//   3. Os segmentos são higienizados antes de sair: item sem `texto` some,
//      `tipo` fora da lista vira "neutro" (a tela usa esse valor como classe
//      CSS), e as ausências ficam no máximo 3, como o prompt já pedia.
//
// O retorno em caso de falha continua sendo `{ erro: true, mensagem }` — a tela
// do replay (`SimuladorView.vue`) já sabe lidar com isso e mostra o aviso sem
// derrubar o resto do resultado da aula.

var REPLAY_TIPOS_VALIDOS = ['forte', 'atencao', 'ausente_contexto', 'neutro'];

function gerarReplayAnotado(resposta, fortes, atencao, prescricao, perfil, curso, aula) {
  const texto = String(resposta || '').trim();
  if (!texto) return { erro: true, mensagem: 'Não há resposta para anotar.' };

  const systemPrompt = `Você é um supervisor clínico analisando a resposta de um aluno.
Sua tarefa: anotar a resposta do aluno identificando trechos positivos, imprecisos e ausentes.

Retorne SOMENTE um JSON válido, sem markdown, sem backticks, com esta estrutura:
{
  "segmentos": [
    { "texto": "trecho exato da resposta", "tipo": "forte", "nota": "explicação curta" },
    { "texto": "trecho exato", "tipo": "atencao", "nota": "o que poderia melhorar" },
    { "texto": "trecho exato", "tipo": "neutro", "nota": "" }
  ],
  "ausencias": ["elemento importante que não apareceu na resposta"]
}

Tipos possíveis: "forte" (verde), "atencao" (amarelo), "ausente_contexto" (vermelho), "neutro" (sem marcação).
A resposta do aluno vem entre as marcas ###RESPOSTA_INICIO### e ###RESPOSTA_FIM###.
Segmente APENAS o texto entre essas marcas. Não inclua as marcas, nem rótulos,
nem o feedback do supervisor nos segmentos.
Cubra 100% do texto do aluno: a concatenação de todos os "texto" deve reconstituir
exatamente a resposta dele, nada a mais.
Máximo 3 ausências.`;

  const userPrompt = `###RESPOSTA_INICIO###
${texto}
###RESPOSTA_FIM###

Feedback da IA já gerado (contexto para você, NÃO faz parte da resposta do aluno):
- Pontos fortes: ${fortes || ''}
- Pontos de atenção: ${atencao || ''}
- Prescrição: ${prescricao || ''}
- Perfil do paciente: ${perfil || ''}

Anote a resposta conforme instruído.`;

  try {
    const bruto = chamarGroqCore([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], {
      json: true,
      maxTokens: 2000,   // o replay devolve o texto inteiro fatiado: precisa de espaço
      temperature: 0.3   // marcação é análise, não criação — mesma da versão antiga
    });

    const dados = extrairJSONRobusto(bruto);
    if (!dados || typeof dados !== 'object') throw new Error('A IA não devolveu JSON utilizável.');

    return { segmentos: limparSegmentosReplay(dados.segmentos), ausencias: limparAusenciasReplay(dados.ausencias) };
  } catch (e) {
    try { registrarLog('REPLAY_ERROR', '', curso || '', aula || '', e.message, ''); } catch (e2) {}
    return { erro: true, mensagem: 'Não foi possível gerar o replay: ' + e.message };
  }
}

// A tela usa `seg.tipo` direto como classe CSS e `seg.nota` direto no atributo
// title. Um tipo inventado pela IA viraria uma classe que não existe e o trecho
// apareceria sem marcação nenhuma, sem ninguém saber por quê.
function limparSegmentosReplay(lista) {
  if (!Array.isArray(lista)) return [];
  const limpos = [];
  lista.forEach(function (seg) {
    if (!seg || typeof seg !== 'object') return;
    const t = String(seg.texto == null ? '' : seg.texto);
    if (!t) return;
    const tipo = String(seg.tipo || 'neutro');
    limpos.push({
      texto: t,
      tipo: REPLAY_TIPOS_VALIDOS.indexOf(tipo) === -1 ? 'neutro' : tipo,
      nota: String(seg.nota == null ? '' : seg.nota)
    });
  });
  return limpos;
}

function limparAusenciasReplay(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .map(function (a) { return String(a == null ? '' : a).trim(); })
    .filter(function (a) { return a.length > 0; })
    .slice(0, 3);
}

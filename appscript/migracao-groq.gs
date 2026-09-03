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


// ── 4/5 · analisarDiarioSemanal ──────────────────────────────────────────────
//
// Lê as reflexões que o aluno escreveu no diário e devolve um parágrafo de
// supervisão: padrões de força, pontos cegos e uma recomendação.
//
// Esta apareceu "OK | 12ms" no diagnosticarIA(), mas isso é enganoso: ela caiu
// no retorno de "poucas entradas" e nem chegou a chamar a Groq. O caminho que
// usa IA nunca foi exercitado em produção — o que torna a migração mais
// importante aqui, não menos.
//
// Problemas da versão antiga:
//   - max_tokens 400 com modelo de raciocínio: o mesmo aperto que deixava as
//     boas-vindas vazias. Aqui o texto pedido é maior (200 palavras), então a
//     chance de o content sair vazio é maior ainda. Agora são 1200.
//   - `.message.content.trim()` estoura se content vier null.
//   - sem checar o status HTTP: um 401 ou 429 virava
//     `data.choices === undefined` e o aluno lia "Não foi possível gerar a
//     análise", sem nada registrado em lugar nenhum.
//   - o prompt não tinha teto de tamanho: dez reflexões longas podiam estourar
//     o limite de contexto do modelo e derrubar a análise inteira.

var DIARIO_MAX_ENTRADAS = 10;
var DIARIO_MAX_CHARS_ENTRADA = 1200;

function analisarDiarioSemanal(email, curso) {
  const r = buscarEntradasDiario(email, curso, '');
  const entradas = r && r.entradas;
  if (!entradas || entradas.length < 2) {
    return { analise: 'Você ainda tem poucas entradas no diário. Continue registrando suas reflexões para receber uma análise de padrões.' };
  }

  // Teto por entrada: uma reflexão longa demais não pode derrubar a análise
  // das outras nove por estourar o contexto do modelo.
  const texto = entradas.slice(0, DIARIO_MAX_ENTRADAS).map(function (e) {
    const reflexao = String(e.reflexao || '');
    return '[' + (e.aula || '') + '] ' +
      (reflexao.length > DIARIO_MAX_CHARS_ENTRADA
        ? reflexao.substring(0, DIARIO_MAX_CHARS_ENTRADA) + '…'
        : reflexao);
  }).join('\n\n');

  const prompt = `Você é um supervisor clínico analisando o diário de um aluno em formação em ${curso}.
Com base nas reflexões abaixo, identifique:
1. Padrões recorrentes de força (o que o aluno faz bem consistentemente)
2. Pontos cegos recorrentes (o que o aluno tende a evitar ou não percebe)
3. Uma recomendação de desenvolvimento personalizada para a próxima semana

Seja direto, específico e clínico. Máximo 200 palavras.

Reflexões do aluno:
${texto}`;

  try {
    const analise = String(chamarGroqTexto(prompt, {
      // 400 era o mesmo aperto das boas-vindas, e aqui o texto pedido é maior.
      maxTokens: 1200,
      temperature: 0.5
    })).trim();

    // Modelo de raciocínio pode devolver 200 com content vazio. O núcleo já
    // trata isso como falha e tenta o próximo modelo, mas se TODOS voltarem
    // vazios chegamos aqui com string vazia — e uma caixa em branco na tela é
    // pior do que uma frase honesta.
    if (!analise) throw new Error('A IA respondeu sem conteúdo.');

    return { analise: analise };
  } catch (e) {
    try { registrarLog('DIARIO_ERROR', email, curso, '', e.message, ''); } catch (e2) {}
    return { analise: 'Não foi possível gerar a análise agora. Suas entradas continuam salvas — tente de novo em alguns minutos.' };
  }
}


// ── 5/5 · gerarRelatorioEvolucao ─────────────────────────────────────────────
//
// O relatório de competência clínica: estatísticas do curso inteiro mais uma
// leitura da IA sobre a assinatura clínica do aluno. É a última função que
// ainda fazia sua própria chamada ao UrlFetchApp.
//
// A falha silenciosa aqui é a mais visível de todas. A versão antiga faz:
//
//     const analise = data2.choices && data2.choices[0] ? ... : '';
//
// Se a Groq falhar, `analise` vira string vazia e a função devolve sucesso. A
// tela (`DashboardView.vue`) então desenha a caixa dourada "Análise da IA —
// Supervisão Clínica" COMPLETAMENTE EM BRANCO, com as estatísticas corretas ao
// lado. O aluno clica em "Gerar relatório", espera, e recebe um quadro vazio
// sem nenhuma explicação.
//
// Agora, quando a IA não responde, as estatísticas continuam saindo (são
// calculadas aqui, não pela IA — não faz sentido perdê-las) e o lugar da
// análise recebe uma frase honesta.
//
// Outros problemas da versão antiga:
//   - max_tokens 600 para um relatório de 350 palavras em 4 seções: apertado
//     para modelo de raciocínio, que gasta parte do orçamento pensando.
//   - `.message.content.trim()` estoura se content vier null.
//   - `Object.keys(aulaMap).sort()` é ordenação alfabética: com dez aulas ou
//     mais, "Aula_10" vem antes de "Aula_2" e a evolução sai fora de ordem.

function gerarRelatorioEvolucao(email, curso) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheetAval = ss.getSheetByName('Avaliacoes_SENA');
  if (!sheetAval) return { erro: true, mensagem: 'Sem dados de avaliação.' };

  const dados = sheetAval.getDataRange().getValues();
  const headers = dados[0];
  const iEmail  = headers.indexOf('email');
  const iCurso  = headers.indexOf('curso');
  const iAula   = headers.indexOf('aula');
  const iNota   = headers.indexOf('nota_total');
  const iAprov  = headers.indexOf('aprovado');
  const iFortes = headers.indexOf('fortes');
  const iAtenc  = headers.indexOf('atencao');

  const avaliacoes = [];
  for (let i = 1; i < dados.length; i++) {
    const row = dados[i];
    if (String(row[iEmail]).toLowerCase().trim() !== String(email).toLowerCase().trim()) continue;
    if (String(row[iCurso]).trim() !== String(curso).trim()) continue;
    avaliacoes.push({
      aula: String(row[iAula] || ''),
      nota: Number(row[iNota] || 0),
      aprovado: String(row[iAprov] || '').trim().toUpperCase() === 'SIM',
      fortes: String(row[iFortes] || ''),
      atencao: String(row[iAtenc] || '')
    });
  }

  if (avaliacoes.length < 3) {
    return { erro: false, insuficiente: true, mensagem: 'Complete pelo menos 3 aulas para gerar o relatório de evolução.' };
  }

  const aulaMap = {};
  avaliacoes.forEach(function (a) {
    if (!aulaMap[a.aula]) aulaMap[a.aula] = [];
    aulaMap[a.aula].push(a.nota);
  });

  const pontos = Object.keys(aulaMap).sort(compararNomesDeAula).map(function (aula) {
    const notas = aulaMap[aula];
    return { aula: aula, melhor: Math.max.apply(null, notas), tentativas: notas.length };
  });

  const mediaGeral = (pontos.reduce(function (s, p) { return s + p.melhor; }, 0) / pontos.length).toFixed(1);
  const aprovadas = avaliacoes.filter(function (a) { return a.aprovado; }).length;
  const todosFortesAtencao = avaliacoes.slice(0, 15).map(function (a) { return a.fortes + ' ' + a.atencao; }).join(' ');

  const prompt = `Você é um supervisor clínico sênior. Com base na evolução deste aluno no curso de ${curso}, gere um relatório de competência clínica com 4 seções:

1. ASSINATURA CLÍNICA (1 parágrafo): o estilo único deste aluno como profissional, baseado nos padrões de força identificados.
2. PONTOS DE FORÇA CONSOLIDADOS (3 itens): competências claramente desenvolvidas ao longo do curso.
3. ZONAS DE DESENVOLVIMENTO (2 itens): padrões que ainda precisam de atenção.
4. RECOMENDAÇÃO PARA PRÁTICA (1 parágrafo): próximos passos concretos para o desenvolvimento contínuo.

Dados do aluno:
- Aulas realizadas: ${pontos.length}
- Aulas aprovadas: ${aprovadas}
- Média geral: ${mediaGeral}/10
- Feedbacks acumulados: ${todosFortesAtencao.substring(0, 800)}

Seja específico, clínico e personalizado. Máximo 350 palavras no total.`;

  let analise = '';
  try {
    analise = String(chamarGroqTexto(prompt, {
      // 600 para 350 palavras em 4 seções era apertado: o raciocínio do modelo
      // come parte do orçamento antes de escrever a primeira linha.
      maxTokens: 1500,
      temperature: 0.5
    })).trim();
    if (!analise) throw new Error('A IA respondeu sem conteúdo.');
  } catch (e) {
    try { registrarLog('RELATORIO_ERROR', email, curso, '', e.message, ''); } catch (e2) {}
    // As estatísticas são calculadas aqui, não pela IA. Perder o relatório
    // inteiro porque a Groq caiu seria jogar fora o que já está pronto.
    analise = 'A análise da IA não pôde ser gerada agora. Os números acima são seus resultados reais — gere o relatório de novo em alguns minutos para receber a leitura clínica.';
  }

  return {
    email: email, curso: curso,
    data_geracao: new Date().toLocaleDateString('pt-BR'),
    total_aulas: pontos.length,
    aulas_aprovadas: aprovadas,
    media_geral: mediaGeral,
    evolucao: pontos,
    analise: analise
  };
}

// "Aula_10" tem que vir depois de "Aula_2", não antes. O sort() puro é
// alfabético e inverte os dois assim que o curso passa de nove aulas.
function compararNomesDeAula(a, b) {
  const na = parseInt(String(a).replace(/\D/g, ''), 10);
  const nb = parseInt(String(b).replace(/\D/g, ''), 10);
  if (isNaN(na) || isNaN(nb)) return String(a).localeCompare(String(b));
  if (na !== nb) return na - nb;
  return String(a).localeCompare(String(b));
}

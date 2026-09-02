// =============================================================================
// FUNÇÕES CORRIGIDAS — cole cada uma por cima da versão antiga no editor do
// Apps Script (script.google.com), substituindo a função inteira.
//
// O que mudou e por quê está explicado em appscript/README.md.
// =============================================================================


// -----------------------------------------------------------------------------
// 1) buscarRankingPerfis — era lenta (~3.5s)
//
// Antes: getDataRange().getValues() trazia a aba Avaliacoes_SENA inteira,
// incluindo as colunas de texto longo geradas pela IA (fortes, atencao,
// prescricao, justificativa), sem usar nenhuma delas.
//
// Agora: lê só o bloco mínimo de colunas necessário + cache de 5 minutos.
// O formato de retorno é EXATAMENTE o mesmo de antes (RankingView.vue depende
// dos campos perfil / taxa_aprovacao / media / total_sessoes / alunos_unicos).
// -----------------------------------------------------------------------------

function buscarRankingPerfis(curso) {
  const cursoNorm = normalizarTexto(curso);
  if (!cursoNorm) return { ranking: [] };

  // Cache curto: o ranking é um agregado da turma toda, não muda a cada segundo.
  const cache = CacheService.getScriptCache();
  const chaveCache = 'ranking_perfis_' + cursoNorm;
  const cacheado = cache.get(chaveCache);
  if (cacheado) {
    try {
      return JSON.parse(cacheado);
    } catch (e) {
      // cache corrompido: ignora e recalcula
    }
  }

  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName('Avaliacoes_SENA');
  if (!sheet) return { ranking: [] };

  const ultimaLinha = sheet.getLastRow();
  const ultimaColuna = sheet.getLastColumn();
  if (ultimaLinha < 2 || ultimaColuna < 1) return { ranking: [] };

  // Lê só o cabeçalho para localizar as colunas.
  const headers = sheet.getRange(1, 1, 1, ultimaColuna).getValues()[0];
  const iCurso  = headers.indexOf('curso');
  const iPerfil = headers.indexOf('perfil');
  const iNota   = headers.indexOf('nota_total');
  const iAprov  = headers.indexOf('aprovado');
  const iEmail  = headers.indexOf('email');

  const posicoes = [iCurso, iPerfil, iNota, iAprov, iEmail];
  if (posicoes.some(function (p) { return p === -1; })) {
    return { ranking: [] };
  }

  // Busca apenas o bloco que cobre essas 5 colunas (deixa de fora as colunas
  // de texto longo). Usa min/max para continuar funcionando se a ordem das
  // colunas na planilha mudar.
  const primeira = Math.min.apply(null, posicoes);
  const ultima   = Math.max.apply(null, posicoes);
  const dados = sheet
    .getRange(2, primeira + 1, ultimaLinha - 1, ultima - primeira + 1)
    .getValues();

  // Índices relativos ao bloco lido.
  const rCurso  = iCurso  - primeira;
  const rPerfil = iPerfil - primeira;
  const rNota   = iNota   - primeira;
  const rAprov  = iAprov  - primeira;
  const rEmail  = iEmail  - primeira;

  const perfilMap = {};

  for (let i = 0; i < dados.length; i++) {
    const row = dados[i];
    if (String(row[rCurso]).trim() !== cursoNorm) continue;

    const perfil = String(row[rPerfil] || '').trim();
    if (!perfil) continue;

    if (!perfilMap[perfil]) {
      perfilMap[perfil] = { total: 0, aprovacoes: 0, soma: 0, alunos: {} };
    }

    perfilMap[perfil].total++;
    perfilMap[perfil].soma += Number(row[rNota] || 0);
    if (String(row[rAprov]).trim().toUpperCase() === 'SIM') {
      perfilMap[perfil].aprovacoes++;
    }
    perfilMap[perfil].alunos[String(row[rEmail]).toLowerCase().trim()] = true;
  }

  const ranking = Object.keys(perfilMap).map(function (perfil) {
    const d = perfilMap[perfil];
    return {
      perfil: perfil,
      taxa_aprovacao: Math.round((d.aprovacoes / d.total) * 100),
      media: Number((d.soma / d.total).toFixed(1)),
      total_sessoes: d.total,
      alunos_unicos: Object.keys(d.alunos).length
    };
  }).sort(function (a, b) { return b.taxa_aprovacao - a.taxa_aprovacao; });

  const resultado = { ranking: ranking };

  try {
    cache.put(chaveCache, JSON.stringify(resultado), 300); // 5 minutos
  } catch (e) {
    // se passar do limite de tamanho do cache, segue sem cachear
  }

  return resultado;
}


// -----------------------------------------------------------------------------
// 2) buscarRespostasParaMentor — era o que travava (não respondia nem em 15s)
//
// Antes: carregava a aba Respostas_Aluno INTEIRA na memória, incluindo a coluna
// resposta_texto (até 5.000 caracteres por linha), montando um mapa com todas
// as respostas de todos os alunos — para usar no máximo 5 delas.
//
// Agora: lê só a coluna de IDs de Respostas_Aluno (leve) para montar um índice
// id -> linha, e busca o texto de cada candidato individualmente (no máximo ~5
// leituras de célula). O formato de retorno é o mesmo de antes.
// -----------------------------------------------------------------------------

function buscarRespostasParaMentor(emailMentor, curso, aula) {
  const emailNorm = normalizarTexto(emailMentor).toLowerCase();
  const cursoNorm = normalizarTexto(curso);
  const aulaNorm  = normalizarTexto(aula);

  if (!emailNorm || !cursoNorm) return { itens: [] };

  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheetAval = ss.getSheetByName('Avaliacoes_SENA');
  const sheetResp = ss.getSheetByName('Respostas_Aluno');
  const sheetFeed = ss.getSheetByName('Feedbacks_Mentor');
  if (!sheetAval || !sheetResp) return { itens: [] };

  const ultimaLinhaAval = sheetAval.getLastRow();
  const ultimaColunaAval = sheetAval.getLastColumn();
  if (ultimaLinhaAval < 2) return { itens: [] };

  const headersA = sheetAval.getRange(1, 1, 1, ultimaColunaAval).getValues()[0];
  const iEmailA  = headersA.indexOf('email');
  const iCursoA  = headersA.indexOf('curso');
  const iAulaA   = headersA.indexOf('aula');
  const iIdRespA = headersA.indexOf('id_resposta');
  const iIdAvalA = headersA.indexOf('id_avaliacao');
  const iNota    = headersA.indexOf('nota_total');
  const iAprov   = headersA.indexOf('aprovado');
  const iFortes  = headersA.indexOf('fortes');

  const posicoesA = [iEmailA, iCursoA, iAulaA, iIdRespA, iIdAvalA, iNota, iAprov, iFortes];
  if (posicoesA.some(function (p) { return p === -1; })) return { itens: [] };

  // Lê só o bloco que cobre essas colunas — deixa de fora atencao, prescricao
  // e justificativa, que são três das quatro colunas de texto longo.
  const primeiraA = Math.min.apply(null, posicoesA);
  const ultimaA   = Math.max.apply(null, posicoesA);
  const dadosAval = sheetAval
    .getRange(2, primeiraA + 1, ultimaLinhaAval - 1, ultimaA - primeiraA + 1)
    .getValues();

  const rEmailA  = iEmailA  - primeiraA;
  const rCursoA  = iCursoA  - primeiraA;
  const rAulaA   = iAulaA   - primeiraA;
  const rIdRespA = iIdRespA - primeiraA;
  const rIdAvalA = iIdAvalA - primeiraA;
  const rNota    = iNota    - primeiraA;
  const rAprov   = iAprov   - primeiraA;
  const rFortes  = iFortes  - primeiraA;

  // IDs de avaliação que este mentor já comentou (lê só as 2 colunas usadas).
  const jaAvaliados = {};
  if (sheetFeed && sheetFeed.getLastRow() > 1) {
    const headersF = sheetFeed.getRange(1, 1, 1, sheetFeed.getLastColumn()).getValues()[0];
    const iEmailF = headersF.indexOf('email_mentor');
    const iIdF    = headersF.indexOf('id_avaliacao');

    if (iEmailF !== -1 && iIdF !== -1) {
      const primeiraF = Math.min(iEmailF, iIdF);
      const ultimaF   = Math.max(iEmailF, iIdF);
      const feedDados = sheetFeed
        .getRange(2, primeiraF + 1, sheetFeed.getLastRow() - 1, ultimaF - primeiraF + 1)
        .getValues();

      for (let i = 0; i < feedDados.length; i++) {
        const row = feedDados[i];
        if (String(row[iEmailF - primeiraF]).toLowerCase().trim() === emailNorm) {
          jaAvaliados[String(row[iIdF - primeiraF])] = true;
        }
      }
    }
  }

  // Índice id_resposta -> número da linha, lendo APENAS a coluna de IDs.
  const ultimaLinhaResp = sheetResp.getLastRow();
  if (ultimaLinhaResp < 2) return { itens: [] };

  const headersR = sheetResp.getRange(1, 1, 1, sheetResp.getLastColumn()).getValues()[0];
  const iIdR    = headersR.indexOf('id_resposta');
  const iTextoR = headersR.indexOf('resposta_texto');
  if (iIdR === -1 || iTextoR === -1) return { itens: [] };

  const idsResp = sheetResp.getRange(2, iIdR + 1, ultimaLinhaResp - 1, 1).getValues();
  const linhaPorId = {};
  for (let i = 0; i < idsResp.length; i++) {
    const id = String(idsResp[i][0] || '');
    if (id) linhaPorId[id] = i + 2; // +2: pula o cabeçalho e converte para 1-based
  }

  const itens = [];

  // Percorre da avaliação mais recente para a mais antiga.
  for (let i = dadosAval.length - 1; i >= 0; i--) {
    const row = dadosAval[i];

    if (String(row[rEmailA]).toLowerCase().trim() === emailNorm) continue; // não avaliar a si mesmo
    if (String(row[rCursoA]).trim() !== cursoNorm) continue;
    if (aulaNorm && String(row[rAulaA]).trim() !== aulaNorm) continue;
    if (String(row[rAprov]).trim().toUpperCase() !== 'SIM') continue; // só aprovados

    const idAval = String(row[rIdAvalA] || '');
    if (jaAvaliados[idAval]) continue;

    const idResp = String(row[rIdRespA] || '');
    const linha = linhaPorId[idResp];
    if (!linha) continue;

    // Só agora busca o texto — uma célula por candidato, no máximo ~5 vezes.
    const texto = String(sheetResp.getRange(linha, iTextoR + 1).getValue() || '');
    if (texto.length < 50) continue;

    itens.push({
      id_avaliacao: idAval,
      aula: String(row[rAulaA] || ''),
      nota: Number(row[rNota] || 0),
      fortes: String(row[rFortes] || ''),
      trecho: texto.substring(0, 500)
    });

    if (itens.length >= 5) break;
  }

  return { itens: itens };
}


// -----------------------------------------------------------------------------
// 3) CORREÇÃO PONTUAL em gerarReplayAnotado
//
// Dentro do template literal (crase) estava escrito "+ resposta +" como TEXTO
// LITERAL em vez de ${resposta}. A IA nunca recebia a resposta do aluno.
//
// No editor, localize a função gerarReplayAnotado e troque o bloco:
//
//     const userPrompt = `Resposta do aluno:
//      + resposta +
//
// por este (note o ${resposta}):
// -----------------------------------------------------------------------------

/*
  const userPrompt = `Resposta do aluno:
${resposta}

Feedback da IA já gerado:
- Pontos fortes: ${fortes || ''}
- Pontos de atenção: ${atencao || ''}
- Prescrição: ${prescricao || ''}
- Perfil do paciente: ${perfil || ''}

Anote a resposta conforme instruído.`;
*/


// -----------------------------------------------------------------------------
// 4) CORREÇÃO PONTUAL em validarDadosEntrada
//
// Todas as validações da função usam throw, menos a do e-mail, que usava
// return { erro: true, ... }. Quem chama (avaliarResposta) não checa esse
// retorno e seguia com curso/aula undefined, fazendo o aluno ver
// "Aula não encontrada na Base_Aulas: undefined / undefined".
//
// No editor, dentro de validarDadosEntrada, troque:
//
//     return {
//       erro: true,
//       mensagem: 'E-mail inválido. Recarregue a página, limpe o campo de e-mail e tente novamente com seu e-mail real.'
//     };
//
// por:
// -----------------------------------------------------------------------------

/*
    throw new Error('E-mail inválido. Recarregue a página, limpe o campo de e-mail e tente novamente com seu e-mail real.');
*/


// -----------------------------------------------------------------------------
// 5) FUNÇÃO DE TESTE — cole no editor e rode para medir os tempos.
//    Use o menu "Executar" com medirDesempenho selecionada e veja o Registro
//    de execução (Ctrl+Enter mostra os logs).
//
//    Rode ANTES de aplicar as correções e DEPOIS, para comparar.
// -----------------------------------------------------------------------------

function medirDesempenho() {
  const curso = 'Practitioner';
  const emailTeste = 'brunosena_850@hotmail.com';

  let t0 = Date.now();
  const rank = buscarRankingPerfis(curso);
  const tRanking = Date.now() - t0;
  Logger.log('ranking_perfis: ' + tRanking + ' ms — ' +
    (rank.ranking ? rank.ranking.length : 0) + ' perfis');

  // Segunda chamada: deve ser quase instantânea se o cache estiver ativo.
  t0 = Date.now();
  buscarRankingPerfis(curso);
  Logger.log('ranking_perfis (2a chamada, cache): ' + (Date.now() - t0) + ' ms');

  t0 = Date.now();
  const mentor = buscarRespostasParaMentor(emailTeste, curso, '');
  const tMentor = Date.now() - t0;
  Logger.log('buscar_mentor: ' + tMentor + ' ms — ' +
    (mentor.itens ? mentor.itens.length : 0) + ' itens');

  // Tamanho das abas, para dar contexto aos tempos acima.
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const aval = ss.getSheetByName('Avaliacoes_SENA');
  const resp = ss.getSheetByName('Respostas_Aluno');
  Logger.log('Avaliacoes_SENA: ' + (aval ? aval.getLastRow() - 1 : 0) + ' linhas');
  Logger.log('Respostas_Aluno: ' + (resp ? resp.getLastRow() - 1 : 0) + ' linhas');
}

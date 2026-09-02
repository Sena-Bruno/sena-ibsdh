// =============================================================================
// MODO PLANTÃO — cole este arquivo inteiro como um NOVO arquivo no editor do
// Apps Script (Arquivo → + → Script, nomeie "Plantao").
//
// Não altera nada do que já existe. Depois é preciso adicionar 3 casos no
// switch do doPost — as linhas estão no fim deste arquivo.
//
// O que é: 3 casos clínicos em sequência, cada um com tempo próprio. O aluno
// lê o caso e escreve a condução. Grava histórico em aba própria e NÃO entra
// no Progresso_Aluno nem nos critérios do certificado.
// =============================================================================

const PLANTAO = {
  CASOS_POR_TURNO: 3,
  SEGUNDOS_POR_CASO: 300,   // 5 minutos
  NOTA_MINIMA: 7,
  MIN_CHARS: 50,
  MAX_CHARS: 5000,
  SHEET: 'Plantao_Historico'
};

// Contextos de chegada, combinados com os perfis clínicos já existentes para
// dar variedade sem depender de uma chamada de IA (que deixaria a abertura do
// plantão lenta e sujeita a falha).
const PLANTAO_CONTEXTOS = [
  { queixa: 'Chega dizendo que "não está aguentando mais" e pede algo para resolver hoje.', urgencia: 'Alta' },
  { queixa: 'Foi trazido por um familiar preocupado; diz que veio "só para agradar".', urgencia: 'Média' },
  { queixa: 'Relata crise durante a madrugada e medo de que aconteça de novo.', urgencia: 'Alta' },
  { queixa: 'Procura atendimento após indicação de outro profissional, desconfiado do processo.', urgencia: 'Média' },
  { queixa: 'Diz que já tentou de tudo e que nada funciona.', urgencia: 'Média' },
  { queixa: 'Chega agitado, falando rápido, com dificuldade de organizar o relato.', urgencia: 'Alta' },
  { queixa: 'Fala pouco, responde por monossílabos e evita contato visual.', urgencia: 'Média' },
  { queixa: 'Relata piora depois de um evento recente e quer entender o que houve.', urgencia: 'Alta' }
];

/**
 * Monta um turno de plantão: N casos, sem repetir perfil no mesmo turno.
 * Determinístico o bastante para ser rápido, aleatório o bastante para variar.
 */
function gerarPlantao(curso) {
  const cursoNorm = normalizarTexto(curso) || 'Practitioner';

  const perfis = Object.keys(PERFIS_CLINICOS);
  const contextos = PLANTAO_CONTEXTOS.slice();

  // embaralha cópias, para não repetir perfil nem queixa dentro do turno
  perfis.sort(function () { return Math.random() - 0.5; });
  contextos.sort(function () { return Math.random() - 0.5; });

  const total = Math.min(PLANTAO.CASOS_POR_TURNO, perfis.length);
  const casos = [];

  for (let i = 0; i < total; i++) {
    const perfil = PERFIS_CLINICOS[perfis[i]];
    const ctx = contextos[i % contextos.length];

    casos.push({
      numero: i + 1,
      perfil: perfil.nome,
      descricao: perfil.descricao,
      resistencias: perfil.resistencias,
      queixa: ctx.queixa,
      urgencia: ctx.urgencia,
      segundos: PLANTAO.SEGUNDOS_POR_CASO
    });
  }

  return {
    sucesso: true,
    id_plantao: Utilities.getUuid(),
    curso: cursoNorm,
    nota_minima: PLANTAO.NOTA_MINIMA,
    segundos_por_caso: PLANTAO.SEGUNDOS_POR_CASO,
    total_casos: casos.length,
    casos: casos
  };
}

/**
 * Avalia a condução de UM caso do plantão.
 *
 * Régua própria, de propósito: a avaliação das aulas (avaliarResposta) cobra
 * fidelidade ao conteúdo oficial de uma aula específica e chama buscarBaseAula,
 * que estoura quando não existe aula. Além disso, cobrar resposta elaborada de
 * quem está contra o relógio puniria justamente o comportamento que o plantão
 * quer treinar. Aqui o foco é priorização, condução e segurança.
 */
function avaliarPlantao(dados) {
  try {
    if (!dados || typeof dados !== 'object') throw new Error('Dados inválidos');

    const email = normalizarTexto(dados.email).toLowerCase();
    const curso = normalizarTexto(dados.curso);
    const idPlantao = normalizarTexto(dados.id_plantao);
    const numero = Number(dados.numero || 0);
    const perfil = normalizarTexto(dados.perfil);
    const queixa = normalizarTexto(dados.queixa);
    const resposta = normalizarTexto(dados.resposta);
    const tempoSeg = Number(dados.tempo_seg || 0);
    const expirou = !!dados.expirou;

    if (!email || !curso || !idPlantao || !perfil) {
      throw new Error('Campos obrigatórios ausentes');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('E-mail inválido.');
    }

    // Caso sem resposta utilizável: registra como não concluído em vez de dar
    // nota zero — o turno mostra isso no resumo e a média ignora o caso.
    if (resposta.length < PLANTAO.MIN_CHARS) {
      const semResposta = {
        sucesso: true,
        respondido: false,
        expirou: expirou,
        numero: numero,
        perfil: perfil,
        mensagem: expirou
          ? 'Tempo esgotado antes de uma condução registrável.'
          : 'Condução muito curta para ser avaliada (mínimo ' + PLANTAO.MIN_CHARS + ' caracteres).'
      };
      salvarCasoPlantao(email, curso, idPlantao, numero, perfil, null, tempoSeg, resposta, semResposta.mensagem, expirou);
      return semResposta;
    }

    if (resposta.length > PLANTAO.MAX_CHARS) {
      throw new Error('Resposta muito longa. Máximo ' + PLANTAO.MAX_CHARS + ' caracteres.');
    }

    const perfilInfo = PERFIS_CLINICOS[perfil] || null;

    const prompt = `
Você é supervisor clínico avaliando um atendimento de PLANTÃO do IBSDH.

CONTEXTO IMPORTANTE PARA A SUA AVALIAÇÃO
Este NÃO é um exercício de aula. O aluno teve ${Math.round(PLANTAO.SEGUNDOS_POR_CASO / 60)} minutos
para ler o caso e registrar a condução, sob pressão de tempo. Avalie decisão e
condução, não elaboração teórica nem beleza de escrita. Texto enxuto e direto
é adequado ao contexto e não deve ser penalizado.

O CASO
Perfil do paciente: ${perfil}
${perfilInfo ? 'Características: ' + perfilInfo.descricao : ''}
${perfilInfo ? 'Resistências típicas: ' + perfilInfo.resistencias.join(', ') : ''}
Como chegou: ${queixa}

CONDUÇÃO REGISTRADA PELO ALUNO
"${resposta}"

O QUE AVALIAR (peso igual entre os quatro)
1. priorizacao — identificou o que precisa ser feito primeiro e por quê.
2. conducao — a intervenção proposta é concreta e aplicável agora.
3. seguranca — percebeu sinais de risco e cuidou do que não podia passar.
4. adaptacao — ajustou a abordagem ao perfil e às resistências do paciente.

REGRAS
- Nota de 0 a 10, com uma casa decimal.
- Seja justo com a brevidade: cobre substância, não extensão.
- Aponte no máximo 2 pontos de atenção, os mais importantes.
- Português do Brasil, direto, sem rodeios.

RETORNE APENAS JSON VÁLIDO:
{
  "nota": 0,
  "nota_componentes": { "priorizacao": 0, "conducao": 0, "seguranca": 0, "adaptacao": 0 },
  "pontos_fortes": "string",
  "pontos_atencao": "string",
  "proximo_passo": "string"
}`.trim();

    const respostaIA = chamarGroqAPI(prompt);
    const avaliacao = extrairJSONRobusto(respostaIA);

    const nota = validarNota(avaliacao.nota);
    const resultado = {
      sucesso: true,
      respondido: true,
      expirou: expirou,
      numero: numero,
      perfil: perfil,
      nota: round1(nota),
      nota_minima: PLANTAO.NOTA_MINIMA,
      aprovado: nota >= PLANTAO.NOTA_MINIMA,
      componentes: avaliacao.nota_componentes || {},
      fortes: garantirTexto(avaliacao.pontos_fortes, 'Não identificado'),
      atencao: garantirTexto(avaliacao.pontos_atencao, 'Não identificado'),
      proximo_passo: garantirTexto(avaliacao.proximo_passo, 'Revise a priorização inicial do caso.')
    };

    salvarCasoPlantao(email, curso, idPlantao, numero, perfil, resultado.nota, tempoSeg, resposta,
      resultado.fortes + ' | ' + resultado.atencao, expirou);

    return resultado;

  } catch (error) {
    registrarLog('PLANTAO_ERROR',
      dados && dados.email ? String(dados.email) : '',
      dados && dados.curso ? String(dados.curso) : '',
      '', error.message, error.stack);
    return { erro: true, mensagem: 'Erro ao avaliar o caso: ' + error.message };
  }
}

function salvarCasoPlantao(email, curso, idPlantao, numero, perfil, nota, tempoSeg, resposta, feedback, expirou) {
  const sheet = getOrCreateSheet(PLANTAO.SHEET, [
    'timestamp', 'email', 'curso', 'id_plantao', 'caso_numero', 'perfil',
    'nota', 'tempo_seg', 'expirou', 'resposta', 'feedback'
  ]);

  sheet.appendRow([
    new Date().toISOString(),
    email,
    curso,
    idPlantao,
    numero,
    perfil,
    nota === null || nota === undefined ? '' : nota,
    tempoSeg,
    expirou ? 'SIM' : 'NAO',
    resposta,
    feedback
  ]);
}

/**
 * Histórico de plantões do aluno, agrupado por turno.
 * Lê só as colunas necessárias — a coluna resposta guarda textos longos.
 */
function buscarHistoricoPlantao(email, curso) {
  try {
    const emailNorm = normalizarTexto(email).toLowerCase();
    const cursoNorm = normalizarTexto(curso);
    if (!emailNorm) return { turnos: [] };

    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(PLANTAO.SHEET);
    if (!sheet || sheet.getLastRow() < 2) return { turnos: [] };

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const iTs     = headers.indexOf('timestamp');
    const iEmail  = headers.indexOf('email');
    const iCurso  = headers.indexOf('curso');
    const iId     = headers.indexOf('id_plantao');
    const iNumero = headers.indexOf('caso_numero');
    const iPerfil = headers.indexOf('perfil');
    const iNota   = headers.indexOf('nota');

    const pos = [iTs, iEmail, iCurso, iId, iNumero, iPerfil, iNota];
    if (pos.some(function (p) { return p === -1; })) return { turnos: [] };

    // bloco mínimo, deixando de fora resposta e feedback (textos longos)
    const primeira = Math.min.apply(null, pos);
    const ultima   = Math.max.apply(null, pos);
    const dados = sheet
      .getRange(2, primeira + 1, sheet.getLastRow() - 1, ultima - primeira + 1)
      .getValues();

    const turnos = {};
    for (let i = 0; i < dados.length; i++) {
      const row = dados[i];
      if (String(row[iEmail - primeira]).toLowerCase().trim() !== emailNorm) continue;
      if (cursoNorm && String(row[iCurso - primeira]).trim() !== cursoNorm) continue;

      const id = String(row[iId - primeira] || '');
      if (!id) continue;

      if (!turnos[id]) {
        turnos[id] = { id_plantao: id, data: String(row[iTs - primeira] || ''), casos: [] };
      }
      const nota = row[iNota - primeira];
      turnos[id].casos.push({
        numero: Number(row[iNumero - primeira] || 0),
        perfil: String(row[iPerfil - primeira] || ''),
        nota: nota === '' || nota === null ? null : Number(nota)
      });
    }

    const lista = Object.keys(turnos).map(function (id) {
      const t = turnos[id];
      t.casos.sort(function (a, b) { return a.numero - b.numero; });
      const comNota = t.casos.filter(function (c) { return c.nota !== null; });
      t.media = comNota.length
        ? round1(comNota.reduce(function (s, c) { return s + c.nota; }, 0) / comNota.length)
        : null;
      t.respondidos = comNota.length;
      t.total = t.casos.length;
      return t;
    }).sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); });

    return { turnos: lista.slice(0, 10) };

  } catch (err) {
    registrarLog('PLANTAO_HISTORICO_ERROR', email, curso, '', err.message, err.stack);
    return { turnos: [] };
  }
}


// =============================================================================
// DIAGNÓSTICO — rode esta função no editor (seletor de função → Executar) e
// leia o Registro de execução. Não depende do site nem de nova implantação.
//
// Ela chama o doPost de verdade, então testa também o roteamento: se os 3
// casos não estiverem ativos no switch, a resposta vem "Ação desconhecida".
// =============================================================================

function testarPlantao() {
  const chamar = function (payload) {
    // jsonResponse devolve um TextOutput; getContent() dá o JSON como texto.
    return doPost({ postData: { contents: JSON.stringify(payload) } }).getContent();
  };

  const EMAIL_TESTE = 'teste@ibsdh.com.br';
  const CURSO_TESTE = 'Practitioner';

  Logger.log('1) gerar ------------------------------------------------');
  const bruto = chamar({ action: 'plantao_gerar', curso: CURSO_TESTE });
  Logger.log(bruto);

  // Usa o perfil que o próprio gerar devolveu, para o teste refletir o fluxo
  // real em vez de um perfil inventado.
  let perfilTeste = 'Ansioso';
  let queixaTeste = 'Chega dizendo que não está aguentando mais.';
  try {
    const turno = JSON.parse(bruto);
    if (turno.casos && turno.casos.length) {
      perfilTeste = turno.casos[0].perfil;
      queixaTeste = turno.casos[0].queixa;
    }
  } catch (e) {
    Logger.log('(não deu para ler o turno gerado: ' + e.message + ')');
  }

  Logger.log('2) avaliar ----------------------------------------------');
  Logger.log(chamar({
    action: 'plantao_avaliar',
    dados: {
      email: EMAIL_TESTE,
      curso: CURSO_TESTE,
      id_plantao: 'teste-' + new Date().getTime(),
      numero: 1,
      perfil: perfilTeste,
      queixa: queixaTeste,
      // precisa passar de PLANTAO.MIN_CHARS para chegar de fato à IA
      resposta: 'Primeiro acolho a respiração e reduzo o ritmo da conversa antes de qualquer '
        + 'intervenção. Valido o que ele traz, checo sinais de risco e só então proponho um '
        + 'exercício curto de ancoragem, combinando o próximo passo antes de encerrar.',
      tempo_seg: 120,
      expirou: false
    }
  }));

  Logger.log('3) histórico --------------------------------------------');
  Logger.log(chamar({ action: 'plantao_historico', email: EMAIL_TESTE, curso: CURSO_TESTE }));
}


// =============================================================================
// PASSO FINAL — adicione estes 3 casos no switch do doPost, no Codigo.gs,
// logo antes de `default:`
// =============================================================================

/*
        case 'plantao_gerar':
          try {
            return jsonResponse(gerarPlantao(payload.curso));
          } catch(err) {
            return jsonResponse({ erro: true, mensagem: err.message });
          }

        case 'plantao_avaliar':
          try {
            return jsonResponse(avaliarPlantao(payload.dados));
          } catch(err) {
            return jsonResponse({ erro: true, mensagem: err.message });
          }

        case 'plantao_historico':
          try {
            return jsonResponse(buscarHistoricoPlantao(payload.email, payload.curso));
          } catch(err) {
            return jsonResponse({ erro: true, mensagem: err.message });
          }
*/

// =============================================================================
// DIAGNÓSTICO DE ACTIONS — cole como um NOVO arquivo no editor do Apps Script
// (Arquivo → + → Script, nomeie "Diagnostico"). Não precisa mexer no doPost:
// este arquivo só CHAMA o doPost, não adiciona nada a ele.
//
// Para que serve: responder com evidência a pergunta "está tudo funcionando?".
// Comparar nomes de action entre frontend e backend só prova que o código
// existe. Isto aqui exercita cada action de ponta a ponta e diz o que
// respondeu, o que falhou e o que está lento.
//
// Como usar: escolha a função no seletor do editor, clique Executar e leia o
// Registro de execução.
//
//   diagnosticarTudo()      → as actions de leitura (não gasta IA, não grava)
//   diagnosticarIA()        → as que chamam a Groq — CONSOME COTA
//   diagnosticarEscrita()   → as que gravam na planilha — ESCREVE DE VERDADE
// =============================================================================

const DIAG = {
  // Troque pelos seus dados reais antes de rodar: um aluno que já tenha
  // respondido pelo menos uma aula, senão várias actions devolvem vazio — o
  // que é resposta correta, mas não prova nada.
  EMAIL: 'seu@email.com',
  CURSO: 'Practitioner',
  AULA: 'Aula_1',
  PERFIL: 'Ansioso',

  // Acima disto, a resposta é considerada lenta. O travamento do Mentor não
  // aparecia como erro: aparecia como espera até o frontend desistir.
  LIMITE_LENTO_MS: 15000
};

/**
 * Actions de LEITURA: não gastam IA e não gravam nada.
 * É o conjunto seguro para rodar quantas vezes quiser.
 */
function diagnosticarTudo() {
  executarDiagnostico('LEITURA (sem IA, sem escrita)', [
    { action: 'verificar_acesso',   email: DIAG.EMAIL, curso: DIAG.CURSO },
    { action: 'estrutura_curso',    curso: DIAG.CURSO },
    { action: 'base_aula',          curso: DIAG.CURSO, aula: DIAG.AULA },
    { action: 'progresso',          email: DIAG.EMAIL, curso: DIAG.CURSO },
    { action: 'historico',          email: DIAG.EMAIL, curso: DIAG.CURSO, aula: DIAG.AULA },
    { action: 'ranking_perfis',     curso: DIAG.CURSO },
    { action: 'posicao_ranking',    email: DIAG.EMAIL, curso: DIAG.CURSO },
    { action: 'evolucao_perfis',    email: DIAG.EMAIL, curso: DIAG.CURSO },
    { action: 'tentativa_anterior', email: DIAG.EMAIL, curso: DIAG.CURSO, aula: DIAG.AULA },
    { action: 'desafio_semanal',    curso: DIAG.CURSO },
    { action: 'buscar_mentor',      email: DIAG.EMAIL, curso: DIAG.CURSO, aula: DIAG.AULA },
    { action: 'comparacao_anonima', curso: DIAG.CURSO, aula: DIAG.AULA, perfil: DIAG.PERFIL, email: DIAG.EMAIL },
    { action: 'buscar_diario',      email: DIAG.EMAIL, curso: DIAG.CURSO, aula: DIAG.AULA },
    { action: 'relatorio_evolucao', email: DIAG.EMAIL, curso: DIAG.CURSO },
    { action: 'consultar_certificado', email: DIAG.EMAIL, curso: DIAG.CURSO },
    { action: 'plantao_gerar',      curso: DIAG.CURSO },
    { action: 'plantao_historico',  email: DIAG.EMAIL, curso: DIAG.CURSO },
    // Existe no doPost e NENHUMA tela chama. Está aqui para confirmar se
    // responde — se responder, é funcionalidade pronta e invisível.
    { action: 'titulos',            email: DIAG.EMAIL, curso: DIAG.CURSO }
  ]);
}

/**
 * Actions que chamam a Groq. CONSOME COTA DE IA — rode quando quiser mesmo.
 * São também as mais lentas: espere alguns segundos por linha.
 */
function diagnosticarIA() {
  executarDiagnostico('IA (consome cota da Groq)', [
    { action: 'boas_vindas',    email: DIAG.EMAIL, curso: DIAG.CURSO, aula: DIAG.AULA, nome: 'Teste' },
    { action: 'tutor',          dados: { email: DIAG.EMAIL, curso: DIAG.CURSO, aula: DIAG.AULA,
                                         pergunta: 'O que é rapport?' } },
    { action: 'conversar',      email: DIAG.EMAIL, curso: DIAG.CURSO, aula: DIAG.AULA,
                                perfil: DIAG.PERFIL, mensagem: 'Bom dia, como você está?', historico: [] },
    // O replay é o principal suspeito desta rodada: o prompt tinha
    // `+ resposta +` como TEXTO LITERAL em vez de interpolação, então a IA
    // nunca via a resposta do aluno. Leia o texto devolvido: se ele não falar
    // da frase abaixo, a correção de uma linha não foi aplicada.
    { action: 'replay',
      resposta: 'Acolhi a respiração do paciente antes de qualquer técnica e checquei sinais de risco.',
      fortes: 'Acolhimento adequado', atencao: 'Faltou plano de segurança',
      prescricao: 'Revisar aula', perfil: DIAG.PERFIL, curso: DIAG.CURSO, aula: DIAG.AULA },
    { action: 'gerar_desafio',  curso: DIAG.CURSO, aula: DIAG.AULA, nivel: 'medio' },
    { action: 'analise_diario', email: DIAG.EMAIL, curso: DIAG.CURSO }
  ]);
}

/**
 * Actions que GRAVAM. Rode só se aceitar os efeitos colaterais descritos.
 * `emitir_certificado` fica de fora de propósito: ela dispara e-mail real.
 */
function diagnosticarEscrita() {
  executarDiagnostico('ESCRITA (grava na planilha)', [
    { action: 'salvar_diario', email: DIAG.EMAIL, curso: DIAG.CURSO, aula: DIAG.AULA,
      reflexao: '[diagnóstico] entrada de teste, pode apagar' },
    { action: 'plantao_avaliar', dados: {
        email: DIAG.EMAIL, curso: DIAG.CURSO, id_plantao: 'diag-' + new Date().getTime(),
        numero: 1, perfil: DIAG.PERFIL, queixa: 'teste',
        resposta: 'Acolho a respiração, checo sinais de risco e proponho um exercício curto de ancoragem, combinando o próximo passo antes de encerrar.',
        tempo_seg: 60, expirou: false } }
  ]);
}

/**
 * Lista as avaliações do aluno na Avaliacoes_SENA, linha a linha.
 *
 * Existe por uma contradição encontrada no diagnóstico: o `Progresso_Aluno`
 * mostrava nota 8 numa aula enquanto o `Avaliacoes_SENA` devolvia média perto
 * de zero para os mesmos perfis. Médias não explicam a causa — só as linhas
 * explicam.
 *
 * A suspeita a confirmar: sessões gravadas com nota 0 quando a avaliação por
 * IA falhou (o período em que o modelo da Groq foi descontinuado). Elas não
 * afetam o Progresso_Aluno, que guarda a melhor nota, mas envenenam qualquer
 * média — inclusive a do card de desempenho por perfil.
 *
 * Não altera nada: só lê e imprime.
 */
function diagnosticarNotas() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.AVALIACOES);
  if (!sheet || sheet.getLastRow() < 2) { Logger.log('Aba vazia.'); return; }

  const dados = sheet.getDataRange().getValues();
  const h = dados[0];
  const iTs = h.indexOf('timestamp'), iEmail = h.indexOf('email');
  const iCurso = h.indexOf('curso'), iAula = h.indexOf('aula');
  const iPerfil = h.indexOf('perfil'), iNota = h.indexOf('nota_total');
  const iAprov = h.indexOf('aprovado'), iModelo = h.indexOf('modelo_ia');

  const emailNorm = String(DIAG.EMAIL).toLowerCase().trim();
  Logger.log('=== AVALIAÇÕES DE ' + DIAG.EMAIL + ' ===');
  Logger.log(alinhar('data', 12) + '| ' + alinhar('aula', 9) + '| ' + alinhar('perfil', 18)
    + '| ' + alinhar('nota', 6) + '| ' + alinhar('aprov', 6) + '| modelo');
  Logger.log('------------|----------|-------------------|-------|-------|--------');

  let total = 0, zeradas = 0, soma = 0;
  const zeradasPorAula = {};

  for (let i = 1; i < dados.length; i++) {
    const r = dados[i];
    if (String(r[iEmail]).toLowerCase().trim() !== emailNorm) continue;
    if (String(r[iCurso]).trim() !== DIAG.CURSO) continue;

    const nota = Number(r[iNota] || 0);
    const aula = String(r[iAula] || '');
    total++; soma += nota;
    if (nota === 0) {
      zeradas++;
      zeradasPorAula[aula] = (zeradasPorAula[aula] || 0) + 1;
    }

    Logger.log(alinhar(String(r[iTs]).substring(0, 10), 12) + '| ' + alinhar(aula, 9) + '| '
      + alinhar(String(r[iPerfil] || ''), 18) + '| ' + alinhar(nota.toFixed(1), 6) + '| '
      + alinhar(String(r[iAprov] || ''), 6) + '| '
      + (iModelo >= 0 ? String(r[iModelo] || '') : '—'));
  }

  Logger.log('');
  Logger.log('total de avaliações: ' + total);
  Logger.log('com nota ZERO: ' + zeradas + (total ? ' (' + Math.round(zeradas / total * 100) + '%)' : ''));
  Logger.log('média com as zeradas   : ' + (total ? (soma / total).toFixed(2) : '—'));
  Logger.log('média SEM as zeradas   : ' + ((total - zeradas) ? (soma / (total - zeradas)).toFixed(2) : '—'));
  if (zeradas > 0) {
    Logger.log('');
    Logger.log('Zeradas por aula: ' + JSON.stringify(zeradasPorAula));
    Logger.log('Se a diferença entre as duas médias for grande, as zeradas estão');
    Logger.log('distorcendo o card de desempenho por perfil e o ranking.');
  }
}


/**
 * Abre as linhas com nota zero: o que o aluno escreveu e o que a IA respondeu.
 *
 * Por que: a primeira hipótese (zeros seriam resquício do apagão da Groq) foi
 * REFUTADA pelos dados — as duas zeradas mais recentes usaram o modelo novo,
 * funcionando. Média não distingue "aluno mandou lixo e tirou zero de
 * verdade" de "a nota não foi extraída da resposta da IA". Só o conteúdo
 * distingue, e são coisas opostas: a primeira é o sistema funcionando, a
 * segunda é bug que apaga o trabalho do aluno.
 *
 * Também confere a coerência entre nota e aprovado — há pelo menos uma linha
 * com nota 10 marcada como NÃO aprovada.
 *
 * Não altera nada: só lê e imprime.
 */
function diagnosticarZeros() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheetA = ss.getSheetByName(CONFIG.SHEETS.AVALIACOES);
  const sheetR = ss.getSheetByName(CONFIG.SHEETS.RESPOSTAS);
  if (!sheetA || sheetA.getLastRow() < 2) { Logger.log('Aba de avaliações vazia.'); return; }

  const dadosA = sheetA.getDataRange().getValues();
  const h = dadosA[0];
  const idx = {};
  ['timestamp','id_resposta','email','curso','aula','perfil','nota_total','nota_minima',
   'aprovado','justificativa','atencao','modelo_ia'].forEach(function (c) { idx[c] = h.indexOf(c); });

  // Índice id_resposta → texto, para mostrar o que o aluno realmente escreveu.
  const textos = {};
  if (sheetR && sheetR.getLastRow() > 1) {
    const hR = sheetR.getRange(1, 1, 1, sheetR.getLastColumn()).getValues()[0];
    const iIdR = hR.indexOf('id_resposta'), iTxt = hR.indexOf('resposta_texto');
    if (iIdR >= 0 && iTxt >= 0) {
      const dR = sheetR.getRange(2, 1, sheetR.getLastRow() - 1, sheetR.getLastColumn()).getValues();
      for (let i = 0; i < dR.length; i++) textos[String(dR[i][iIdR])] = String(dR[i][iTxt] || '');
    }
  }

  const emailNorm = String(DIAG.EMAIL).toLowerCase().trim();
  Logger.log('=== LINHAS COM NOTA ZERO — ' + DIAG.EMAIL + ' ===');
  Logger.log('');

  let n = 0, incoerentes = 0;
  for (let i = 1; i < dadosA.length; i++) {
    const r = dadosA[i];
    if (String(r[idx.email]).toLowerCase().trim() !== emailNorm) continue;
    if (String(r[idx.curso]).trim() !== DIAG.CURSO) continue;

    const nota = Number(r[idx.nota_total] || 0);
    const minima = Number(r[idx.nota_minima] || 7);
    const aprov = String(r[idx.aprovado] || '').trim().toUpperCase() === 'SIM';

    // Incoerência: a nota bate a mínima e mesmo assim está reprovada (ou o
    // contrário). Isso não depende de ser zero — checa todas as linhas.
    if ((nota >= minima) !== aprov) {
      incoerentes++;
      Logger.log('!! INCOERENTE — ' + String(r[idx.timestamp]).substring(0, 10) + ' ' + r[idx.aula]
        + ': nota ' + nota + ', mínima ' + minima + ', aprovado ' + r[idx.aprovado]);
    }

    if (nota !== 0) continue;
    n++;
    const texto = textos[String(r[idx.id_resposta])] || '(resposta não encontrada)';
    Logger.log('--- zero #' + n + ' | ' + String(r[idx.timestamp]).substring(0, 16)
      + ' | ' + r[idx.aula] + ' | ' + r[idx.perfil] + ' | ' + (r[idx.modelo_ia] || '—'));
    Logger.log('    aluno escreveu (' + texto.length + ' chars): ' + texto.substring(0, 160));
    if (idx.atencao >= 0)       Logger.log('    atencao      : ' + String(r[idx.atencao] || '').substring(0, 160));
    if (idx.justificativa >= 0) Logger.log('    justificativa: ' + String(r[idx.justificativa] || '').substring(0, 160));
    Logger.log('');
  }

  Logger.log('=== RESUMO ===');
  Logger.log('linhas com nota zero: ' + n);
  Logger.log('linhas incoerentes (nota x aprovado): ' + incoerentes);
  Logger.log('');
  Logger.log('Como ler:');
  Logger.log(' - resposta curta/sem sentido + justificativa coerente = sistema OK,');
  Logger.log('   zero merecido (provavelmente teste seu).');
  Logger.log(' - resposta longa e séria + justificativa vazia ou genérica = BUG:');
  Logger.log('   a nota não veio da IA, e o trabalho do aluno foi descartado.');
}


// ── Motor ────────────────────────────────────────────────────────────────────

function executarDiagnostico(titulo, casos) {
  Logger.log('=== ' + titulo + ' ===');
  Logger.log('aluno: ' + DIAG.EMAIL + ' | curso: ' + DIAG.CURSO + ' | aula: ' + DIAG.AULA);
  if (DIAG.EMAIL === 'seu@email.com') {
    Logger.log('!! ATENÇÃO: troque DIAG.EMAIL por um e-mail real antes de tirar conclusões.');
  }
  Logger.log('');
  Logger.log(alinhar('action', 22) + '| ' + alinhar('ms', 6) + '| ' + alinhar('status', 16) + '| resposta');
  Logger.log('----------------------|-------|-----------------|---------------------------');

  const problemas = [];

  for (let i = 0; i < casos.length; i++) {
    const caso = casos[i];
    const r = chamarAction(caso);
    Logger.log(alinhar(caso.action, 22) + '| ' + alinhar(String(r.ms), 6) + '| '
      + alinhar(r.status, 16) + '| ' + r.amostra);
    if (r.status !== 'OK') problemas.push(caso.action + ' → ' + r.status + ': ' + r.amostra);
  }

  Logger.log('');
  if (problemas.length === 0) {
    Logger.log('Todas responderam OK.');
  } else {
    Logger.log('PRECISAM DE ATENÇÃO (' + problemas.length + '):');
    for (let i = 0; i < problemas.length; i++) Logger.log('  - ' + problemas[i]);
  }
  Logger.log('');
  Logger.log('Legenda: FALTA NO SWITCH = o caso não foi adicionado ao doPost.');
  Logger.log('         ERRO = a função rodou e devolveu erro.');
  Logger.log('         VAZIO = respondeu sem dados (pode ser correto: base sem histórico).');
  Logger.log('         LENTO = acima de ' + (DIAG.LIMITE_LENTO_MS / 1000) + 's, o frontend pode desistir antes.');
}

function chamarAction(payload) {
  const inicio = new Date().getTime();
  let texto;
  try {
    texto = doPost({ postData: { contents: JSON.stringify(payload) } }).getContent();
  } catch (e) {
    return { ms: new Date().getTime() - inicio, status: 'EXCEÇÃO', amostra: e.message.substring(0, 90) };
  }
  const ms = new Date().getTime() - inicio;

  let status = 'OK';
  if (/Ação desconhecida/i.test(texto)) {
    status = 'FALTA NO SWITCH';
  } else if (/"erro"\s*:\s*true/.test(texto)) {
    status = 'ERRO';
  } else if (vazio(texto)) {
    status = 'VAZIO';
  } else if (ms > DIAG.LIMITE_LENTO_MS) {
    status = 'LENTO';
  }

  return { ms: ms, status: status, amostra: String(texto).substring(0, 90).replace(/\s+/g, ' ') };
}

/**
 * Resposta sem conteúdo útil: objeto vazio, ou com uma única lista vazia
 * dentro. Não é erro — uma base sem histórico responde assim, corretamente —
 * mas separar isso de "OK" evita ler silêncio como sucesso.
 */
function vazio(texto) {
  try {
    const o = JSON.parse(texto);
    if (!o || typeof o !== 'object') return false;
    const chaves = Object.keys(o);
    if (chaves.length === 0) return true;
    if (Array.isArray(o) && o.length === 0) return true;
    for (let i = 0; i < chaves.length; i++) {
      const v = o[chaves[i]];
      if (Array.isArray(v) && v.length === 0 && chaves.length === 1) return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

function alinhar(texto, largura) {
  let s = String(texto);
  if (s.length > largura) return s.substring(0, largura);
  while (s.length < largura) s += ' ';
  return s;
}

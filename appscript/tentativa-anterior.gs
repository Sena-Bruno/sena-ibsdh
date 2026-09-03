// =============================================================================
// TENTATIVA ANTERIOR — cole como um NOVO arquivo no editor do Apps Script
// (Arquivo → + → Script, nomeie "TentativaAnterior") e adicione o caso do
// switch que está no fim deste arquivo.
//
// Por que existe: o histórico que já existe (buscarHistoricoTentativas) mostra
// a nota e o feedback das tentativas anteriores, mas NÃO o texto que o aluno
// escreveu. Sem o texto não há como ele ver o que mudou de uma tentativa para
// a outra — que é justamente onde está o aprendizado.
//
// Devolve UMA tentativa (a anterior à atual) com a resposta e os pontos de
// atenção daquela vez, para a tela montar o contraste "o que me pediram" x
// "o que eu fiz agora".
// =============================================================================

/**
 * A tentativa imediatamente anterior do aluno nesta aula.
 *
 * Feita para ser chamada logo depois de uma submissão: nesse momento a linha
 * mais recente da planilha é a tentativa que acabou de ser salva. Por isso
 * `excluirId` — quando o chamador sabe o id da atual, a exclusão é explícita;
 * quando não sabe, cai na regra posicional (descarta a mais recente).
 *
 * @returns {{anterior: object|null}} null quando é a primeira tentativa.
 */
function buscarTentativaAnterior(email, curso, aula, excluirId) {
  try {
    const emailNorm = normalizarTexto(email).toLowerCase();
    const cursoNorm = normalizarTexto(curso);
    const aulaNorm  = normalizarTexto(aula);
    if (!emailNorm || !cursoNorm || !aulaNorm) return { anterior: null };

    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheetAval = ss.getSheetByName(CONFIG.SHEETS.AVALIACOES);
    if (!sheetAval || sheetAval.getLastRow() < 2) return { anterior: null };

    const headers = sheetAval.getRange(1, 1, 1, sheetAval.getLastColumn()).getValues()[0];
    const iIdAval  = headers.indexOf('id_avaliacao');
    const iIdResp  = headers.indexOf('id_resposta');
    const iTs      = headers.indexOf('timestamp');
    const iEmail   = headers.indexOf('email');
    const iCurso   = headers.indexOf('curso');
    const iAula    = headers.indexOf('aula');
    const iPerfil  = headers.indexOf('perfil');
    const iNota    = headers.indexOf('nota_total');
    const iAprov   = headers.indexOf('aprovado');
    const iAtencao = headers.indexOf('atencao');

    const leves = [iIdAval, iIdResp, iTs, iEmail, iCurso, iAula, iPerfil, iNota, iAprov];
    if (leves.concat([iAtencao]).some(function (p) { return p === -1; })) return { anterior: null };

    // Primeiro passo: só as colunas leves, para achar a linha certa. A coluna
    // `atencao` é texto longo da IA e só será lida para a única linha que
    // interessa — mesma lição da correção do Mentor, que carregava a aba
    // inteira para usar cinco linhas.
    const primeira = Math.min.apply(null, leves);
    const ultima   = Math.max.apply(null, leves);
    const dados = sheetAval
      .getRange(2, primeira + 1, sheetAval.getLastRow() - 1, ultima - primeira + 1)
      .getValues();

    const idExcluir = normalizarTexto(excluirId);
    const candidatas = [];
    for (let i = 0; i < dados.length; i++) {
      const row = dados[i];
      if (String(row[iEmail - primeira]).toLowerCase().trim() !== emailNorm) continue;
      if (String(row[iCurso - primeira]).trim() !== cursoNorm) continue;
      if (String(row[iAula  - primeira]).trim() !== aulaNorm) continue;

      candidatas.push({
        linha: i + 2,   // +2: a leitura começa na linha 2 da planilha
        id: String(row[iIdAval - primeira] || ''),
        idResposta: String(row[iIdResp - primeira] || ''),
        timestamp: String(row[iTs - primeira] || ''),
        perfil: String(row[iPerfil - primeira] || ''),
        nota: Number(row[iNota - primeira] || 0),
        aprovado: String(row[iAprov - primeira] || '').trim().toUpperCase() === 'SIM'
      });
    }

    if (candidatas.length < 2 && !idExcluir) return { anterior: null };

    // Ordena por timestamp (mais recente primeiro). Não confiar na ordem das
    // linhas: reprocessamentos e correções manuais na planilha a quebram.
    candidatas.sort(function (a, b) { return String(b.timestamp).localeCompare(String(a.timestamp)); });

    let anterior = null;
    if (idExcluir) {
      for (let i = 0; i < candidatas.length; i++) {
        if (candidatas[i].id !== idExcluir) { anterior = candidatas[i]; break; }
      }
    } else {
      anterior = candidatas[1] || null;   // [0] é a que acabou de ser enviada
    }
    if (!anterior) return { anterior: null };

    // Agora sim, as duas leituras caras — uma célula cada.
    anterior.atencao = String(
      sheetAval.getRange(anterior.linha, iAtencao + 1).getValue() || ''
    );
    anterior.resposta = buscarTextoDaResposta(ss, anterior.idResposta);

    delete anterior.linha;
    delete anterior.idResposta;
    return { anterior: anterior };

  } catch (err) {
    registrarLog('TENTATIVA_ANTERIOR_ERROR', email, curso, aula, err.message, err.stack);
    return { anterior: null };
  }
}

/**
 * Texto de uma resposta específica, lendo só a coluna de IDs para localizar a
 * linha e depois uma única célula — em vez de carregar a aba inteira, onde
 * cada linha pode ter 5.000 caracteres.
 */
function buscarTextoDaResposta(ss, idResposta) {
  if (!idResposta) return '';
  const sheet = ss.getSheetByName(CONFIG.SHEETS.RESPOSTAS);
  if (!sheet || sheet.getLastRow() < 2) return '';

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const iId = headers.indexOf('id_resposta');
  const iTexto = headers.indexOf('resposta_texto');
  if (iId === -1 || iTexto === -1) return '';

  const ids = sheet.getRange(2, iId + 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === idResposta) {
      return String(sheet.getRange(i + 2, iTexto + 1).getValue() || '');
    }
  }
  return '';
}


// =============================================================================
// PASSO FINAL — adicione este caso no switch do doPost, no Codigo.gs,
// logo antes de `default:`
// =============================================================================

/*
        case 'tentativa_anterior':
          try {
            return jsonResponse(buscarTentativaAnterior(
              payload.email, payload.curso, payload.aula, payload.excluir_id));
          } catch(err) {
            return jsonResponse({ erro: true, mensagem: err.message });
          }
*/

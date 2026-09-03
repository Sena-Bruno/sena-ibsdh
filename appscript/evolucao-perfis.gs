// =============================================================================
// DESEMPENHO POR PERFIL CLÍNICO — cole como um NOVO arquivo no editor
// (Arquivo → + → Script, nomeie "EvolucaoPerfis") e adicione o caso do switch
// que está no fim deste arquivo.
//
// Por que existe: o aluno vê a nota ao longo do tempo e vê o ranking da turma,
// mas não vê o recorte que diz o que treinar em seguida — "vou bem com Ansioso
// e mal com Cético". O dado já está gravado em Avaliacoes_SENA desde sempre;
// só nunca foi agregado por perfil para o próprio aluno.
//
// Devolve números crus, sem texto pronto. A frase de recomendação é montada no
// frontend, para mudar a redação sem precisar de nova implantação do backend.
// =============================================================================

/**
 * Desempenho do aluno por perfil clínico, no curso.
 *
 * @returns {{perfis: Array, nota_minima: number}} perfis com sessoes,
 *          aprovadas, media, ultima_nota e ultima_data. Perfil nunca praticado
 *          não aparece na lista — quem decide como mostrar isso é o frontend.
 */
function buscarEvolucaoPerfis(email, curso) {
  try {
    const emailNorm = normalizarTexto(email).toLowerCase();
    const cursoNorm = normalizarTexto(curso);
    if (!emailNorm || !cursoNorm) return { perfis: [], nota_minima: CONFIG.DEFAULT_NOTA_MINIMA };

    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.AVALIACOES);
    if (!sheet || sheet.getLastRow() < 2) {
      return { perfis: [], nota_minima: CONFIG.DEFAULT_NOTA_MINIMA };
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const iTs     = headers.indexOf('timestamp');
    const iEmail  = headers.indexOf('email');
    const iCurso  = headers.indexOf('curso');
    const iPerfil = headers.indexOf('perfil');
    const iNota   = headers.indexOf('nota_total');
    const iAprov  = headers.indexOf('aprovado');

    const pos = [iTs, iEmail, iCurso, iPerfil, iNota, iAprov];
    if (pos.some(function (p) { return p === -1; })) {
      return { perfis: [], nota_minima: CONFIG.DEFAULT_NOTA_MINIMA };
    }

    // Bloco mínimo de colunas: a Avaliacoes_SENA tem quatro colunas de texto
    // longo geradas pela IA (fortes, atencao, prescricao, justificativa) que
    // não servem para nada aqui e pesam megabytes.
    const primeira = Math.min.apply(null, pos);
    const ultima   = Math.max.apply(null, pos);
    const dados = sheet
      .getRange(2, primeira + 1, sheet.getLastRow() - 1, ultima - primeira + 1)
      .getValues();

    const porPerfil = {};
    for (let i = 0; i < dados.length; i++) {
      const row = dados[i];
      if (String(row[iEmail - primeira]).toLowerCase().trim() !== emailNorm) continue;
      if (String(row[iCurso - primeira]).trim() !== cursoNorm) continue;

      const perfil = String(row[iPerfil - primeira] || '').trim();
      if (!perfil) continue;

      // Célula vazia precisa ser descartada ANTES do Number(): Number('') é 0,
      // não NaN, e uma sessão sem nota entraria como zero, puxando a média do
      // perfil para baixo sem que nada indicasse o motivo.
      const notaBruta = row[iNota - primeira];
      if (notaBruta === '' || notaBruta === null || notaBruta === undefined) continue;
      const nota = Number(notaBruta);
      if (isNaN(nota)) continue;

      if (!porPerfil[perfil]) {
        porPerfil[perfil] = { sessoes: 0, aprovadas: 0, soma: 0, ultimaData: '', ultimaNota: null };
      }
      const d = porPerfil[perfil];
      d.sessoes++;
      d.soma += nota;

      const aprovado = row[iAprov - primeira];
      if (aprovado === true || String(aprovado).toUpperCase() === 'SIM' ||
          String(aprovado).toUpperCase() === 'TRUE') {
        d.aprovadas++;
      }

      // A última sessão é a de timestamp mais recente, não a última linha:
      // a ordem das linhas na planilha não é garantia de ordem cronológica.
      const ts = String(row[iTs - primeira] || '');
      if (ts >= d.ultimaData) {
        d.ultimaData = ts;
        d.ultimaNota = nota;
      }
    }

    const perfis = Object.keys(porPerfil).map(function (p) {
      const d = porPerfil[p];
      return {
        perfil: p,
        sessoes: d.sessoes,
        aprovadas: d.aprovadas,
        media: Math.round((d.soma / d.sessoes) * 10) / 10,
        ultima_nota: d.ultimaNota,
        ultima_data: d.ultimaData
      };
    }).sort(function (a, b) { return a.media - b.media; });

    return { perfis: perfis, nota_minima: CONFIG.DEFAULT_NOTA_MINIMA };

  } catch (err) {
    registrarLog('EVOLUCAO_PERFIS_ERROR', email, curso, '', err.message, err.stack);
    return { perfis: [], nota_minima: CONFIG.DEFAULT_NOTA_MINIMA };
  }
}


// =============================================================================
// PASSO FINAL — adicione este caso no switch do doPost, no Codigo.gs,
// logo antes de `default:`
// =============================================================================

/*
        case 'evolucao_perfis':
          try {
            return jsonResponse(buscarEvolucaoPerfis(payload.email, payload.curso));
          } catch(err) {
            return jsonResponse({ erro: true, mensagem: err.message });
          }
*/

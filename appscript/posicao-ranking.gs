// =============================================================================
// POSIÇÃO NO RANKING — cole como um NOVO arquivo no editor do Apps Script
// (Arquivo → + → Script, nomeie "PosicaoRanking") e adicione o caso do switch
// que está no fim deste arquivo.
//
// Por que existe: o dashboard chamava `action: 'ranking'`, que nunca foi
// implementada no backend. O badge 🏆 e o card "Posição ranking" ficavam
// sempre em "—", em silêncio.
//
// Por que NÃO devolve a lista: o frontend antigo esperava o ranking inteiro
// para procurar a própria posição no navegador. Isso entregaria o e-mail de
// todos os alunos a qualquer um que abrisse o painel. Aqui só sai o número.
// =============================================================================

/**
 * Posição do aluno no ranking do curso.
 *
 * Critério: (1) mais aulas aprovadas, (2) desempate pela média das melhores
 * notas. Ordenar pela média pura penalizaria quem pratica perfis difíceis —
 * e praticar é exatamente o que o SENA quer estimular. Por isso o peso está
 * em quanto o aluno avançou, e a nota só desempata.
 *
 * @returns {{posicao: number|null, total: number}} posicao null = aluno ainda
 *          sem registro no curso (não aparece no ranking).
 */
function buscarPosicaoRanking(email, curso) {
  try {
    const emailNorm = normalizarTexto(email).toLowerCase();
    const cursoNorm = normalizarTexto(curso);
    if (!emailNorm || !cursoNorm) return { posicao: null, total: 0 };

    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.PROGRESSO);
    if (!sheet || sheet.getLastRow() < 2) return { posicao: null, total: 0 };

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const iEmail = headers.indexOf('email');
    const iCurso = headers.indexOf('curso');
    const iAprov = headers.indexOf('aprovado');
    const iNota  = headers.indexOf('melhor_nota');

    const pos = [iEmail, iCurso, iAprov, iNota];
    if (pos.some(function (p) { return p === -1; })) return { posicao: null, total: 0 };

    // Só o bloco mínimo de colunas — mesma lição do ranking de perfis, que
    // carregava a aba inteira incluindo as colunas de texto longo da IA.
    const primeira = Math.min.apply(null, pos);
    const ultima   = Math.max.apply(null, pos);
    const dados = sheet
      .getRange(2, primeira + 1, sheet.getLastRow() - 1, ultima - primeira + 1)
      .getValues();

    const porAluno = {};
    for (let i = 0; i < dados.length; i++) {
      const row = dados[i];
      if (String(row[iCurso - primeira]).trim() !== cursoNorm) continue;

      const aluno = String(row[iEmail - primeira]).toLowerCase().trim();
      if (!aluno) continue;

      if (!porAluno[aluno]) porAluno[aluno] = { aprovadas: 0, soma: 0, n: 0 };

      const aprovado = row[iAprov - primeira];
      if (aprovado === true || String(aprovado).toUpperCase() === 'SIM' ||
          String(aprovado).toUpperCase() === 'TRUE') {
        porAluno[aluno].aprovadas++;
      }

      const nota = Number(row[iNota - primeira]);
      if (!isNaN(nota) && nota > 0) {
        porAluno[aluno].soma += nota;
        porAluno[aluno].n++;
      }
    }

    const lista = Object.keys(porAluno).map(function (a) {
      const d = porAluno[a];
      return { email: a, aprovadas: d.aprovadas, media: d.n ? d.soma / d.n : 0 };
    });

    lista.sort(function (x, y) {
      if (y.aprovadas !== x.aprovadas) return y.aprovadas - x.aprovadas;
      return y.media - x.media;
    });

    const indice = lista.findIndex(function (a) { return a.email === emailNorm; });

    return {
      posicao: indice === -1 ? null : indice + 1,
      total: lista.length
    };

  } catch (err) {
    registrarLog('POSICAO_RANKING_ERROR', email, curso, '', err.message, err.stack);
    return { posicao: null, total: 0 };
  }
}


// =============================================================================
// PASSO FINAL — adicione este caso no switch do doPost, no Codigo.gs,
// logo antes de `default:`
// =============================================================================

/*
        case 'posicao_ranking':
          try {
            return jsonResponse(buscarPosicaoRanking(payload.email, payload.curso));
          } catch(err) {
            return jsonResponse({ erro: true, mensagem: err.message });
          }
*/

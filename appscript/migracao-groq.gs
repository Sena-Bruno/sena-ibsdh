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

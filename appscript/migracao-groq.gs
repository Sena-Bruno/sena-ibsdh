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

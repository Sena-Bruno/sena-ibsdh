// =============================================================================
// GROQ RESILIENTE — cole como um NOVO arquivo no editor do Apps Script
// (Arquivo → + → Script, nomeie "Groq") e APAGUE a chamarGroqAPI antiga do
// Codigo.gs, senão o Apps Script usa uma das duas de forma imprevisível.
//
// Por que existe: CONFIG.MODEL_NAME era uma string única. Quando a Groq
// descontinuou o llama-3.3-70b-versatile, TODA a avaliação por IA caiu de uma
// vez — simulador, tutor, replay, desafio — e o problema só apareceu quando um
// aluno tentou usar. A Groq roda modelos de terceiros e aposenta versões com
// frequência: isso se repete.
//
// A assinatura e o retorno são idênticos aos de antes (recebe o prompt,
// devolve a string do content), então nenhum chamador precisa mudar.
// =============================================================================

const GROQ = {
  // Ordem de preferência. Saiu do listarModelosGroq() desta conta — se um dia
  // a lista mudar, rode a função de novo e atualize aqui.
  MODELOS: [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b'
  ],
  TENTATIVAS_POR_MODELO: 2,
  ESPERA_MS: 1500,
  URL: 'https://api.groq.com/openai/v1/chat/completions',
  TEMPERATURA: 0.15,
  MAX_TOKENS: 1500
};

/**
 * NÚCLEO: tenta os modelos em ordem até um responder.
 *
 * Toda chamada à Groq deveria passar por aqui. O projeto tinha SETE caminhos
 * independentes para a mesma API, cada um com sua cópia do fetch — então a
 * primeira versão desta blindagem protegia só um deles. Parametrizar o núcleo
 * é o que permite os outros usarem a mesma lógica em vez de recriá-la.
 *
 * @param {Array} mensagens - no formato da API ([{role, content}, ...])
 * @param {object} [opcoes] - { json, maxTokens, temperature }
 * @returns {string} o conteúdo da resposta
 * @throws {Error} se nenhum modelo responder, ou se a chave for inválida
 */
function chamarGroqCore(mensagens, opcoes) {
  const op = opcoes || {};
  const config = {
    json: op.json !== false,                                   // JSON é o padrão
    maxTokens: op.maxTokens || GROQ.MAX_TOKENS,
    temperature: op.temperature === undefined ? GROQ.TEMPERATURA : op.temperature
  };

  const modelos = (GROQ.MODELOS && GROQ.MODELOS.length)
    ? GROQ.MODELOS
    : [CONFIG.MODEL_NAME];

  const falhas = [];

  for (let m = 0; m < modelos.length; m++) {
    const modelo = modelos[m];

    for (let tentativa = 1; tentativa <= GROQ.TENTATIVAS_POR_MODELO; tentativa++) {
      const r = tentarModeloGroq(modelo, mensagens, config);

      if (r.ok) {
        // Só é fallback se não foi o primeiro modelo da lista.
        if (m > 0) avisarFallbackGroq(modelos[0], modelo, falhas.join(' | '));
        return r.conteudo;
      }

      falhas.push(modelo + ': ' + r.motivo);

      // Chave inválida: repetir não ajuda e trocar de modelo também não.
      // Falhar alto aqui é melhor do que mascarar como "todos os modelos
      // fora do ar", que mandaria você caçar o problema no lugar errado.
      if (r.classe === 'AUTH') {
        throw new Error('Groq recusou a chave de API (' + r.motivo + '). '
          + 'Verifique a propriedade GROQ_API_KEY em Configurações do projeto.');
      }

      // Modelo morto ou inexistente: não adianta insistir, vai para o próximo.
      if (r.classe === 'MODELO') break;

      // 429 e 5xx são transitórios: espera antes de repetir, se ainda houver
      // tentativa. Na última, cai para o próximo modelo sem esperar à toa.
      if (tentativa < GROQ.TENTATIVAS_POR_MODELO) {
        Utilities.sleep(GROQ.ESPERA_MS * tentativa);
      }
    }
  }

  throw new Error('Nenhum modelo da Groq respondeu. Tentativas: ' + falhas.join(' | '));
}

/**
 * Avaliação clínica em JSON. Mesma assinatura e mesmo retorno de sempre —
 * nenhum chamador precisa mudar.
 */
function chamarGroqAPI(prompt) {
  return chamarGroqCore([
    { role: 'system', content: 'Você é o SENA, avaliador clínico rigoroso. Responda apenas em JSON válido.' },
    { role: 'user', content: prompt }
  ], { json: true });
}

/**
 * Resposta em texto corrido (tutor, relatórios, diário). Substitui a
 * chamarGroqTexto do Codigo.gs, que tinha sua própria cópia do fetch e
 * portanto nenhuma proteção: sem fallback de modelo, sem retry em 429 e sem
 * detecção de conteúdo vazio.
 *
 * O maxTokens é generoso de propósito. Modelos de raciocínio gastam parte do
 * orçamento pensando antes de escrever, e um teto apertado devolve `content`
 * vazio — foi exatamente o que quebrou a mensagem de boas-vindas, que usava
 * max_tokens 120.
 */
function chamarGroqTexto(prompt, opcoes) {
  const op = opcoes || {};
  return chamarGroqCore([
    { role: 'system', content: op.sistema
        || 'Você é um tutor didático e claro. Responda em texto normal, sem JSON.' },
    { role: 'user', content: prompt }
  ], { json: false, maxTokens: op.maxTokens || 900, temperature: op.temperature === undefined ? 0.3 : op.temperature });
}

/**
 * Uma chamada a um modelo. Não lança: classifica e devolve o que aconteceu,
 * porque é a classificação que decide entre repetir, pular ou abortar.
 *
 * @returns {{ok: boolean, conteudo?: string, classe?: string, motivo?: string}}
 *          classe: AUTH | MODELO | LIMITE | SERVIDOR | VAZIO | REDE
 */
function tentarModeloGroq(modelo, mensagens, config) {
  const corpo = {
    model: modelo,
    messages: mensagens,
    temperature: config.temperature,
    max_tokens: config.maxTokens
  };
  // response_format só faz sentido quando esperamos JSON. Impor isso a uma
  // resposta em prosa (tutor, paciente) faria o modelo devolver JSON onde a
  // tela espera texto.
  if (config.json) corpo.response_format = { type: 'json_object' };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + getGroqApiKey(),
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(corpo),
    muteHttpExceptions: true
  };

  let code, texto;
  try {
    const response = UrlFetchApp.fetch(GROQ.URL, options);
    code = response.getResponseCode();
    texto = response.getContentText();
  } catch (e) {
    // Falha de rede/DNS/timeout do UrlFetchApp: vale repetir.
    return { ok: false, classe: 'REDE', motivo: 'falha de rede: ' + e.message };
  }

  if (code === 401 || code === 403) {
    return { ok: false, classe: 'AUTH', motivo: 'HTTP ' + code };
  }
  if (code === 429) {
    return { ok: false, classe: 'LIMITE', motivo: 'HTTP 429 (limite de taxa)' };
  }
  if (code >= 500) {
    return { ok: false, classe: 'SERVIDOR', motivo: 'HTTP ' + code };
  }
  if (code === 404 || (code === 400 && /model/i.test(texto))) {
    return { ok: false, classe: 'MODELO', motivo: 'modelo indisponível (HTTP ' + code + ')' };
  }
  if (code !== 200) {
    return { ok: false, classe: 'SERVIDOR', motivo: 'HTTP ' + code + ': ' + String(texto).substring(0, 200) };
  }

  let conteudo;
  try {
    const json = JSON.parse(texto);
    conteudo = json && json.choices && json.choices[0] && json.choices[0].message
      ? json.choices[0].message.content
      : '';
  } catch (e) {
    return { ok: false, classe: 'SERVIDOR', motivo: 'resposta ilegível: ' + e.message };
  }

  // 200 com conteúdo vazio acontece de verdade: modelos de raciocínio podem
  // gastar todo o max_tokens "pensando" e devolver content vazio, com o
  // raciocínio num campo à parte. Para quem chama, isso é falha.
  if (!conteudo || !String(conteudo).trim()) {
    return { ok: false, classe: 'VAZIO', motivo: 'resposta vazia' };
  }

  return { ok: true, conteudo: conteudo };
}

/**
 * Registra e avisa que o modelo principal caiu — no log sempre, por e-mail no
 * máximo uma vez por dia por modelo, para não virar spam num dia de
 * instabilidade da Groq.
 *
 * O destinatário vem da propriedade de script EMAIL_ADMIN. Sem ela, só o log:
 * assim nenhum endereço fica escrito no código.
 */
function avisarFallbackGroq(modeloPrincipal, modeloUsado, detalhes) {
  try {
    registrarLog('GROQ_FALLBACK', '', '', '',
      'Modelo ' + modeloPrincipal + ' falhou; respondido por ' + modeloUsado, detalhes);
  } catch (e) { /* log é acessório: nunca deve derrubar a avaliação do aluno */ }

  try {
    const props = PropertiesService.getScriptProperties();
    const admin = props.getProperty('EMAIL_ADMIN');
    if (!admin) return;

    const hoje = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd');
    const chave = 'GROQ_AVISO_' + modeloPrincipal;
    if (props.getProperty(chave) === hoje) return;
    props.setProperty(chave, hoje);

    enviarEmailZoho(admin,
      '[SENA] Modelo ' + modeloPrincipal + ' falhou — respondendo com ' + modeloUsado,
      '<p>O modelo principal da Groq não respondeu. As avaliações continuam '
      + 'funcionando pelo modelo seguinte da lista, então <strong>nenhum aluno '
      + 'ficou sem nota</strong> — mas vale conferir.</p>'
      + '<p><strong>Principal:</strong> ' + modeloPrincipal + '<br>'
      + '<strong>Respondeu:</strong> ' + modeloUsado + '</p>'
      + '<p><strong>Falhas:</strong><br>' + detalhes + '</p>'
      + '<p>Se o modelo principal foi descontinuado, rode <code>listarModelosGroq()</code> '
      + 'e atualize <code>GROQ.MODELOS</code>.</p>'
      + '<p style="color:#888;font-size:12px">Aviso enviado no máximo 1x por dia por modelo.</p>');
  } catch (e) {
    try { registrarLog('GROQ_AVISO_ERROR', '', '', '', e.message, ''); } catch (e2) {}
  }
}


// =============================================================================
// DIAGNÓSTICO — rode no editor para ver qual modelo está respondendo hoje.
// =============================================================================

function testarGroqResiliente() {
  const inicio = new Date().getTime();
  try {
    const r = chamarGroqAPI('Responda apenas: {"ok": true}');
    Logger.log('OK em ' + (new Date().getTime() - inicio) + 'ms — resposta: ' + r);
  } catch (e) {
    Logger.log('FALHOU em ' + (new Date().getTime() - inicio) + 'ms — ' + e.message);
  }
}

/**
 * Prova o fallback de verdade: põe um modelo inexistente na frente da lista e
 * confirma que a avaliação continua funcionando pelo seguinte. Restaura a
 * lista no fim, inclusive se der erro no meio.
 */
function testarFallbackGroq() {
  const original = GROQ.MODELOS.slice();
  try {
    GROQ.MODELOS = ['modelo-que-nao-existe-123'].concat(original);
    Logger.log('Com modelo falso na frente...');
    Logger.log(chamarGroqAPI('Responda apenas: {"ok": true}'));
    Logger.log('Fallback funcionou. Confira a linha GROQ_FALLBACK na aba de Logs.');
  } catch (e) {
    Logger.log('FALHOU: ' + e.message);
  } finally {
    GROQ.MODELOS = original;
  }
}

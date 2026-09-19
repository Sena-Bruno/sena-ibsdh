// =============================================================================
// AUTENTICAÇÃO POR CÓDIGO (OTP) — cole como um NOVO arquivo no editor do Apps
// Script (Arquivo → + → Script, nomeie "Autenticacao").
//
// Por que existe: até aqui, a "identidade" do aluno em toda ação sensível
// (progresso, respostas, feedback do mentor, certificado) era só o campo
// `email` que o PRÓPRIO CLIENTE manda no corpo da requisição — sem senha, sem
// prova nenhuma de que quem está enviando é dono daquele e-mail. Qualquer
// pessoa que soubesse ou adivinhasse o e-mail de um aluno podia ver o
// progresso e as respostas dele, e até consultar/emitir certificado em nome
// dele. É o achado F1/F2 da auditoria de segurança.
//
// O que este arquivo adiciona: um código de 6 dígitos enviado por e-mail
// (OTP), trocado por um token de sessão assinado com HMAC-SHA256. O cliente
// guarda só o token; o servidor é quem decide, a partir da assinatura, de
// quem são os dados pedidos — nunca mais do campo `email` cru do payload.
//
// Pré-requisito: defina a propriedade de script SESSION_SECRET (Configurações
// do projeto → Propriedades do script) com um valor aleatório longo, por
// exemplo gerado com `openssl rand -hex 32`. Sem ela, toda chamada falha alto
// em vez de aceitar um token não assinado.
//
// PASSO FINAL — depois de colar este arquivo, adicione estes 2 casos no
// switch do doPost, no Codigo.gs, e troque TODO caso que hoje confia em
// `payload.email` para usar `emailAutenticado(payload)` em vez disso — a
// lista exata está em appscript/README.md, seção "Autenticação (F1/F2)".
// =============================================================================

const AUTH = {
  OTP_TTL_SEG: 600,               // 10 minutos para usar o código
  OTP_TENTATIVAS_MAX: 5,          // tentativas erradas de confirmar antes de invalidar o código
  SOLICITACOES_JANELA_SEG: 600,   // janela do limite de pedidos de código
  SOLICITACOES_MAX: 3,            // no máx. 3 pedidos de código por e-mail a cada 10 min
  SESSAO_VALIDADE_MS: 12 * 60 * 60 * 1000  // 12h de validade do token
};

function getSessionSecret_() {
  const segredo = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET');
  if (!segredo) {
    throw new Error('SESSION_SECRET não configurado em Configurações do projeto.');
  }
  return segredo;
}

/**
 * Passo 1 do login: gera e envia por e-mail um código de uso único.
 *
 * Não revela se o e-mail existe ou não na base de alunos — isso é decidido
 * depois, por `verificarAcesso`, já com a sessão autenticada. Aqui a única
 * responsabilidade é provar que quem está pedindo o código tem acesso àquela
 * caixa de entrada.
 */
function solicitarAcesso(email) {
  const emailNorm = normalizarTexto(email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    throw new Error('E-mail inválido.');
  }

  const cache = CacheService.getScriptCache();

  // Limite de pedidos: sem isso, o próprio endpoint de OTP vira um jeito de
  // fazer a Zoho mandar e-mails em massa para qualquer endereço informado.
  const chaveJanela = 'otp_pedidos_' + emailNorm;
  const pedidos = Number(cache.get(chaveJanela) || 0);
  if (pedidos >= AUTH.SOLICITACOES_MAX) {
    throw new Error('Muitas solicitações para este e-mail. Tente novamente em alguns minutos.');
  }
  cache.put(chaveJanela, String(pedidos + 1), AUTH.SOLICITACOES_JANELA_SEG);

  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  const hash = Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, codigo + '|' + emailNorm));

  cache.put('otp_' + emailNorm, JSON.stringify({ hash: hash, tentativas: 0 }), AUTH.OTP_TTL_SEG);

  enviarEmailZoho(emailNorm, 'Seu código de acesso — SENA',
    '<p>Seu código de acesso ao SENA é:</p>' +
    '<p style="font-size:28px;font-weight:800;letter-spacing:.08em;">' + codigo + '</p>' +
    '<p>Ele expira em ' + Math.round(AUTH.OTP_TTL_SEG / 60) + ' minutos. Se você não pediu ' +
    'este código, ignore este e-mail — sua conta continua segura.</p>');

  registrarLog('AUTH_OTP_ENVIADO', emailNorm, '', '', '', '');
  return { sucesso: true, mensagem: 'Código enviado. Confira sua caixa de entrada.' };
}

/**
 * Passo 2 do login: confirma o código e emite o token de sessão.
 *
 * Até AUTH.OTP_TENTATIVAS_MAX tentativas erradas antes de invalidar o código
 * inteiro — sem isso, um código de 6 dígitos com 10 minutos de validade seria
 * viável de adivinhar por força bruta.
 */
function confirmarAcesso(email, codigo) {
  const emailNorm = normalizarTexto(email).toLowerCase();
  const cache = CacheService.getScriptCache();
  const chave = 'otp_' + emailNorm;
  const bruto = cache.get(chave);
  if (!bruto) throw new Error('Código expirado ou não solicitado. Peça um novo.');

  const registro = JSON.parse(bruto);
  if (registro.tentativas >= AUTH.OTP_TENTATIVAS_MAX) {
    cache.remove(chave);
    throw new Error('Muitas tentativas incorretas. Peça um novo código.');
  }

  const hashRecebido = Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      normalizarTexto(codigo) + '|' + emailNorm));

  if (hashRecebido !== registro.hash) {
    registro.tentativas += 1;
    cache.put(chave, JSON.stringify(registro), AUTH.OTP_TTL_SEG);
    throw new Error('Código incorreto.');
  }

  cache.remove(chave);
  registrarLog('AUTH_OTP_CONFIRMADO', emailNorm, '', '', '', '');
  return { token: emitirTokenSessao(emailNorm), email: emailNorm };
}

function emitirTokenSessao(email) {
  const exp = Date.now() + AUTH.SESSAO_VALIDADE_MS;
  const corpo = Utilities.base64EncodeWebSafe(email + '|' + exp);
  const assinatura = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(corpo, getSessionSecret_()));
  return corpo + '.' + assinatura;
}

/**
 * Valida o token que o cliente envia em `payload.token` e devolve o e-mail
 * autenticado.
 *
 * TODA ação que hoje confia em `payload.email` deve passar a chamar esta
 * função e usar o e-mail que ELA devolve — nunca `payload.email` diretamente.
 * É essa troca que fecha o achado F1/F2: o cliente prova quem ele é (via
 * token assinado pelo servidor), em vez de simplesmente dizer quem ele é.
 */
function emailAutenticado(payload) {
  const token = payload && payload.token;
  if (!token || token.indexOf('.') === -1) {
    throw new Error('Sessão ausente. Faça login novamente.');
  }

  const partes = token.split('.');
  const corpo = partes[0];
  const assinatura = partes[1];
  const esperada = Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(corpo, getSessionSecret_()));

  if (assinatura !== esperada) {
    throw new Error('Sessão inválida. Faça login novamente.');
  }

  const decodificado = Utilities.newBlob(Utilities.base64DecodeWebSafe(corpo)).getDataAsString();
  const separador = decodificado.lastIndexOf('|');
  const email = decodificado.substring(0, separador);
  const exp = Number(decodificado.substring(separador + 1));

  if (!email || !exp || Date.now() > exp) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  return email;
}


// =============================================================================
// PASSO FINAL — adicione estes 2 casos no switch do doPost, no Codigo.gs,
// logo antes de `default:`
// =============================================================================

/*
        case 'solicitar_codigo':
          try {
            return jsonResponse(solicitarAcesso(payload.email));
          } catch(err) {
            return jsonResponse({ erro: true, mensagem: err.message });
          }

        case 'confirmar_codigo':
          try {
            return jsonResponse(confirmarAcesso(payload.email, payload.codigo));
          } catch(err) {
            return jsonResponse({ erro: true, mensagem: err.message });
          }
*/

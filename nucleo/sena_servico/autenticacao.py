"""
Verificação do token de sessão — a MESMA prova que `appscript/autenticacao.gs`
já usa para o resto do SENA, byte a byte compatível.

┌───────────────────────────────────────────────────────────────────────┐
│  POR QUE NÃO É UM SISTEMA DE LOGIN NOVO                                │
│                                                                       │
│  O SENA já resolveu autenticação (achados F1/F2 da auditoria de       │
│  segurança): código por e-mail (OTP), trocado por um token assinado   │
│  com HMAC-SHA256. Inventar um segundo sistema aqui — outra sessão,    │
│  outra senha, outro cookie — seria exatamente o tipo de divergência   │
│  que este projeto inteiro evitou desde a etapa 0: duas fontes de      │
│  verdade sobre "quem é este aluno" que podem discordar.                │
│                                                                       │
│  Este módulo não emite token nenhum. Só VERIFICA o que o Apps Script  │
│  já emitiu — a mesma peça de papel, lida pelos dois lados.             │
└───────────────────────────────────────────────────────────────────────┘

## O formato do token (de `emitirTokenSessao`, em autenticacao.gs)

    token = base64url(email + "|" + expiracao_ms) + "." + base64url(
                HMAC-SHA256(base64url(email + "|" + expiracao_ms), SESSION_SECRET)
            )

## O segredo compartilhado

`SESSION_SECRET` já existe como Propriedade do Script no Apps Script. Este
serviço precisa do MESMO valor, na variável de ambiente `SENA_SESSION_SECRET`
— copie um do outro, não gere um segundo. Sem isso, todo token seria
rejeitado (nunca aceito por engano: ver `verificar_token`, que falha alto
quando o segredo não está configurado).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import time
from dataclasses import dataclass


class TokenInvalido(Exception):
    """Token ausente, malformado, com assinatura errada, ou expirado.

    Uma classe só para os quatro casos — quem chama trata "sessão ruim"
    como uma coisa só (pede login de novo), igual ao `emailAutenticado`
    do Apps Script, que também lança um `Error` genérico para todos eles.
    """


@dataclass(frozen=True)
class Sessao:
    """O que o token prova, depois de verificado."""

    email: str
    expira_em_ms: int


def _b64url_decodificar(texto: str) -> bytes:
    """`base64.urlsafe_b64decode`, tolerante à falta de padding.

    `Utilities.base64EncodeWebSafe` do Apps Script pode ou não incluir o
    `=` de padding dependendo de como foi chamado — em vez de apostar em
    qual variante o token vai trazer, completa o padding que faltar antes
    de decodificar. Decodificar errado aqui não pode nunca autenticar
    ninguém por engano: na pior hipótese, levanta erro de decodificação,
    que vira `TokenInvalido` em `verificar_token`.
    """
    faltando = (-len(texto)) % 4
    return base64.urlsafe_b64decode(texto + "=" * faltando)


def _b64url_codificar(dados: bytes) -> str:
    return base64.urlsafe_b64encode(dados).decode("ascii")


def obter_segredo() -> str:
    """O `SESSION_SECRET` compartilhado, da variável de ambiente.

    Falha alto se ausente — nunca aceita um token sem verificar a
    assinatura contra algo. `autenticacao.gs` tem a mesma regra em
    `getSessionSecret_()`.
    """
    segredo = os.environ.get("SENA_SESSION_SECRET", "")
    if not segredo:
        raise TokenInvalido(
            "SENA_SESSION_SECRET não configurado — nenhum token pode ser "
            "verificado. Copie o mesmo valor de SESSION_SECRET do Apps Script."
        )
    return segredo


def verificar_token(token: str | None, segredo: str | None = None) -> Sessao:
    """Verifica um token e devolve a sessão que ele prova.

    Levanta `TokenInvalido` para QUALQUER problema — token ausente, sem
    ponto separador, assinatura errada, corpo ilegível, ou expirado. Um
    `TokenInvalido` é sempre a resposta certa aqui: nunca autenticar por
    engano é mais importante que dar um erro específico para cada causa
    (que só ajudaria quem está tentando forjar um).

    A comparação da assinatura usa `hmac.compare_digest` — tempo
    constante, ao contrário do `!==` do JavaScript no lado do Apps
    Script. Não é uma correção do original (aquele token já é validado
    por outra camada antes de chegar aqui de qualquer forma); é só a
    prática padrão quando se escreve a verificação do zero.
    """
    if not token or "." not in token:
        raise TokenInvalido("Sessão ausente. Faça login novamente.")

    corpo, _, assinatura = token.partition(".")

    segredo_final = segredo if segredo is not None else obter_segredo()
    esperada = _b64url_codificar(
        hmac.new(segredo_final.encode("utf-8"), corpo.encode("ascii"), hashlib.sha256).digest()
    )

    # Comparação SEM o "=" de padding, dos dois lados. Achado testando contra
    # um token construído fora do Python (Node `Buffer.toString('base64url')`,
    # que nunca padeia): minha codificação produzia
    # "...wrR_vw=" e a assinatura real chegava como "...wrR_vw" — mesma
    # assinatura, padding diferente, e a comparação falhava por causa disso,
    # não por a assinatura estar errada. `Utilities.base64EncodeWebSafe` do
    # Apps Script pode ou não incluir o "=" dependendo de como é chamado;
    # tirar o padding dos dois lados antes de comparar torna a verificação
    # correta nas duas variantes, sem precisar adivinhar qual o Apps Script
    # está usando.
    if not hmac.compare_digest(assinatura.rstrip("="), esperada.rstrip("=")):
        raise TokenInvalido("Sessão inválida. Faça login novamente.")

    try:
        decodificado = _b64url_decodificar(corpo).decode("utf-8")
        email, _, exp_texto = decodificado.rpartition("|")
        expira_em_ms = int(exp_texto)
    except (ValueError, UnicodeDecodeError) as erro:
        raise TokenInvalido("Sessão inválida. Faça login novamente.") from erro

    if not email or not expira_em_ms:
        raise TokenInvalido("Sessão inválida. Faça login novamente.")

    agora_ms = int(time.time() * 1000)
    if agora_ms > expira_em_ms:
        raise TokenInvalido("Sessão expirada. Faça login novamente.")

    return Sessao(email=email, expira_em_ms=expira_em_ms)


# ── só para teste: emite um token no MESMO formato, sem depender do ─────
# ── Apps Script estar no ar para os testes rodarem ──────────────────────


def _emitir_token_para_teste(email: str, segredo: str, validade_ms: int = 12 * 60 * 60 * 1000) -> str:
    """Réplica de `emitirTokenSessao` (autenticacao.gs), só para teste.

    NUNCA importado por `api.py` — este serviço nunca emite token, só
    verifica. Existe aqui (não escondido em `testes_servico/`) porque
    `verificar_token` merece ser testado contra um token construído do
    jeito exato que o Apps Script constrói, e duplicar esta função dentro
    de um arquivo de teste arriscaria as duas cópias divergirem.
    """
    exp = int(time.time() * 1000) + validade_ms
    corpo = _b64url_codificar(f"{email}|{exp}".encode("utf-8"))
    assinatura = _b64url_codificar(
        hmac.new(segredo.encode("utf-8"), corpo.encode("ascii"), hashlib.sha256).digest()
    )
    return f"{corpo}.{assinatura}"

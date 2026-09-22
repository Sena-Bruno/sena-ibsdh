"""Testes de verificação do token — a mesma prova de `autenticacao.gs`."""

import base64
import hashlib
import hmac
import time
import unittest

from sena_servico.autenticacao import (
    TokenInvalido,
    _emitir_token_para_teste,
    obter_segredo,
    verificar_token,
)

SEGREDO = "segredo-de-teste-nao-e-o-de-producao"


class TestVerificarToken(unittest.TestCase):
    def test_token_valido_devolve_a_sessao(self):
        token = _emitir_token_para_teste("aluno@ibsdh.com.br", SEGREDO)
        sessao = verificar_token(token, SEGREDO)
        self.assertEqual(sessao.email, "aluno@ibsdh.com.br")

    def test_interoperabilidade_com_token_construido_sem_padding(self):
        """REGRESSÃO — o bug que a checagem contra um token real revelou.

        Node `Buffer.toString('base64url')` (e possivelmente
        `Utilities.base64EncodeWebSafe` do Apps Script, dependendo de como é
        chamado) não inclui o "=" de padding. A primeira versão deste
        verificador comparava a assinatura COM padding contra uma recebida
        SEM padding — mesma assinatura, comparação falhando por motivo
        errado. Construído aqui manualmente, sem `_emitir_token_para_teste`
        (que já usa o codificador deste módulo), para não mascarar o bug se
        ele voltar.
        """
        email, exp = "bruno@ibsdh.com.br", int(time.time() * 1000) + 3600_000
        corpo_bytes = f"{email}|{exp}".encode("utf-8")
        corpo = base64.urlsafe_b64encode(corpo_bytes).rstrip(b"=").decode("ascii")
        assinatura = (
            base64.urlsafe_b64encode(
                hmac.new(SEGREDO.encode("utf-8"), corpo.encode("ascii"), hashlib.sha256).digest()
            )
            .rstrip(b"=")
            .decode("ascii")
        )
        token_sem_padding = f"{corpo}.{assinatura}"

        sessao = verificar_token(token_sem_padding, SEGREDO)
        self.assertEqual(sessao.email, email)

    def test_sem_token_levanta(self):
        with self.assertRaises(TokenInvalido):
            verificar_token(None, SEGREDO)
        with self.assertRaises(TokenInvalido):
            verificar_token("", SEGREDO)

    def test_sem_ponto_separador_levanta(self):
        with self.assertRaises(TokenInvalido):
            verificar_token("naotemponto", SEGREDO)

    def test_assinatura_errada_levanta(self):
        token = _emitir_token_para_teste("aluno@ibsdh.com.br", SEGREDO)
        corpo, _, _ = token.partition(".")
        adulterado = f"{corpo}.assinaturaforjada"
        with self.assertRaises(TokenInvalido):
            verificar_token(adulterado, SEGREDO)

    def test_assinado_com_outro_segredo_levanta(self):
        """O caso mais importante: um token forjado com QUALQUER outro
        segredo tem que ser rejeitado, não só um forjado à mão."""
        token = _emitir_token_para_teste("aluno@ibsdh.com.br", "segredo-errado")
        with self.assertRaises(TokenInvalido):
            verificar_token(token, SEGREDO)

    def test_token_expirado_levanta(self):
        token = _emitir_token_para_teste(
            "aluno@ibsdh.com.br", SEGREDO, validade_ms=-1000  # já expirado
        )
        with self.assertRaises(TokenInvalido):
            verificar_token(token, SEGREDO)

    def test_corpo_ilegivel_levanta_em_vez_de_estourar(self):
        """Um corpo que não decodifica como UTF-8 válido não pode derrubar
        o serviço com um erro cru de codificação — vira TokenInvalido,
        igual a qualquer outro token ruim."""
        assinatura_qualquer = "x" * 40
        with self.assertRaises(TokenInvalido):
            verificar_token("!!!nao-e-base64!!!." + assinatura_qualquer, SEGREDO)

    def test_corpo_sem_separador_de_expiracao_levanta(self):
        corpo = base64.urlsafe_b64encode(b"so-um-texto-sem-pipe").rstrip(b"=").decode()
        assinatura = (
            base64.urlsafe_b64encode(
                hmac.new(SEGREDO.encode(), corpo.encode(), hashlib.sha256).digest()
            )
            .rstrip(b"=")
            .decode()
        )
        with self.assertRaises(TokenInvalido):
            verificar_token(f"{corpo}.{assinatura}", SEGREDO)

    def test_sem_segredo_configurado_falha_alto(self):
        """Nunca aceitar um token sem verificar contra ALGUM segredo."""
        import os

        valor_original = os.environ.pop("SENA_SESSION_SECRET", None)
        try:
            with self.assertRaises(TokenInvalido):
                obter_segredo()
        finally:
            if valor_original is not None:
                os.environ["SENA_SESSION_SECRET"] = valor_original


if __name__ == "__main__":
    unittest.main()

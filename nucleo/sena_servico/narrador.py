"""
Monta o narrador HTTP a partir do ambiente, uma vez, na subida do serviço.

Separado de `api.py` só para ficar testável sem levantar o FastAPI inteiro:
um teste chama `obter_narrador()` diretamente e confere `None` quando as
variáveis de ambiente não estão configuradas.
"""

from __future__ import annotations

import logging

from sena_nucleo.narrador_http import FalhaDoNarrador, narrador_http
from sena_nucleo.narrativa import Narrador

_registro = logging.getLogger("sena.narrador")


def obter_narrador() -> Narrador | None:
    """O narrador HTTP configurado, ou `None` se `SENA_IA_*` não estiver.

    `None` não é erro: `sena_nucleo.narrativa.narrar` já sabe cair para o
    texto fixo quando o narrador é `None`. A falta de configuração é
    registrada uma vez, em nível informativo — não é um problema do
    serviço, é o estado normal antes de alguém configurar a chave.
    """
    try:
        return narrador_http()
    except FalhaDoNarrador as erro:
        _registro.info("narrador HTTP inativo: %s", erro)
        return None

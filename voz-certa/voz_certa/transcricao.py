"""
Transcrição da gravação original — `faster-whisper`, rodando localmente,
sem enviar áudio pra lugar nenhum.

Por que este módulo é só um wrapper fino: a lógica que vale a pena testar
sem instalar nada pesado é a de `prosodia.py` (texto puro). Aqui só
existe a chamada ao modelo — testável de verdade apenas com o pacote
`faster-whisper` instalado, então não tem teste automatizado neste
repositório (ver o README, seção "O que não está coberto por teste
automático aqui").
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

#: "small" é o equilíbrio recomendado para CPU: mais rápido que "medium",
#: bem mais preciso que "tiny"/"base" para português falado devagar (o
#: registro típico de uma indução). Troque para "medium" se sua máquina
#: aguentar e a transcrição de "tiny"/"small" estiver errando muito.
MODELO_PADRAO = "small"


@dataclass(frozen=True)
class Transcricao:
    texto: str
    idioma_detectado: str
    confianca_idioma: float


def transcrever(caminho_audio: str | Path, modelo: str = MODELO_PADRAO) -> Transcricao:
    """Transcreve um arquivo de áudio (wav/mp3/m4a — o que o ffmpeg ler).

    Carrega o modelo a cada chamada de propósito: este é um programa de
    uso ocasional (gravar, ajustar, gerar — não um servidor de pedidos
    contínuos), então não vale a pena manter o modelo residente em
    memória entre uma gravação e outra.
    """
    from faster_whisper import WhisperModel

    modelo_carregado = WhisperModel(modelo, device="cpu", compute_type="int8")
    segmentos, info = modelo_carregado.transcribe(str(caminho_audio), language="pt")

    texto = " ".join(segmento.text.strip() for segmento in segmentos).strip()
    return Transcricao(
        texto=texto,
        idioma_detectado=info.language,
        confianca_idioma=info.language_probability,
    )

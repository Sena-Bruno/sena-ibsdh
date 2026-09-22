"""
Clonagem de voz e síntese — XTTS-v2 (Coqui), rodando localmente.

┌───────────────────────────────────────────────────────────────────────┐
│  POR QUE LOCAL, E POR QUE ESTE MODELO                                 │
│                                                                       │
│  Sem orçamento (a mesma restrição que decidiu a hospedagem do         │
│  Paciente Vivo — ver nucleo/README.md), a única forma de clonar voz   │
│  de graça é rodar o modelo na sua própria máquina, não num servidor   │
│  alugado. XTTS-v2 é open-source, roda em CPU (mais lento que com      │
│  placa de vídeo, mas funciona), tem português entre os idiomas        │
│  suportados nativamente, e clona a partir de UMA gravação curta — sem │
│  precisar treinar nada.                                               │
└───────────────────────────────────────────────────────────────────────┘

Como toda síntese por texto, não há controle fino de ENTONAÇÃO aqui — só
de ritmo (pausas no texto, ver `prosodia.py`) e velocidade (`velocidade`
abaixo). Ver o README, seção "O que esta v1 não faz", antes de esperar
"tom corrigido" no resultado.

Wrapper fino de propósito — como em `transcricao.py`, a lógica que vale a
pena testar sem os pacotes pesados instalados já está isolada em
`prosodia.py`.
"""

from __future__ import annotations

from pathlib import Path

#: Faixa observada como razoável para XTTS-v2 antes da voz ficar
#: irreconhecível (rápido demais) ou artificial (lento demais). Não é um
#: limite do modelo em si — é uma cautela deste wrapper.
VELOCIDADE_MINIMA = 0.6
VELOCIDADE_MAXIMA = 1.3


def clonar_e_sintetizar(
    texto: str,
    caminho_audio_referencia: str | Path,
    caminho_saida: str | Path,
    velocidade: float = 0.85,
) -> Path:
    """Sintetiza `texto` com a voz de `caminho_audio_referencia`.

    `caminho_audio_referencia` é a SUA gravação original — o mesmo áudio
    que passou por `transcricao.transcrever`. Não precisa ser um áudio
    "limpo" de estúdio; alguns segundos de fala clara já bastam para o
    XTTS-v2 capturar o timbre.

    `velocidade` abaixo de 1.0 desacelera a fala — a indução hipnótica se
    beneficia de um ritmo mais lento que a leitura comum (a mesma lógica
    de ofício documentada em `prosodia.py`); o padrão (0.85) já parte
    ligeiramente mais devagar que a fala neutra do modelo.
    """
    if not (VELOCIDADE_MINIMA <= velocidade <= VELOCIDADE_MAXIMA):
        raise ValueError(
            f"velocidade {velocidade!r} fora da faixa "
            f"[{VELOCIDADE_MINIMA}, {VELOCIDADE_MAXIMA}]"
        )

    from TTS.api import TTS

    modelo = TTS("tts_models/multilingual/multi-dataset/xtts_v2")
    caminho_saida = Path(caminho_saida)
    modelo.tts_to_file(
        text=texto,
        speaker_wav=str(caminho_audio_referencia),
        language="pt",
        file_path=str(caminho_saida),
        speed=velocidade,
    )
    return caminho_saida

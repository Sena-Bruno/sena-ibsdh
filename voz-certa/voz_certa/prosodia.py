"""
Marcação de pausas para indução hipnótica — a parte "ritmo e pausas" da
ideia #6 ("Sua voz, feita certo").

┌───────────────────────────────────────────────────────────────────────┐
│  O QUE ISTO É, E O QUE NÃO É                                          │
│                                                                       │
│  Indução hipnótica se beneficia de pausas mais longas que a fala      │
│  comum — especialmente depois de uma sugestão, para dar tempo do      │
│  ouvinte processar. Isso é PRÁTICA DE OFÍCIO (descrita em             │
│  transcrições de Milton Erickson e na literatura de PNL sobre         │
│  pacing), não um achado clínico medido. Por isso este módulo não      │
│  pretende ser "IA entendendo hipnose" — é uma regra de pontuação      │
│  simples e auditável: alongar a pausa que já existe na pontuação do   │
│  texto transcrito, na saída de `transcricao.py`.                      │
│                                                                       │
│  O que ISTO NÃO FAZ: não decide ONDE uma pausa deveria existir que    │
│  não existia (isso seria a IA inventando ênfase que você nunca deu),  │
│  e não controla ENTONAÇÃO/tom — só a síntese de voz por texto não dá  │
│  esse controle fino. Ver o README, seção "O que esta v1 não faz".     │
└───────────────────────────────────────────────────────────────────────┘

Só transforma TEXTO — nenhuma dependência pesada (sem torch, sem TTS),
testável sozinho.
"""

from __future__ import annotations

import re

INTENSIDADES = ("leve", "media", "forte")

#: Sufixos de pausa. Repetição de "." é a convenção mais universal para
#: sinalizar silêncio que um motor de TTS por texto entende, sem precisar
#: de marcação SSML (que XTTS não suporta de forma fina — ver README).
PAUSA_CURTA = " .."
PAUSA_MEDIA = " ..."
PAUSA_LONGA = " ......"

# Ponto/exclamação/interrogação isolados (não parte de uma reticência),
# seguidos de espaço ou fim de string.
_ENDERS = re.compile(r"(?<!\.)([.!?])(?!\.)(?=\s|$)")
# Vírgula, ponto e vírgula, dois-pontos — não seguidos de outro ponto
# (evita mexer em "algo:..." que já tem pausa).
_WEAK = re.compile(r"([,;:])(?!\.)")
_MULTI_DOTS = re.compile(r"\.{2,}")


def normalizar_reticencias(texto: str) -> str:
    """Colapsa qualquer sequência de 2+ pontos numa reticência única "...".

    A transcrição (Whisper) às vezes produz sequências irregulares de
    pontos para hesitação — isto dá uma forma canônica, para o resto do
    módulo (e o que o olho de quem revisa o texto vê) ser consistente.
    """
    return _MULTI_DOTS.sub("...", texto)


def inserir_pausas(texto: str, intensidade: str = "media") -> str:
    """Alonga as pausas já marcadas pela pontuação do texto transcrito.

    `intensidade`:
      - "leve": só normaliza reticências irregulares — nenhuma pausa nova.
      - "media" (padrão): acrescenta uma pausa depois de ponto final,
        exclamação e interrogação — não mexe em vírgula/ponto-e-vírgula/
        dois-pontos, para não esticar demais uma fala com pontuação leve.
      - "forte": o mesmo de "media", mais uma pausa curta depois de
        vírgula, ponto-e-vírgula e dois-pontos.

    Reticências que já existem no texto (a pausa que você já fez, e o
    Whisper já captou) nunca são tocadas — elas já SÃO o marcador máximo
    de pausa; alongá-las mais seria a ferramenta inventando ênfase que
    você não deu.
    """
    if intensidade not in INTENSIDADES:
        raise ValueError(
            f"intensidade inválida: {intensidade!r} — use um de {INTENSIDADES}"
        )

    texto = normalizar_reticencias(texto)
    if intensidade == "leve":
        return texto

    pausa_forte = PAUSA_LONGA if intensidade == "forte" else PAUSA_MEDIA
    texto = _ENDERS.sub(lambda m: m.group(1) + pausa_forte, texto)

    if intensidade == "forte":
        texto = _WEAK.sub(lambda m: m.group(1) + PAUSA_CURTA, texto)

    return texto

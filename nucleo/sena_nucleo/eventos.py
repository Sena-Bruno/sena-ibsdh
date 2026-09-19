"""
Os eventos de vida — o que acontece com o paciente sem pedir licença.

┌───────────────────────────────────────────────────────────────────────┐
│  POR QUE A SEMANA NÃO PODE SER SÓ A PRESCRIÇÃO                        │
│                                                                       │
│  Se a semana fosse apenas deriva + prescrição, ela seria uma função   │
│  determinística da condução do aluno — e o aluno aprenderia que       │
│  clínica é uma máquina de entrada e saída. Aprenderia errado.         │
│                                                                       │
│  A vida acontece no meio. O paciente melhor conduzido do mundo pode   │
│  perder o emprego na quarta-feira. A lição clínica não é "evite que   │
│  aconteça" — é que o trabalho do terapeuta é construir a reserva      │
│  (aliança, esperança, plano de segurança) que decide o que um evento  │
│  ruim FAZ com a pessoa quando ele chega.                              │
│                                                                       │
│  É por isso que a gravidade de cada evento aqui é MODULADA pelo       │
│  estado: o mesmo revés derruba um paciente sem aliança e apenas       │
│  arranha um com aliança alta. Quem construiu reserva colhe na crise.  │
└───────────────────────────────────────────────────────────────────────┘
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .estado import EstadoPaciente


@dataclass(frozen=True)
class Evento:
    """Uma coisa que aconteceu num dia da semana do paciente."""

    #: Chave curta, estável, usada em teste e em telemetria.
    id: str

    #: O que o paciente conta na sessão seguinte, na voz dele.
    relato: str

    #: Variações brutas, antes da modulação pela reserva do paciente.
    efeitos: dict[str, float] = field(default_factory=dict)

    #: Peso relativo no sorteio. Eventos cotidianos são comuns; catástrofes
    #: não. Um motor com todos os pesos iguais produziria uma vida em que
    #: alguém perde o emprego a cada três semanas.
    peso: float = 1.0

    #: Se `True`, a reserva do paciente NÃO amortece. Reservado para o que
    #: é grave o bastante para atravessar qualquer vínculo.
    inevitavel: bool = False


#: Eventos que qualquer perfil pode sortear.
EVENTOS_COMUNS: tuple[Evento, ...] = (
    Evento(
        id="noite_bem_dormida",
        relato="Dormi bem umas duas noites. Fez diferença.",
        efeitos={"energia": +0.05, "sofrimento": -0.03},
        peso=3.0,
    ),
    Evento(
        id="insonia",
        relato="Quase não dormi a semana toda.",
        efeitos={"energia": -0.07, "sofrimento": +0.05},
        peso=3.0,
    ),
    Evento(
        id="conversa_boa",
        relato="Consegui conversar com alguém sobre isso. Foi bom.",
        efeitos={"abertura": +0.05, "esperanca": +0.04, "sofrimento": -0.03},
        peso=2.0,
    ),
    Evento(
        id="atrito_familiar",
        relato="Briguei feio em casa. Ficou tudo pesado depois.",
        efeitos={"sofrimento": +0.07, "esperanca": -0.04},
        peso=2.5,
    ),
    Evento(
        id="pressao_no_trabalho",
        relato="A semana no trabalho foi impossível.",
        efeitos={"energia": -0.06, "sofrimento": +0.05},
        peso=2.5,
    ),
    Evento(
        id="pequena_vitoria",
        relato="Fiz uma coisa que estava adiando há meses.",
        efeitos={"esperanca": +0.07, "energia": +0.03},
        peso=1.5,
    ),
    Evento(
        id="isolamento",
        relato="Não saí de casa. Não falei com ninguém.",
        efeitos={"energia": -0.04, "abertura": -0.05, "esperanca": -0.03},
        peso=2.0,
    ),
)

#: Eventos que só fazem sentido para certos perfis — o que dá textura
#: clínica à semana em vez de ruído genérico.
EVENTOS_POR_PERFIL: dict[str, tuple[Evento, ...]] = {
    "Ansioso": (
        Evento(
            id="crise_madrugada",
            relato="Acordei às três da manhã achando que ia morrer.",
            efeitos={"sofrimento": +0.10, "esperanca": -0.05},
            peso=3.0,
        ),
        Evento(
            id="antecipacao_nao_confirmada",
            relato="Aquilo que eu tinha certeza que ia dar errado... não deu.",
            efeitos={"esperanca": +0.08, "sofrimento": -0.05},
            peso=1.5,
        ),
    ),
    "Cético": (
        Evento(
            id="pesquisou_sozinho",
            relato="Fui ler sobre isso por conta própria.",
            # O cético que pesquisa pode voltar convencido OU armado. O
            # motor não decide: dá um pequeno ganho de aliança e um de
            # abertura, e deixa a sessão descobrir de que lado ele voltou.
            efeitos={"alianca": +0.05, "abertura": +0.03},
            peso=2.5,
        ),
        Evento(
            id="opiniao_externa_desqualificou",
            relato="Comentei com um amigo e ele disse que isso é balela.",
            efeitos={"alianca": -0.09, "esperanca": -0.05},
            peso=2.0,
        ),
    ),
    "Depressivo": (
        Evento(
            id="nao_saiu_da_cama",
            relato="Teve dia que eu não levantei.",
            efeitos={"energia": -0.06, "esperanca": -0.06, "risco": +0.05},
            peso=3.5,
        ),
        Evento(
            id="pensamento_de_morte",
            relato="Pensei que seria mais fácil não estar aqui.",
            efeitos={"risco": +0.12, "esperanca": -0.05},
            peso=1.5,
            # Ideação não é amortecida por vínculo bom. Ela aparece, e ter
            # aliança alta muda o que o paciente FAZ com ela — não se ela
            # ocorre. Tratar isso como "quem tem boa aliança não pensa em
            # morrer" seria ensinar ao aluno a coisa mais perigosa possível.
            inevitavel=True,
        ),
    ),
    "Dissociado": (
        Evento(
            id="perdeu_o_fio",
            relato="Tem um pedaço da terça que eu não sei o que fiz.",
            efeitos={"risco": +0.08, "abertura": -0.04},
            peso=3.0,
            inevitavel=True,
        ),
    ),
    "Histriônico": (
        Evento(
            id="episodio_intenso",
            relato="Foi tudo muito intenso, você não imagina.",
            efeitos={"sofrimento": +0.06, "adesao": -0.06},
            peso=3.0,
        ),
    ),
    "Obsessivo": (
        Evento(
            id="travou_na_perfeicao",
            relato="Não entreguei porque ainda não estava bom o suficiente.",
            efeitos={"sofrimento": +0.07, "energia": -0.04},
            peso=3.0,
        ),
    ),
    "Evitativo": (
        Evento(
            id="cancelou_compromisso",
            relato="Desmarquei em cima da hora. De novo.",
            efeitos={"abertura": -0.06, "esperanca": -0.04},
            peso=3.0,
        ),
    ),
    "Intelectualizador": (
        Evento(
            id="leu_sobre_o_proprio_caso",
            relato="Identifiquei exatamente o mecanismo que está operando em mim.",
            # Ganha esperança e NÃO ganha abertura — o retrato do perfil.
            # Entender não é sentir, e o motor precisa dizer isso com números.
            efeitos={"esperanca": +0.05, "abertura": -0.02},
            peso=3.0,
        ),
    ),
}


def repertorio(nome_do_perfil: str) -> tuple[Evento, ...]:
    """Todos os eventos disponíveis para um perfil."""
    return EVENTOS_COMUNS + EVENTOS_POR_PERFIL.get(nome_do_perfil, ())


def amortecer(evento: Evento, estado: EstadoPaciente) -> dict[str, float]:
    """Aplica a reserva do paciente sobre um evento ruim.

    A reserva é a média de aliança e esperança: o quanto a pessoa tem a que
    se segurar quando algo dá errado. Reserva cheia corta um evento ruim
    quase pela metade; reserva vazia o deixa inteiro.

    Eventos BONS não são amortecidos — passam integralmente. A assimetria é
    deliberada: quem está bem acompanhado sofre menos com o que dá errado,
    mas não aproveita menos o que dá certo.
    """
    if evento.inevitavel:
        return dict(evento.efeitos)

    reserva = (estado.alianca + estado.esperanca) / 2.0
    # Com reserva 1,0 o fator é 0,55; com reserva 0,0 ele é 1,0.
    fator = 1.0 - 0.45 * reserva

    amortecidos = {}
    for dimensao, delta in evento.efeitos.items():
        prejudica = (delta > 0) if dimensao in {"sofrimento", "risco"} else (delta < 0)
        amortecidos[dimensao] = delta * fator if prejudica else delta

    return amortecidos

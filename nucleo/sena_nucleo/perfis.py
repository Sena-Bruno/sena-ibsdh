"""
Os oito perfis clínicos — agora com física própria.

┌───────────────────────────────────────────────────────────────────────┐
│  ESTES SÃO OS MESMOS OITO PERFIS DE `src/views/SimuladorView.vue`     │
│                                                                       │
│  `nome`, `descricao`, `resistencias` e `abordagem_ideal` foram        │
│  copiados palavra por palavra de lá. NÃO os reescreva aqui: é o texto │
│  que o aluno lê na tela, e duas versões do mesmo perfil divergindo    │
│  seria o aluno treinando contra um paciente e sendo avaliado contra   │
│  outro.                                                               │
│                                                                       │
│  O que é NOVO neste arquivo são os três últimos campos — `basal`,     │
│  `deriva` e as listas de prescrição. Eles não existem no front porque │
│  descrevem o que o paciente faz SOZINHO, entre as sessões, que é      │
│  justamente o que o simulador não tinha.                              │
└───────────────────────────────────────────────────────────────────────┘

## O que é `deriva`

Quanto cada dimensão anda por dia **na ausência de qualquer intervenção**.
É a linha de base contra a qual o trabalho do aluno é medido: sem ela, toda
melhora pareceria mérito da condução, e um Depressivo que piora sozinho na
semana seria lido como erro do aluno.

A deriva é o que torna alguns perfis urgentes. O Depressivo perde esperança
e energia todo dia que passa; o Ansioso oscila muito mas não afunda; o
Intelectualizador é quase estável — ele não piora, só não melhora, que é
exatamente a armadilha clínica dele.

## Por que `carga_tolerada`

É o teto de exigência que o paciente aguenta numa semana. Prescrever acima
dele não é neutro: **é iatrogênico**. O paciente tenta, falha, e a falha
confirma a crença que o trouxe à terapia ("não adianta nada"). Esse é o
mecanismo pedagógico central do Paciente Vivo — o aluno descobre na pele
que uma prescrição boa demais para o momento do paciente é uma prescrição
ruim.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .estado import EstadoPaciente


@dataclass(frozen=True)
class PerfilClinico:
    """Um perfil: o texto que o aluno lê mais a física que o motor usa."""

    nome: str
    descricao: str
    resistencias: tuple[str, ...]
    abordagem_ideal: str

    #: Onde este perfil normalmente começa.
    basal: EstadoPaciente

    #: Movimento diário espontâneo, como FRAÇÃO do caminho que resta
    #: naquela direção — não como quantidade absoluta. Ver
    #: `EstadoPaciente.derivar`. Ausente = estável.
    deriva: dict[str, float] = field(default_factory=dict)

    #: Teto de exigência semanal. Ver o cabeçalho do módulo.
    carga_tolerada: float = 0.6

    #: Tipos de prescrição que funcionam bem com este perfil (ver
    #: `prescricao.TipoPrescricao`). Guardados como texto para este módulo
    #: não depender daquele — quem cruza os dois é `prescricao.py`, e a
    #: dependência única nessa direção mantém os perfis legíveis por quem
    #: é clínico e não programador.
    indicadas: tuple[str, ...] = ()

    #: Prescrições que pioram este perfil, mesmo bem executadas.
    contraindicadas: tuple[str, ...] = ()


PERFIS: dict[str, PerfilClinico] = {
    "Ansioso": PerfilClinico(
        nome="Ansioso",
        descricao=(
            "Paciente agitado, fala acelerada, respiração superficial, "
            "catastrofização frequente, necessidade de controle excessivo, "
            "dificuldade de tolerância à incerteza"
        ),
        resistencias=(
            'Interrompe com "e se"',
            "Antecipa problemas",
            "Não tolera silêncio terapêutico",
        ),
        abordagem_ideal=(
            "Rapport respiratório primeiro, validação antes de intervenção, "
            "ritmo mais lento"
        ),
        # Chega sofrendo muito, mas com energia de sobra: a ansiedade é
        # cara em sofrimento e barata em disposição. É o perfil que mais
        # aguenta tarefa — e o que mais se prejudica com tarefa demais.
        basal=EstadoPaciente(
            alianca=0.45, sofrimento=0.75, abertura=0.50,
            esperanca=0.40, adesao=0.65, risco=0.20, energia=0.65,
        ),
        # Não afunda sozinho; oscila. A deriva quase nula em esperança é
        # o retrato disso: o ansioso não desiste, ele gira.
        deriva={"sofrimento": +0.035, "energia": -0.015},
        carga_tolerada=0.70,
        indicadas=("RESPIRATORIA", "ANCORAGEM", "PSICOEDUCACAO"),
        contraindicadas=("EXPOSICAO_GRADUAL",),
    ),
    "Cético": PerfilClinico(
        nome="Cético",
        descricao=(
            "Paciente desconfiado, questiona metodologia, testa credibilidade "
            "do terapeuta, linguagem racional excessiva, dificuldade de "
            "vulnerabilidade"
        ),
        resistencias=('"Isso realmente funciona?"', "Pede evidências", "Testa autoridade"),
        abordagem_ideal=(
            "Credibilização rápida, referenciação, convite à experiência "
            "direta, menos promessas"
        ),
        # Aliança baixíssima é o traço definidor. Sofre pouco — por isso
        # tem pouca razão para tolerar um processo em que não acredita.
        basal=EstadoPaciente(
            alianca=0.25, sofrimento=0.50, abertura=0.30,
            esperanca=0.30, adesao=0.40, risco=0.15, energia=0.60,
        ),
        # A aliança do cético DECAI sozinha. Não fazer nada já é perder:
        # cada dia sem prova é mais um dia de hipótese não confirmada.
        deriva={"alianca": -0.070, "esperanca": -0.040},
        carga_tolerada=0.55,
        indicadas=("PSICOEDUCACAO", "REGISTRO"),
        contraindicadas=("ANCORAGEM",),
    ),
    "Evitativo": PerfilClinico(
        nome="Evitativo",
        descricao=(
            "Paciente com respostas vagas, muda de assunto quando aprofundado, "
            "dificuldade de acesso emocional, intelectualização defensiva, "
            "evita contato visual"
        ),
        resistencias=("Respostas de uma palavra", "Muda de assunto", '"Não sei"/"Talvez"'),
        abordagem_ideal=(
            "Perguntas mais específicas, confronto gentil, foco no corporal, "
            "paciência"
        ),
        basal=EstadoPaciente(
            alianca=0.35, sofrimento=0.55, abertura=0.20,
            esperanca=0.35, adesao=0.35, risco=0.25, energia=0.45,
        ),
        # A abertura fecha sozinha. O evitativo não precisa de um motivo
        # para se afastar — o afastamento é o estado de repouso dele.
        deriva={"abertura": -0.070, "alianca": -0.035},
        carga_tolerada=0.45,
        indicadas=("REGISTRO", "ANCORAGEM"),
        contraindicadas=("EXPOSICAO_GRADUAL", "CONTENCAO"),
    ),
    "Intelectualizador": PerfilClinico(
        nome="Intelectualizador",
        descricao=(
            "Paciente que raciocina demais, distanciamento somático, analisa "
            "próprio processo, dificuldade de experiência direta, teorização "
            "excessiva"
        ),
        resistencias=(
            "Explicações longas",
            "Analisa a técnica em vez de fazê-la",
            "Distância emocional",
        ),
        abordagem_ideal=(
            "Convite à experiência direta, interromper raciocínio, foco em "
            "sensações corporais"
        ),
        basal=EstadoPaciente(
            alianca=0.50, sofrimento=0.45, abertura=0.25,
            esperanca=0.45, adesao=0.55, risco=0.10, energia=0.55,
        ),
        # Praticamente estável — e essa é a armadilha. Ele não piora, então
        # não dispara alarme; só não melhora, ano após ano.
        deriva={"abertura": -0.020},
        carga_tolerada=0.65,
        indicadas=("ANCORAGEM", "EXPOSICAO_GRADUAL"),
        contraindicadas=("PSICOEDUCACAO",),
    ),
    "Dissociado": PerfilClinico(
        nome="Dissociado",
        descricao=(
            "Paciente desconectado do presente, narrativa fragmentada, pouca "
            "presença corporal, olhar perdido, dificuldade de foco sustentado"
        ),
        resistencias=(
            "Falta de continuidade na fala",
            "Não responde diretamente",
            "Ausência de contato",
        ),
        abordagem_ideal=(
            "Ancoragem no presente, orientação espacial, ativação corporal, "
            "fragmentação da sessão"
        ),
        basal=EstadoPaciente(
            alianca=0.30, sofrimento=0.60, abertura=0.20,
            esperanca=0.30, adesao=0.25, risco=0.40, energia=0.35,
        ),
        # Tolera muito pouco: qualquer tarefa que exija continuidade falha,
        # porque continuidade é exatamente o que falta.
        deriva={"risco": +0.050, "abertura": -0.050},
        carga_tolerada=0.30,
        indicadas=("ANCORAGEM", "CONTENCAO"),
        contraindicadas=("EXPOSICAO_GRADUAL", "REGISTRO"),
    ),
    "Depressivo": PerfilClinico(
        nome="Depressivo",
        descricao=(
            "Paciente com energia baixa, fala lenta, pessimismo, retraimento, "
            "dificuldade de engajamento, possível ideação suicida (avaliação "
            "de risco)"
        ),
        resistencias=('"Não adianta nada"', "Falta de motivação", "Desistência rápida"),
        abordagem_ideal=(
            "Ativação gradual, pequenos passos, validação do sofrimento, "
            "estruturação, avaliação de segurança"
        ),
        basal=EstadoPaciente(
            alianca=0.35, sofrimento=0.70, abertura=0.30,
            esperanca=0.25, adesao=0.30, risco=0.45, energia=0.20,
        ),
        # O único perfil que afunda em três dimensões ao mesmo tempo. É o
        # que torna a semana entre sessões clinicamente urgente: sete dias
        # sem nada é uma queda mensurável, não uma pausa.
        deriva={"esperanca": -0.100, "energia": -0.080, "risco": +0.060},
        # O teto mais baixo da tabela. Prescrever "corra 30 minutos por dia"
        # a quem tem energia 0,20 é a iatrogenia de manual: ele não corre,
        # e agora tem prova de que é incapaz.
        carga_tolerada=0.25,
        indicadas=("ATIVACAO_COMPORTAMENTAL", "CONTENCAO", "REGISTRO"),
        contraindicadas=("EXPOSICAO_GRADUAL",),
    ),
    "Histriônico": PerfilClinico(
        nome="Histriônico",
        descricao=(
            "Paciente dramático, emoções intensas e rápidas, busca atenção, "
            "linguagem colorida, sedução, dificuldade de foco"
        ),
        resistencias=("Dramatização", "Fuga em emoções", "Não completa tarefas"),
        abordagem_ideal=(
            "Contenção, estrutura firme, direcionamento, foco em resultados "
            "concretos"
        ),
        basal=EstadoPaciente(
            alianca=0.60, sofrimento=0.60, abertura=0.70,
            esperanca=0.50, adesao=0.25, risco=0.30, energia=0.70,
        ),
        # Aliança alta e adesão baixa: o perfil que adora a sessão e não
        # faz nada entre elas. A adesão cai sozinha — o entusiasmo da
        # sexta-feira não sobrevive ao domingo.
        deriva={"adesao": -0.070, "sofrimento": +0.030},
        carga_tolerada=0.40,
        indicadas=("CONTENCAO", "REGISTRO"),
        contraindicadas=("PSICOEDUCACAO",),
    ),
    "Obsessivo": PerfilClinico(
        nome="Obsessivo",
        descricao=(
            "Paciente rígido, detalhista, perfeccionista, dificuldade de "
            "delegar, controle excessivo, ansiedade com imperfeição"
        ),
        resistencias=(
            "Detalhes excessivos",
            'Não aceita "bom o suficiente"',
            "Procrastinação por perfeição",
        ),
        abordagem_ideal=(
            "Estrutura clara, flexibilidade modelada, foco no processo não "
            "no resultado"
        ),
        basal=EstadoPaciente(
            alianca=0.50, sofrimento=0.55, abertura=0.30,
            esperanca=0.40, adesao=0.75, risco=0.15, energia=0.55,
        ),
        # Adesão altíssima — ele CUMPRE. O risco aqui é o oposto do
        # histriônico: ele cumpre até a prescrição errada, com rigor, e
        # transforma a tarefa em mais um ritual de controle.
        deriva={"sofrimento": +0.025},
        carga_tolerada=0.75,
        indicadas=("EXPOSICAO_GRADUAL", "ANCORAGEM"),
        contraindicadas=("REGISTRO",),
    ),
}


def obter(nome: str) -> PerfilClinico:
    """Busca um perfil pelo nome, com erro legível quando não existe.

    O `KeyError` cru diria apenas `'Ansiozo'`, sem dizer quais existem —
    e os nomes vêm de planilha, onde o acento some com frequência.
    """
    try:
        return PERFIS[nome]
    except KeyError:
        raise KeyError(
            f"perfil clínico desconhecido: {nome!r}. "
            f"Conhecidos: {', '.join(sorted(PERFIS))}"
        ) from None

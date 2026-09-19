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
│  O que é NOVO aqui são `basal`, `equilibrio`, `taxa_de_retorno`,      │
│  `carga_tolerada` e as listas de prescrição. Não existem no front     │
│  porque descrevem o que o paciente faz SOZINHO, entre as sessões —    │
│  justamente o que o simulador não tinha.                              │
└───────────────────────────────────────────────────────────────────────┘

## O que são `equilibrio` e `taxa_de_retorno`

Onde o paciente se assenta **sem nenhuma intervenção**, e com que rapidez
ele chega lá. Todo dia o estado anda uma fração do caminho até esse ponto.

Por que não uma queda constante, que era o modelo anterior: a literatura de
grupos de lista de espera — a medição empírica de "sem tratamento" — mostra
melhora leve, não colapso (g = 0,37 pré-pós em depressão; sintomas caem
10–15%; 12,5% remitem sozinhos em 12 semanas; quem piora de verdade é
12–13%, não 90%). Quem procura ajuda procura no pior momento, e o pior
momento é atípico: o que se segue é retorno ao nível habitual.

**O equilíbrio não é saúde.** O Depressivo regride para um estado ainda
deprimido — só não em queda livre. A diferença entre `basal` (a crise que
trouxe a pessoa) e `equilibrio` (o fundo habitual dela) é o que o tempo
resolve sozinho; tudo abaixo do equilíbrio é o que só o tratamento alcança.

**Três perfis pioram em uma dimensão específica**, e é aí que mora o "não
fazer nada custa": a aliança do Cético decai sem prova, a abertura do
Evitativo fecha sozinha, a adesão do Histriônico não sobrevive à semana.
São decaimentos pontuais e nomeados — não um desabamento geral.

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

    #: Onde este perfil chega à primeira sessão — a crise, não o hábito.
    basal: EstadoPaciente

    #: Onde ele se assenta sem nenhuma intervenção. NÃO é saúde: é o fundo
    #: habitual desta pessoa, do qual só o tratamento tira.
    equilibrio: EstadoPaciente

    #: Fração do caminho até o equilíbrio percorrida por dia.
    #:
    #: 0,006 fecha ~4% da distância por semana. Ao longo de dez a doze
    #: semanas isso soma a redução de 10–15% dos sintomas que a literatura
    #: mede em lista de espera.
    #:
    #: A primeira tentativa usou 0,012 e produzia 33% em dez semanas — o
    #: tempo curando mais do que a terapia, que é a pior coisa que um
    #: simulador de formação clínica poderia ensinar.
    taxa_de_retorno: float = 0.006

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
        # O pico de ansiedade cede sozinho — é o que faz tanta gente
        # desmarcar a segunda sessão dizendo "melhorei". O fundo habitual
        # ainda é ansioso; só não é a crise que trouxe.
        equilibrio=EstadoPaciente(
            alianca=0.45, sofrimento=0.58, abertura=0.52,
            esperanca=0.47, adesao=0.60, risco=0.15, energia=0.68,
        ),
        taxa_de_retorno=0.007,
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
        # O único perfil cujo EQUILÍBRIO tem aliança ABAIXO da chegada:
        # cada dia sem prova é mais um dia de hipótese não confirmada, e o
        # repouso dele é a desconfiança. Sofrimento cede como em todos.
        equilibrio=EstadoPaciente(
            alianca=0.15, sofrimento=0.44, abertura=0.30,
            esperanca=0.28, adesao=0.38, risco=0.12, energia=0.62,
        ),
        taxa_de_retorno=0.009,
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
        # A abertura fecha sozinha: o evitativo não precisa de motivo para
        # se afastar, o afastamento É o repouso dele. É a esquiva como fator
        # de manutenção — o alívio de hoje compra o fechamento de amanhã.
        equilibrio=EstadoPaciente(
            alianca=0.28, sofrimento=0.49, abertura=0.16,
            esperanca=0.36, adesao=0.33, risco=0.22, energia=0.47,
        ),
        taxa_de_retorno=0.0075,
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
        # O equilíbrio mais próximo da chegada de toda a tabela — e essa é
        # a armadilha. Ele não piora, então não dispara alarme; só não
        # melhora, ano após ano. A taxa mais lenta é parte do retrato.
        equilibrio=EstadoPaciente(
            alianca=0.48, sofrimento=0.42, abertura=0.23,
            esperanca=0.45, adesao=0.53, risco=0.09, energia=0.56,
        ),
        taxa_de_retorno=0.005,
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
        # O risco cede devagar e não some: dissociação não escala sozinha
        # como eu havia modelado, mas também não se resolve. A abertura
        # fecha um pouco, como no Evitativo.
        equilibrio=EstadoPaciente(
            alianca=0.30, sofrimento=0.52, abertura=0.18,
            esperanca=0.33, adesao=0.25, risco=0.34, energia=0.38,
        ),
        taxa_de_retorno=0.006,
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
        # O equilíbrio continua deprimido — esperança 0,33, energia 0,28,
        # risco 0,36 — mas NÃO é queda livre. A versão anterior deste perfil
        # perdia 0,15 de esperança e ganhava 0,22 de risco por semana, o que
        # contraria frontalmente a literatura de lista de espera.
        #
        # O que o tempo resolve é a distância daqui até a crise da chegada.
        # Tudo abaixo deste ponto é o que só o tratamento alcança — e é por
        # isso que o Depressivo continua sendo o perfil que mais precisa de
        # intervenção, mesmo sem despencar.
        equilibrio=EstadoPaciente(
            alianca=0.35, sofrimento=0.58, abertura=0.33,
            esperanca=0.33, adesao=0.33, risco=0.36, energia=0.28,
        ),
        taxa_de_retorno=0.006,
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
        # Adesão em queda no equilíbrio: o perfil que adora a sessão e não
        # faz nada entre elas — o entusiasmo da sexta não sobrevive ao
        # domingo. O sofrimento cede como nos outros; a intensidade dele é
        # alta e volátil, não progressiva.
        equilibrio=EstadoPaciente(
            alianca=0.58, sofrimento=0.50, abertura=0.68,
            esperanca=0.50, adesao=0.20, risco=0.26, energia=0.68,
        ),
        taxa_de_retorno=0.008,
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
        # transforma a tarefa em mais um ritual de controle. O equilíbrio
        # mexe pouco porque a rigidez é justamente o que não cede com o
        # tempo.
        equilibrio=EstadoPaciente(
            alianca=0.50, sofrimento=0.50, abertura=0.29,
            esperanca=0.41, adesao=0.72, risco=0.13, energia=0.55,
        ),
        taxa_de_retorno=0.006,
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

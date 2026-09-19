"""
A prescrição: a aposta que o aluno faz sobre a semana do paciente.

┌───────────────────────────────────────────────────────────────────────┐
│  A LIÇÃO QUE ESTE MÓDULO EXISTE PARA ENSINAR                          │
│                                                                       │
│  Uma prescrição tecnicamente correta pode ser clinicamente errada.    │
│  O que decide não é a técnica — é o encontro entre a técnica, o       │
│  perfil e o momento do paciente.                                      │
│                                                                       │
│  Três formas de errar, todas modeladas aqui:                          │
│                                                                       │
│  1. CARGA ACIMA DA ENERGIA. Prescrever caminhada diária a quem tem    │
│     energia 0,20. Ele tenta, falha, e a falha vira prova de           │
│     incapacidade. O paciente volta PIOR do que se nada tivesse sido   │
│     prescrito — e o aluno, que fez tudo "certo", não entende.         │
│                                                                       │
│  2. TIPO CONTRAINDICADO. Ancoragem num Cético antes de haver          │
│     credibilidade: ele faz o exercício achando bobagem, e o que ele   │
│     aprende é que o processo é bobagem.                               │
│                                                                       │
│  3. VAGUEZA. "Tente relaxar mais essa semana" não é prescrição. Não   │
│     dá para cumprir, então não é cumprida — e a não-adesão será lida  │
│     pelo aluno como resistência do paciente, quando foi imprecisão    │
│     dele.                                                             │
│                                                                       │
│  Nenhuma das três aparece na sessão. Todas aparecem na semana. É por  │
│  isso que o Paciente Vivo ensina o que a sessão isolada não ensina.   │
└───────────────────────────────────────────────────────────────────────┘
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from .estado import EstadoPaciente
from .perfis import PerfilClinico


class TipoPrescricao(Enum):
    """As famílias de tarefa entre sessões que o SENA reconhece.

    A lista é curta de propósito. Ela não pretende cobrir toda a clínica —
    pretende cobrir o que um aluno de formação consegue prescrever com
    responsabilidade, e o que o motor consegue simular com honestidade.
    Aumentar esta lista sem aumentar a tabela de efeitos produziria
    prescrições que o paciente aceita e que não mudam nada, o que é pior
    que não ter a opção.
    """

    NENHUMA = "nenhuma"
    RESPIRATORIA = "respiratoria"
    REGISTRO = "registro"
    ATIVACAO_COMPORTAMENTAL = "ativacao_comportamental"
    ANCORAGEM = "ancoragem"
    EXPOSICAO_GRADUAL = "exposicao_gradual"
    PSICOEDUCACAO = "psicoeducacao"
    CONTENCAO = "contencao"


#: O que cada tipo move no paciente QUANDO É CUMPRIDO, por dia de adesão.
#:
#: Os valores são pequenos porque são diários: sete dias de adesão a uma
#: respiratória somam ~0,10 de sofrimento a menos, que é uma semana boa e
#: não um milagre. Prescrição não cura em sete dias, e um motor que
#: sugerisse isso ensinaria o aluno a esperar a coisa errada.
EFEITOS_DIARIOS: dict[TipoPrescricao, dict[str, float]] = {
    TipoPrescricao.NENHUMA: {},
    TipoPrescricao.RESPIRATORIA: {"sofrimento": -0.015, "energia": +0.004},
    TipoPrescricao.REGISTRO: {"abertura": +0.012, "sofrimento": -0.004},
    TipoPrescricao.ATIVACAO_COMPORTAMENTAL: {"energia": +0.014, "esperanca": +0.010},
    TipoPrescricao.ANCORAGEM: {"sofrimento": -0.010, "abertura": +0.008},
    TipoPrescricao.EXPOSICAO_GRADUAL: {"esperanca": +0.016, "sofrimento": -0.006},
    TipoPrescricao.PSICOEDUCACAO: {"alianca": +0.010, "esperanca": +0.008},
    TipoPrescricao.CONTENCAO: {"risco": -0.016, "sofrimento": -0.006},
}

#: O que acontece quando o paciente TENTA E FALHA — por dia de falha,
#: ANTES de ser escalado pela carga (ver `peso_da_falha`).
#:
#: Note que não é o simétrico de `EFEITOS_DIARIOS`. Falhar não é "não
#: ganhar": é perder esperança e aliança, porque a falha tem um autor na
#: cabeça do paciente, e o autor é ele. Essa assimetria é a razão de o
#: excesso de prescrição ser pior do que a ausência dela.
EFEITO_DA_FALHA: dict[str, float] = {
    "esperanca": -0.012,
    "adesao": -0.010,
    "alianca": -0.004,
}


def peso_da_falha(carga: float) -> float:
    """O quanto uma falha fere, proporcional ao tamanho do que foi pedido.

    Não cumprir "abrir a janela ao acordar" e não cumprir "correr trinta
    minutos" são a mesma linha no diário e ferimentos completamente
    diferentes. O primeiro é um dia ruim; o segundo é uma prova de
    incapacidade, porque o paciente sabe o tamanho do que não conseguiu.

    Sem esta escala, o motor punia igual e produzia um resultado
    clinicamente falso: uma tarefa mínima cumprida em 3 dos 7 dias saía
    PIOR do que não prescrever nada — o que aconselharia o aluno a nunca
    prescrever, o oposto da titulação que o Paciente Vivo existe para
    ensinar.

    O piso é baixo (0,15) de propósito, e é o que faz o modelo expressar
    a doutrina da ativação comportamental em vez de contrariá-la: encolher
    o pedido até que falhar quase não machuque é justamente COMO a técnica
    funciona. Com piso alto, nenhuma tarefa é leve o bastante para valer a
    aposta, e prescrever a um paciente com adesão baixa saía sempre neutro
    ou negativo — o motor aconselharia não prescrever, que é o oposto da
    primeira linha de tratamento em depressão.

    Baixo, porém, não é zero: combinar e não fazer nunca é de graça.
    """
    return 0.15 + 0.85 * carga

#: Custo de energia por dia de uma prescrição cumprida, proporcional à carga.
#:
#: Fazer a tarefa consome quem a faz. Sem este custo, prescrever ativação
#: comportamental num depressivo seria gratuito e sempre bom — e o aluno
#: aprenderia a receita errada: "prescreva o máximo".
CUSTO_ENERGETICO = 0.010

#: Adesão ganha por dia cumprido, antes do ajuste ao perfil.
#:
#: Menor que o `-0.010` da falha de propósito: confiança em si custa mais
#: para construir do que para perder. Um paciente precisa de mais dias bons
#: para recuperar o que uma semana ruim tirou — e é isso que torna a
#: primeira prescrição de um tratamento a mais importante de todas.
GANHO_DE_ADESAO = 0.008


@dataclass(frozen=True)
class Prescricao:
    """O que o aluno combinou com o paciente para a semana.

    Os três números são independentes de propósito: dá para prescrever uma
    respiratória muito específica e leve (`especificidade` alta, `carga`
    baixa) ou uma exposição vaga e pesadíssima. Justamente as combinações
    é que separam o aluno que sabe a técnica do que sabe dosá-la.
    """

    tipo: TipoPrescricao = TipoPrescricao.NENHUMA

    #: O quanto a prescrição é executável sem interpretação.
    #: 0,0 = "tente ficar melhor"; 1,0 = "às 7h, sentado, 4-7-8, seis ciclos".
    especificidade: float = 0.5

    #: O quanto ela exige do paciente. Comparada com `energia` e com
    #: `carga_tolerada` do perfil.
    carga: float = 0.5

    #: Se veio acompanhada de plano de segurança (o que fazer se piorar,
    #: a quem recorrer). Só importa de verdade quando o risco está alto —
    #: mas aí importa mais que todo o resto.
    plano_de_seguranca: bool = False

    def __post_init__(self) -> None:
        for campo in ("especificidade", "carga"):
            valor = getattr(self, campo)
            if not 0.0 <= valor <= 1.0:
                raise ValueError(f"{campo} deve estar em [0, 1], recebido {valor!r}")


def ajuste_ao_perfil(prescricao: Prescricao, perfil: PerfilClinico) -> float:
    """O quanto esta prescrição combina com este perfil, em [-1, 1].

    Positivo multiplica o efeito; negativo o inverte parcialmente, porque
    uma prescrição contraindicada não é só ineficaz — ela gasta a aliança
    que a sessão construiu.
    """
    if prescricao.tipo is TipoPrescricao.NENHUMA:
        return 0.0

    nome = prescricao.tipo.name
    if nome in perfil.indicadas:
        return 1.0
    if nome in perfil.contraindicadas:
        return -1.0
    # Nem indicada nem contraindicada: funciona, com menos força. O
    # intermediário existe para o motor não ser um interruptor — a maior
    # parte da clínica real vive nessa faixa morna.
    return 0.35


def excesso_de_carga(
    prescricao: Prescricao, perfil: PerfilClinico, estado: EstadoPaciente
) -> float:
    """O quanto a prescrição passa do que o paciente aguenta, em [0, 1].

    Compara contra DOIS tetos e usa o mais apertado: o teto estrutural do
    perfil (`carga_tolerada`, que não muda) e a energia de hoje (que muda
    toda semana). Um obsessivo tem teto alto, mas se chegar exausto na
    sessão o teto que vale é a exaustão.
    """
    if prescricao.tipo is TipoPrescricao.NENHUMA:
        return 0.0

    teto = min(perfil.carga_tolerada, estado.energia)
    return max(0.0, prescricao.carga - teto)


def probabilidade_de_adesao(
    prescricao: Prescricao, perfil: PerfilClinico, estado: EstadoPaciente
) -> float:
    """Chance de o paciente cumprir a tarefa NUM DIA, em [0, 1].

        adesão do paciente  ×  aliança  ×  clareza  ×  indicação  ×  viabilidade

    A `adesao` do estado é a BASE; os outros quatro são multiplicadores que
    orbitam 1,0 — abaixo quando a condução atrapalha, ACIMA quando ela
    ajuda. Essa é a diferença entre este modelo e a primeira versão dele,
    em que os quatro fatores eram todos menores que 1 e se empilhavam para
    baixo: um Depressivo com aliança mediana chegava a 15% ao dia mesmo
    recebendo a tarefa mais leve e mais clara possível, ou seja, falhava
    quase sempre. Como falhar custa esperança, o motor concluía que
    prescrever é sempre pior do que não prescrever — e teria ensinado ao
    aluno a não prescrever a pacientes deprimidos, o contrário da ativação
    comportamental, que é primeira linha em depressão.

    Uma boa condução precisa poder EMPURRAR a adesão para cima do basal.
    Se o melhor que o aluno consegue é não piorar, não há o que treinar.

    O multiplicativo é mantido porque a lógica de "qualquer elo fraco
    derruba o conjunto" continua certa: uma prescrição perfeita dada a quem
    não confia no terapeuta não acontece. O que mudou foi o ponto neutro.
    """
    if prescricao.tipo is TipoPrescricao.NENHUMA:
        return 0.0

    # Neutro em aliança 0,5. Vínculo forte faz a pessoa cumprir o que
    # combinou mesmo em semana ruim; vínculo ausente não zera, porque
    # disciplina e desespero também movem gente.
    fator_alianca = 0.5 + 1.0 * estado.alianca

    # Neutro em especificidade ~0,7. Vagueza não impede totalmente — o
    # paciente inventa a própria versão da tarefa — mas uma prescrição com
    # hora, lugar e número marcados cumpre acima do basal.
    fator_clareza = 0.5 + 0.7 * prescricao.especificidade

    # Tarefa que combina com o perfil é cumprida com menos atrito; a
    # contraindicada é abandonada mesmo quando o paciente quer colaborar.
    fator_indicacao = 1.0 + 0.15 * ajuste_ao_perfil(prescricao, perfil)

    # Sobrecarga derruba a viabilidade rápido. O fator 1,5 faz com que um
    # excesso de 0,35 já reduza a chance a quase zero — que é o que
    # acontece de verdade com quem recebe uma tarefa grande demais.
    fator_viabilidade = max(0.0, 1.0 - 1.5 * excesso_de_carga(prescricao, perfil, estado))

    return max(
        0.0,
        min(
            1.0,
            estado.adesao
            * fator_alianca
            * fator_clareza
            * fator_indicacao
            * fator_viabilidade,
        ),
    )


def efeito_de_um_dia(
    prescricao: Prescricao, perfil: PerfilClinico, cumpriu: bool
) -> dict[str, float]:
    """As variações que um único dia da semana produz.

    Separado do motor da semana para poder ser testado sozinho e para o
    replay contrafactual conseguir recalcular um dia isolado sem repetir a
    semana inteira.
    """
    if prescricao.tipo is TipoPrescricao.NENHUMA:
        return {}

    if not cumpriu:
        peso = peso_da_falha(prescricao.carga)
        return {dimensao: delta * peso for dimensao, delta in EFEITO_DA_FALHA.items()}

    ajuste = ajuste_ao_perfil(prescricao, perfil)
    efeitos = {
        dimensao: delta * ajuste
        for dimensao, delta in EFEITOS_DIARIOS[prescricao.tipo].items()
    }

    # Cumprir custa energia mesmo quando faz bem. Some ao que já houver na
    # dimensão em vez de sobrescrever: a ativação comportamental devolve
    # energia e gasta energia ao mesmo tempo, e o saldo é o que importa.
    efeitos["energia"] = efeitos.get("energia", 0.0) - CUSTO_ENERGETICO * prescricao.carga

    # A espiral positiva. Cumprir hoje torna cumprir amanhã mais provável —
    # que é o mecanismo pelo qual a ativação comportamental funciona de
    # verdade: não pela tarefa em si, mas pela sequência que ela inicia.
    #
    # Sem esta linha só existia a espiral NEGATIVA (`EFEITO_DA_FALHA` mexe
    # em `adesao`, o sucesso não mexia), então a adesão de qualquer
    # paciente só sabia cair, por melhor que fosse a condução. O motor
    # documentava as duas espirais e implementava uma.
    efeitos["adesao"] = efeitos.get("adesao", 0.0) + GANHO_DE_ADESAO * ajuste

    return efeitos

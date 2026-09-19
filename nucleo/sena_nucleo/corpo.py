"""
O corpo do paciente — o estado interno traduzido em sinais observáveis.

┌───────────────────────────────────────────────────────────────────────┐
│  POR QUE ISTO É O CORAÇÃO DE UM SIMULADOR DE HIPNOTERAPIA             │
│                                                                       │
│  Calibração é a habilidade central da PNL e da hipnose ericksoniana:  │
│  ler o corpo antes de acreditar na palavra. Um simulador 100% texto   │
│  treina exatamente a parte que o bom clínico aprende a desconfiar.    │
│                                                                       │
│  Aqui o estado interno vira ritmo respiratório, latência, contato     │
│  visual e micro-tensão. A regra de ouro deste módulo:                 │
│                                                                       │
│      OS SINAIS SÃO EXIBIDOS. A LEITURA DELES NUNCA É.                 │
│                                                                       │
│  `descrever()` devolve o que uma câmera veria — "a respiração         │
│  encurtou, o olhar foi para a janela" — e JAMAIS a conclusão ("ele    │
│  está resistindo"). No instante em que o simulador entrega a leitura  │
│  pronta, ele deixa de treinar calibração e passa a treinar leitura de │
│  legenda.                                                             │
│                                                                       │
│  `sinais_de_alerta()` existe para o supervisor e para a devolutiva    │
│  DEPOIS da sessão — nunca durante.                                    │
└───────────────────────────────────────────────────────────────────────┘
"""

from __future__ import annotations

from dataclasses import dataclass

from .estado import EstadoPaciente
from .perfis import PerfilClinico


@dataclass(frozen=True)
class SinaisCorporais:
    """O que o aluno poderia ver e ouvir, se estivesse olhando."""

    #: Respirações por minuto. Repouso adulto: 12–20.
    respiracao_por_minuto: float

    #: Irregularidade do ritmo respiratório, em [0, 1].
    variabilidade_respiratoria: float

    #: Segundos entre a pergunta e o início da resposta.
    latencia_de_resposta: float

    #: Palavras por minuto. Conversa brasileira típica: ~150.
    velocidade_da_fala: float

    #: Fração do tempo em contato visual, em [0, 1].
    contato_visual: float

    #: Tensão em mandíbula, ombros e mãos, em [0, 1].
    micro_tensao: float

    #: O quanto o paciente está ali, em [0, 1]. Marcador dissociativo.
    presenca: float

    def como_dicionario(self) -> dict[str, float]:
        return {
            "respiracao_por_minuto": round(self.respiracao_por_minuto, 1),
            "variabilidade_respiratoria": round(self.variabilidade_respiratoria, 3),
            "latencia_de_resposta": round(self.latencia_de_resposta, 2),
            "velocidade_da_fala": round(self.velocidade_da_fala, 1),
            "contato_visual": round(self.contato_visual, 3),
            "micro_tensao": round(self.micro_tensao, 3),
            "presenca": round(self.presenca, 3),
        }


#: Ajustes fixos por perfil, somados ao que o estado já determina.
#:
#: Existem porque dois pacientes com sofrimento 0,7 não têm o mesmo corpo:
#: o Ansioso acelera, o Depressivo desacelera. Sem esta tabela o corpo
#: seria função apenas do sofrimento, e todos os perfis pareceriam o mesmo
#: paciente com o volume mudado.
AJUSTES_POR_PERFIL: dict[str, dict[str, float]] = {
    "Ansioso": {
        "respiracao_por_minuto": +5.0,
        "velocidade_da_fala": +35.0,
        "latencia_de_resposta": -0.5,
        "micro_tensao": +0.15,
    },
    "Depressivo": {
        "respiracao_por_minuto": -2.0,
        "velocidade_da_fala": -40.0,
        "latencia_de_resposta": +1.8,
        "contato_visual": -0.15,
    },
    "Dissociado": {
        "latencia_de_resposta": +2.2,
        "presenca": -0.35,
        "contato_visual": -0.25,
        "variabilidade_respiratoria": +0.20,
    },
    "Evitativo": {"contato_visual": -0.30, "velocidade_da_fala": -10.0},
    "Histriônico": {
        "velocidade_da_fala": +25.0,
        "contato_visual": +0.20,
        "variabilidade_respiratoria": +0.15,
    },
    "Obsessivo": {"micro_tensao": +0.20, "latencia_de_resposta": +0.4},
    "Intelectualizador": {"velocidade_da_fala": +15.0, "presenca": -0.10},
    "Cético": {"micro_tensao": +0.10, "contato_visual": +0.10},
}


def ler_corpo(estado: EstadoPaciente, perfil: PerfilClinico) -> SinaisCorporais:
    """Traduz o estado interno em sinais observáveis.

    Determinístico: o mesmo estado produz sempre o mesmo corpo. O ruído
    de observação, quando fizer falta, pertence à camada de apresentação —
    aqui ele só atrapalharia o teste e o replay.
    """
    ajuste = AJUSTES_POR_PERFIL.get(perfil.nome, {})

    def com_ajuste(nome: str, base: float) -> float:
        return base + ajuste.get(nome, 0.0)

    # 14 rpm em repouso, subindo até ~24 com sofrimento máximo.
    respiracao = com_ajuste("respiracao_por_minuto", 14.0 + 10.0 * estado.sofrimento)

    # Irregularidade acompanha o sofrimento e piora quando falta presença.
    variabilidade = com_ajuste(
        "variabilidade_respiratoria",
        0.15 + 0.45 * estado.sofrimento + 0.20 * (1.0 - estado.energia),
    )

    # Quem tem pouca energia demora a responder; quem tem aliança responde
    # mais rápido, porque não precisa medir a resposta antes de dá-la.
    latencia = com_ajuste(
        "latencia_de_resposta",
        0.6 + 2.2 * (1.0 - estado.energia) - 0.5 * estado.alianca,
    )

    velocidade = com_ajuste(
        "velocidade_da_fala", 150.0 - 60.0 * (1.0 - estado.energia)
    )

    # Contato visual é sustentado por abertura e por vínculo, nessa ordem.
    contato = com_ajuste(
        "contato_visual", 0.15 + 0.55 * estado.abertura + 0.30 * estado.alianca
    )

    # Tensão sobe com sofrimento e cede com vínculo.
    tensao = com_ajuste(
        "micro_tensao", 0.10 + 0.70 * estado.sofrimento - 0.25 * estado.alianca
    )

    # Presença cai com risco alto: o paciente vai embora de dentro antes de
    # ir embora da sala. É o sinal mais importante da tabela e o mais fácil
    # de não ver.
    presenca = com_ajuste(
        "presenca", 0.30 + 0.45 * estado.energia + 0.25 * estado.abertura - 0.30 * estado.risco
    )

    prender = lambda v: max(0.0, min(1.0, v))  # noqa: E731

    return SinaisCorporais(
        respiracao_por_minuto=max(6.0, respiracao),
        variabilidade_respiratoria=prender(variabilidade),
        latencia_de_resposta=max(0.1, latencia),
        velocidade_da_fala=max(40.0, velocidade),
        contato_visual=prender(contato),
        micro_tensao=prender(tensao),
        presenca=prender(presenca),
    )


def descrever(sinais: SinaisCorporais) -> tuple[str, ...]:
    """O que a câmera veria, em português, SEM interpretação.

    Cada frase descreve um fenômeno observável. Nenhuma diz o que ele
    significa — essa é a parte que o aluno tem que fazer, e entregá-la
    pronta destruiria o exercício. Ver o cabeçalho do módulo.
    """
    frases: list[str] = []

    if sinais.respiracao_por_minuto >= 22:
        frases.append("A respiração é curta e alta, no topo do peito.")
    elif sinais.respiracao_por_minuto <= 11:
        frases.append("A respiração é longa e espaçada.")

    if sinais.latencia_de_resposta >= 2.5:
        frases.append("Há uma pausa longa antes de cada resposta.")
    elif sinais.latencia_de_resposta <= 0.4:
        frases.append("A resposta vem antes de a pergunta terminar.")

    if sinais.contato_visual <= 0.25:
        frases.append("O olhar fica na janela, ou no chão, quase o tempo todo.")
    elif sinais.contato_visual >= 0.80:
        frases.append("O olhar é fixo e não desvia.")

    if sinais.micro_tensao >= 0.60:
        frases.append("A mandíbula está travada; as mãos não param.")

    if sinais.velocidade_da_fala >= 185:
        frases.append("A fala é rápida e emenda uma frase na outra.")
    elif sinais.velocidade_da_fala <= 100:
        frases.append("A fala é lenta, com as palavras espaçadas.")

    if sinais.presenca <= 0.35:
        frases.append("O corpo está na cadeira, mas parece longe.")

    if sinais.variabilidade_respiratoria >= 0.65:
        frases.append("O ritmo da respiração se quebra no meio das frases.")

    if not frases:
        frases.append("Nada no corpo chama atenção.")

    return tuple(frases)


def sinais_de_alerta(
    sinais: SinaisCorporais, estado: EstadoPaciente
) -> tuple[str, ...]:
    """O que um supervisor teria apontado. NUNCA exibir durante a sessão.

    Serve à devolutiva e à autópsia do caso. Se aparecer na tela enquanto o
    aluno conduz, ele para de calibrar e passa a esperar o aviso — que é
    precisamente o profissional que o instituto não quer formar.
    """
    alertas: list[str] = []

    if estado.risco >= 0.55:
        alertas.append(
            "Risco elevado: havia indicação de avaliação de segurança explícita."
        )
    if sinais.presenca <= 0.35:
        alertas.append(
            "Presença baixa: o paciente dissociou durante o atendimento; "
            "ancoragem no presente estava indicada antes de qualquer conteúdo."
        )
    if estado.alianca <= 0.25:
        alertas.append(
            "Aliança no chão: qualquer técnica aplicada aqui seria aplicada no vazio."
        )
    if sinais.respiracao_por_minuto >= 24 and estado.abertura <= 0.35:
        alertas.append(
            "Ativação alta com abertura baixa: o corpo pede regulação antes de conteúdo."
        )

    return tuple(alertas)

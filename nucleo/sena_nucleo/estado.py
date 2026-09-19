"""
O estado interno do paciente — as sete dimensões que o SENA passa a simular.

┌───────────────────────────────────────────────────────────────────────┐
│  POR QUE ISTO EXISTE                                                  │
│                                                                       │
│  Hoje o paciente virtual é uma conversa sem memória: cada sessão      │
│  começa do zero, e o que o aluno prescreveu na sessão anterior não    │
│  tem consequência nenhuma. O aluno aprende a CONDUZIR uma conversa,   │
│  mas nunca aprende que uma prescrição é uma aposta que dá certo ou    │
│  errado na vida de alguém durante a semana seguinte.                  │
│                                                                       │
│  Para haver consequência é preciso haver estado. Este módulo é o      │
│  estado: um vetor de sete números que descreve o paciente por dentro. │
│  A conversa passa a ser a leitura desse vetor; a semana entre sessões │
│  passa a ser a evolução dele.                                         │
└───────────────────────────────────────────────────────────────────────┘

As dimensões são contínuas em [0, 1] de propósito. Clínica não tem
degrau — um paciente não "vira" resistente entre terça e quarta; ele fica
6% menos aberto, e três semanas disso viram uma aliança rompida. Faixas
discretas ("alto/médio/baixo") esconderiam exatamente a parte que o aluno
precisa aprender a perceber cedo.

Sobre a direção de cada dimensão: cinco delas são melhores quando altas
(`alianca`, `abertura`, `esperanca`, `adesao`, `energia`) e duas são
melhores quando baixas (`sofrimento`, `risco`). Isso está declarado em
`DIMENSOES_INVERTIDAS` porque a camada de narrativa e a de avaliação
precisam saber o sinal para dizer se a semana foi boa — e deduzir isso
pelo nome da variável seria o tipo de suposição que quebra em silêncio.
"""

from __future__ import annotations

from dataclasses import dataclass, fields, replace

#: As sete dimensões, na ordem canônica usada em relatórios e gráficos.
DIMENSOES = (
    "alianca",
    "sofrimento",
    "abertura",
    "esperanca",
    "adesao",
    "risco",
    "energia",
)

#: Dimensões em que um valor ALTO é um resultado RUIM.
DIMENSOES_INVERTIDAS = frozenset({"sofrimento", "risco"})

#: Abaixo disto, uma variação não é relatada como mudança.
#:
#: Existe porque o motor produz números de ponto flutuante com muitas casas,
#: e um briefing que diz "sua aliança subiu 0,3%" ensina o aluno a olhar
#: ruído. O valor é uma escolha clínica, não técnica: 2 pontos percentuais
#: é aproximadamente o menor movimento que um supervisor humano comentaria
#: numa sessão.
LIMIAR_RELEVANCIA = 0.02


def limitar(valor: float) -> float:
    """Prende um valor à faixa [0, 1].

    Toda a aritmética do motor passa por aqui. Sem isso, uma semana muito
    ruim empurraria `esperanca` para -0,3 e a semana seguinte precisaria
    "subir" 0,3 só para voltar ao chão — o paciente ficaria preso num poço
    invisível que nenhuma condução consegue tirar, o que não é clínica: é
    bug de acumulador.
    """
    if valor < 0.0:
        return 0.0
    if valor > 1.0:
        return 1.0
    return float(valor)


@dataclass(frozen=True)
class EstadoPaciente:
    """As sete dimensões internas, todas em [0, 1].

    Imutável de propósito. O motor da semana gera SETE estados (um por dia)
    e o replay contrafactual precisa voltar ao estado do dia 3 e seguir por
    outro caminho. Com um objeto mutável, "voltar ao dia 3" viraria uma
    cópia profunda feita à mão em cada ponto de ramificação — e esquecer
    uma delas produziria um bug que só aparece na terceira ramificação.
    """

    #: Vínculo terapêutico. O quanto o paciente confia em quem o atende.
    alianca: float = 0.5

    #: Intensidade do sofrimento presente. ALTO É RUIM.
    sofrimento: float = 0.6

    #: Disponibilidade para acessar e nomear a própria emoção.
    abertura: float = 0.4

    #: Expectativa de que o processo leve a algum lugar.
    esperanca: float = 0.4

    #: Disposição de cumprir o que foi combinado fora da sessão.
    adesao: float = 0.5

    #: Risco à segurança (ideação, negligência, agravamento). ALTO É RUIM.
    risco: float = 0.2

    #: Energia disponível para agir. É o orçamento do paciente na semana.
    energia: float = 0.5

    def __post_init__(self) -> None:
        # Prende na construção em vez de confiar em quem chama. Um estado
        # fora da faixa vazaria para o briefing, para a fisiologia e para
        # o gráfico de evolução antes de alguém notar.
        for campo in fields(self):
            object.__setattr__(self, campo.name, limitar(getattr(self, campo.name)))

    def com(self, **mudancas: float) -> "EstadoPaciente":
        """Devolve um estado novo com as dimensões indicadas somadas.

        Recebe DELTAS, não valores absolutos: `estado.com(alianca=-0.1)`.
        O motor pensa sempre em termos de "o que este dia mudou", e uma API
        de valor absoluto obrigaria cada chamador a ler o valor atual antes
        de escrever — a receita clássica para perder um efeito quando dois
        deles atingem a mesma dimensão no mesmo dia.
        """
        desconhecidas = set(mudancas) - set(DIMENSOES)
        if desconhecidas:
            # Falha alto: um nome de dimensão errado seria, de outra forma,
            # um efeito clínico que simplesmente não acontece — e o teste
            # que o cobre passaria, porque o estado continua válido.
            raise ValueError(f"dimensão inexistente: {sorted(desconhecidas)}")

        return replace(
            self,
            **{nome: getattr(self, nome) + delta for nome, delta in mudancas.items()},
        )

    def diferenca(self, outro: "EstadoPaciente") -> dict[str, float]:
        """Quanto cada dimensão mudou de `self` para `outro`.

        Devolve apenas o que passou de `LIMIAR_RELEVANCIA`, já que o único
        consumidor é a camada que escreve texto para o aluno ler.
        """
        return {
            nome: round(getattr(outro, nome) - getattr(self, nome), 4)
            for nome in DIMENSOES
            if abs(getattr(outro, nome) - getattr(self, nome)) >= LIMIAR_RELEVANCIA
        }

    def melhorou(self, outro: "EstadoPaciente") -> bool:
        """Se a transição de `self` para `outro` foi clinicamente positiva.

        Soma as variações com o sinal corrigido pelas dimensões invertidas:
        cair o sofrimento conta como ganho, subir o risco conta como perda.
        É deliberadamente uma soma simples e sem pesos — qualquer peso aqui
        seria uma opinião clínica embutida no motor, e essa opinião pertence
        ao avaliador (a régua do instituto), não à física do simulador.
        """
        saldo = 0.0
        for nome in DIMENSOES:
            delta = getattr(outro, nome) - getattr(self, nome)
            saldo += -delta if nome in DIMENSOES_INVERTIDAS else delta
        return saldo > 0

    def derivar(self, taxas: dict[str, float]) -> "EstadoPaciente":
        """Aplica a deriva espontânea de um dia, PROPORCIONAL ao que resta.

        As taxas são frações do caminho que ainda existe naquela direção,
        não quantidades absolutas:

            taxa negativa → delta = -taxa × (valor atual)
            taxa positiva → delta = +taxa × (1 - valor atual)

        Por que não absoluta. Numa escala fechada em [0, 1], uma deriva
        constante marcha para o extremo e encosta nele. O Depressivo, que
        começa com esperança baixa justamente por ser o perfil mais grave,
        chegava a zero antes do quarto dia — e a partir dali toda condução
        dava no mesmo resultado, porque o limite apagava a diferença. O
        perfil que mais precisa de resolução era o que tinha menos.

        Proporcional, a deriva vira aproximação assintótica: o paciente
        piora rápido enquanto há o que perder e devagar perto do fundo,
        sem nunca encostar. Isso é o que a clínica descreve, e de quebra
        preserva a faixa onde a diferença entre uma condução e outra ainda
        pode ser lida.
        """
        if not taxas:
            return self

        deltas = {}
        for dimensao, taxa in taxas.items():
            if dimensao not in DIMENSOES:
                raise ValueError(f"dimensão inexistente na deriva: {dimensao!r}")
            atual = getattr(self, dimensao)
            distancia = atual if taxa < 0 else (1.0 - atual)
            deltas[dimensao] = taxa * distancia

        return self.com(**deltas)

    def como_dicionario(self) -> dict[str, float]:
        """Serialização estável para o front, o histórico e os testes."""
        return {nome: round(getattr(self, nome), 4) for nome in DIMENSOES}

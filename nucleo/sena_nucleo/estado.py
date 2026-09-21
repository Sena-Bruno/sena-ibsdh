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

    def saldo_clinico(self, outro: "EstadoPaciente") -> float:
        """Soma das variações com o sinal corrigido pela valência.

        Cair o sofrimento conta como ganho; subir o risco conta como perda.
        Deliberadamente sem pesos — qualquer peso aqui seria uma opinião
        clínica embutida na física do motor, e essa opinião pertence ao
        avaliador, não ao simulador.
        """
        return sum(
            (getattr(self, nome) - getattr(outro, nome))
            if nome in DIMENSOES_INVERTIDAS
            else (getattr(outro, nome) - getattr(self, nome))
            for nome in DIMENSOES
        )

    def melhorou(self, outro: "EstadoPaciente") -> bool:
        """Se a transição de `self` para `outro` foi clinicamente positiva.

        Soma as variações com o sinal corrigido pelas dimensões invertidas:
        cair o sofrimento conta como ganho, subir o risco conta como perda.
        É deliberadamente uma soma simples e sem pesos — qualquer peso aqui
        seria uma opinião clínica embutida no motor, e essa opinião pertence
        ao avaliador (a régua do instituto), não à física do simulador.
        """
        return self.saldo_clinico(outro) > 0

    def regredir_para(
        self, equilibrio: "EstadoPaciente", taxa: float
    ) -> "EstadoPaciente":
        """Move cada dimensão uma fração `taxa` do caminho até o equilíbrio.

        ┌───────────────────────────────────────────────────────────────┐
        │  REGRESSÃO À MÉDIA — a correção mais importante do motor      │
        │                                                               │
        │  A primeira versão deste arquivo tinha `derivar()`: cada      │
        │  perfil perdia terreno todo dia, para sempre. O Depressivo    │
        │  caía 0,15 de esperança por semana e ganhava 0,22 de risco,   │
        │  e em 85% a 100% das semanas simuladas o paciente terminava   │
        │  pior do que começou.                                         │
        │                                                               │
        │  A literatura descreve o contrário. Grupos de lista de espera │
        │  — que são a medição empírica de "sem intervenção" — MELHORAM │
        │  em média (g = 0,37 pré-pós em depressão), os sintomas caem   │
        │  10–15% sozinhos, e 12,5% das pessoas remitem sem tratamento  │
        │  em 12 semanas. Quem piora de verdade é 12–13%, não 90%.      │
        │                                                               │
        │  O mecanismo é este: pessoas procuram ajuda no pior momento,  │
        │  e o pior momento é, por definição, atípico. O que se segue   │
        │  é retorno ao nível habitual — não cura, e não colapso.       │
        └───────────────────────────────────────────────────────────────┘

        Por que isto é MELHOR para o produto, e não uma perda: se o
        paciente melhora um pouco sozinho, o aluno não pode mais creditar
        toda melhora à própria técnica. Ele passa a ter de perguntar "fui
        eu ou foi o tempo?", que é das perguntas mais difíceis da clínica
        — e que o modelo anterior tornava impossível de ensinar, porque
        nele melhora espontânea nunca acontecia.

        A aproximação é assintótica por construção: o passo encolhe
        conforme a distância diminui, e o estado nunca ultrapassa o
        equilíbrio nem encosta nos limites da escala.
        """
        if not 0.0 <= taxa <= 1.0:
            raise ValueError(f"taxa de retorno deve estar em [0, 1], recebida {taxa!r}")

        return self.com(
            **{
                dimensao: (getattr(equilibrio, dimensao) - getattr(self, dimensao)) * taxa
                for dimensao in DIMENSOES
            }
        )

    def como_dicionario(self) -> dict[str, float]:
        """Serialização para EXIBIÇÃO — front, histórico legível, teste.

        Arredonda para 4 casas de propósito, e é exatamente por isso que
        este método NÃO SERVE para persistir o estado de um paciente entre
        sessões reais. `sena_servico.repositorio` usa
        `dataclasses.asdict(estado)` para guardar no banco, sem
        arredondar — perder precisão a cada sessão salva significaria o
        paciente persistido divergir, sessão a sessão, de uma simulação
        contínua equivalente, e a divergência cresce justamente perto dos
        limiares (`carga_tolerada`, `LIMIAR_DE_DETERIORACAO`) onde ela
        mais importa.
        """
        return {nome: round(getattr(self, nome), 4) for nome in DIMENSOES}

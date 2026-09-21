"""
O motor: os sete dias entre a sessão N e a sessão N+1.

┌───────────────────────────────────────────────────────────────────────┐
│  DETERMINISMO É REQUISITO, NÃO DETALHE                                │
│                                                                       │
│  A semana é sorteada, mas a partir de uma SEMENTE explícita. Três     │
│  coisas dependem disso e nenhuma funciona sem:                        │
│                                                                       │
│  · Teste. Uma semana que muda a cada execução não pode ser afirmada   │
│    por teste nenhum, e este motor decide o que o aluno vive.          │
│                                                                       │
│  · Replay contrafactual (a "Máquina do Tempo"). Para responder "e se  │
│    você tivesse prescrito outra coisa?" é preciso rodar a MESMA       │
│    semana — os mesmos eventos de vida, nos mesmos dias — trocando     │
│    apenas a prescrição. Com sorteio livre, a comparação não valeria   │
│    nada: metade da diferença viria do acaso.                          │
│                                                                       │
│  · Disputa. Quando dois alunos recebem "o mesmo caso", precisa ser o  │
│    mesmo mesmo. É o que torna a Arena possível.                       │
│                                                                       │
│  Por isso `simular_semana` recebe `semente` e nunca toca no gerador   │
│  global do `random`. Ela instancia o próprio `random.Random`.         │
└───────────────────────────────────────────────────────────────────────┘
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field

from .estado import EstadoPaciente
from .eventos import Evento, amortecer, repertorio
from .perfis import PerfilClinico
from .prescricao import (
    Prescricao,
    TipoPrescricao,
    efeito_de_um_dia,
    excesso_de_carga,
    probabilidade_de_adesao,
)

#: Quantos dias tem a semana entre sessões.
DIAS = 7

#: Chance de um dia qualquer trazer um evento de vida.
#:
#: 0,35 dá, em média, 2,45 eventos por semana. Menos que isso e a semana
#: fica vazia (o aluno não teria o que ler); muito mais e vira novela, e o
#: efeito da prescrição — que é o que estamos tentando ensinar — some
#: debaixo do ruído dramático.
CHANCE_DE_EVENTO_POR_DIA = 0.35

#: Saldo clínico abaixo do qual a semana conta como deterioração de verdade.
#:
#: Escolhido para que a fração de semanas deterioradas caia na faixa de
#: 12–13% que a literatura mede em grupos de controle. É calibração contra
#: um alvo publicado, não um número colhido diretamente de um artigo — a
#: distinção está registrada em `FUNDAMENTACAO.md`.
LIMIAR_DE_DETERIORACAO = -0.15


@dataclass(frozen=True)
class Dia:
    """Um dia da semana do paciente, com o que houve nele."""

    numero: int  # 1 a 7
    cumpriu_prescricao: bool
    evento: Evento | None
    estado_ao_fim: EstadoPaciente


@dataclass(frozen=True)
class Semana:
    """O resultado completo da simulação — o que a sessão seguinte herda."""

    estado_inicial: EstadoPaciente
    estado_final: EstadoPaciente
    dias: tuple[Dia, ...]
    prescricao: Prescricao
    semente: int

    #: Quantos dias a prescrição foi cumprida. O número que o aluno mais
    #: quer saber e o que menos explica sozinho — daí o resto do objeto.
    dias_cumpridos: int = 0

    #: `True` quando houve prescrição e ela ficou acima do que o paciente
    #: aguentava. É o sinal que a devolutiva usa para nomear iatrogenia em
    #: vez de chamar de "baixa adesão" o que foi erro de dose.
    houve_sobrecarga: bool = False

    eventos: tuple[Evento, ...] = field(default_factory=tuple)

    @property
    def saldo(self) -> float:
        """Quanto a semana rendeu, somando as sete dimensões pela valência."""
        return self.estado_inicial.saldo_clinico(self.estado_final)

    @property
    def piorou(self) -> bool:
        """Saldo negativo de qualquer tamanho — inclusive ruído.

        NÃO é a "deterioração" da literatura. Como a semana é ruidosa por
        construção, algo perto de metade das semanas fecha ligeiramente
        negativa, e isso é o esperado de um processo com variância em torno
        de uma tendência fraca. Para a medida que se compara com a pesquisa,
        use `deterioracao_clinica`.
        """
        return self.saldo < 0

    @property
    def deterioracao_clinica(self) -> bool:
        """Piora grande o bastante para um clínico chamar de piora.

        A literatura de desfecho conta deterioração por índice de mudança
        confiável — a queda tem de superar o erro de medida do instrumento,
        não apenas ser negativa. Em grupos de controle isso acontece em
        12–13% dos casos (4–5% em quem está em terapia).

        `LIMIAR_DE_DETERIORACAO` é o análogo aqui: o corte abaixo do qual a
        variação é indistinguível de uma semana comum. É uma escolha de
        modelagem, não um valor colhido da literatura — está declarada em
        `FUNDAMENTACAO.md` como tal.
        """
        return self.saldo <= LIMIAR_DE_DETERIORACAO

    @property
    def taxa_de_adesao(self) -> float:
        """Fração dos dias em que a tarefa foi cumprida, em [0, 1]."""
        if self.prescricao.tipo is TipoPrescricao.NENHUMA:
            return 0.0
        return self.dias_cumpridos / DIAS


def simular_semana(
    estado: EstadoPaciente,
    perfil: PerfilClinico,
    prescricao: Prescricao,
    semente: int,
) -> Semana:
    """Roda os sete dias e devolve o que o paciente traz para a sessão seguinte.

    A ordem dentro de um dia importa e é esta:

        1. regressão espontânea ao equilíbrio do perfil
        2. tentativa (ou não) de cumprir a prescrição
        3. evento de vida, amortecido pela reserva

    A prescrição vem ANTES do evento de propósito: a tarefa da manhã já foi
    feita quando a notícia ruim chega à tarde. Inverter a ordem faria um
    evento ruim de segunda-feira derrubar a adesão do próprio dia, o que
    dobraria o peso do acaso sobre algo que o aluno deveria conseguir
    influenciar.

    A probabilidade de adesão é recalculada a cada dia, contra o estado
    daquele dia — não contra o estado da sessão. É o que produz as duas
    espirais que o aluno precisa reconhecer: cumprir dá energia e torna
    cumprir amanhã mais provável; falhar tira esperança e torna falhar
    amanhã mais provável.
    """
    sorteio = random.Random(semente)
    repertorio_do_perfil = repertorio(perfil.nome)
    pesos = [evento.peso for evento in repertorio_do_perfil]

    # Medido contra o estado de saída da sessão: é a informação que o aluno
    # tinha na mão quando prescreveu, e é sobre ela que ele será avaliado.
    houve_sobrecarga = excesso_de_carga(prescricao, perfil, estado) > 0.0

    atual = estado
    dias: list[Dia] = []
    eventos_ocorridos: list[Evento] = []
    cumpridos = 0

    for numero in range(1, DIAS + 1):
        # 1 · regressão ao equilíbrio do perfil
        #
        # Onde antes havia uma queda diária constante. Ver
        # `EstadoPaciente.regredir_para` para por que mudou: sem
        # intervenção, a literatura mede melhora leve, não colapso.
        atual = atual.regredir_para(perfil.equilibrio, perfil.taxa_de_retorno)

        # 2 · prescrição
        #
        # O sorteio é consumido SEMPRE, inclusive quando não há prescrição e
        # o valor será descartado. Parece desperdício e é o contrário: é o
        # que mantém o fluxo de números alinhado entre duas simulações da
        # mesma semente. Sem isso, comparar uma semana com prescrição contra
        # a mesma semana sem nenhuma desloca todos os sorteios seguintes, e
        # os eventos de vida caem em dias diferentes — a Máquina do Tempo
        # passaria a comparar duas vidas distintas e a creditar à prescrição
        # uma diferença que é puro acaso.
        dado_da_adesao = sorteio.random()

        cumpriu = False
        if prescricao.tipo is not TipoPrescricao.NENHUMA:
            cumpriu = dado_da_adesao < probabilidade_de_adesao(prescricao, perfil, atual)
            efeitos = efeito_de_um_dia(prescricao, perfil, cumpriu)
            if efeitos:
                atual = atual.com(**efeitos)
            if cumpriu:
                cumpridos += 1

        # 3 · evento de vida
        evento = None
        if sorteio.random() < CHANCE_DE_EVENTO_POR_DIA:
            (evento,) = sorteio.choices(repertorio_do_perfil, weights=pesos, k=1)
            atual = atual.com(**amortecer(evento, atual))
            eventos_ocorridos.append(evento)

        dias.append(
            Dia(
                numero=numero,
                cumpriu_prescricao=cumpriu,
                evento=evento,
                estado_ao_fim=atual,
            )
        )

    return Semana(
        estado_inicial=estado,
        estado_final=atual,
        dias=tuple(dias),
        prescricao=prescricao,
        semente=semente,
        dias_cumpridos=cumpridos,
        houve_sobrecarga=houve_sobrecarga,
        eventos=tuple(eventos_ocorridos),
    )


def simular_alternativa(semana: Semana, outra: Prescricao, perfil: PerfilClinico) -> Semana:
    """A mesma semana, com outra prescrição — a Máquina do Tempo.

    Reaproveita a semente, então os eventos de vida caem nos mesmos dias com
    a mesma gravidade bruta. A diferença entre as duas semanas é atribuível
    à prescrição, e só a ela — que é a única forma de a pergunta "e se eu
    tivesse feito diferente?" ter resposta honesta.

    Uma ressalva que vale dizer alto, porque é fácil esquecer ao ler o
    gráfico comparativo: os eventos são os mesmos, mas o AMORTECIMENTO
    deles não, já que ele depende do estado do dia. Uma prescrição melhor
    chega em quinta-feira com mais reserva e absorve melhor a notícia ruim.
    Isso não é contaminação da comparação — é o efeito clínico que estamos
    justamente tentando mostrar.
    """
    return simular_semana(semana.estado_inicial, perfil, outra, semana.semente)

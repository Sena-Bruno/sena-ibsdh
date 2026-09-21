"""
A narração: a semana decidida pelo motor virando a voz do paciente.

┌───────────────────────────────────────────────────────────────────────┐
│  O MOTOR DECIDE. A IA NARRA. NUNCA O CONTRÁRIO.                       │
│                                                                       │
│  Se o modelo de linguagem decidir o que aconteceu na semana, a        │
│  prescrição do aluno deixa de importar — a IA inventaria um desfecho  │
│  qualquer, e a consequência, que é a razão de o Paciente Vivo         │
│  existir, morre. Também ficaria inauditável: ninguém saberia por que  │
│  o paciente chegou como chegou.                                       │
│                                                                       │
│  Esta regra não é aplicada por instrução no prompt, que é uma         │
│  promessa. É aplicada pela ESTRUTURA: `Fatos` é a única coisa que o   │
│  narrador recebe, e `Fatos` não contém número nenhum, nenhuma das     │
│  sete dimensões, nenhuma leitura clínica. O narrador não pode vazar   │
│  a aliança porque nunca viu a aliança; não pode contradizer a adesão  │
│  porque recebe a adesão já resolvida em palavra, não em fração.       │
│                                                                       │
│  Um prompt mal escrito degrada o texto. Não consegue vazar o que      │
│  não foi entregue.                                                    │
└───────────────────────────────────────────────────────────────────────┘

## Por que há um narrador fixo

`NARRADOR_FIXO` monta a fala a partir dos textos de `eventos.py`, sem
chamar nada. É o que o SENA já faz hoje, e continua sendo o caminho de
queda: chave de API vencida, cota estourada, modelo descontinuado (que já
derrubou a IA deste sistema uma vez — ver `appscript/groq-resiliente.gs`)
ou resposta vazia, e o aluno ainda entra na sessão. Uma sessão com fala
menos viva é um problema; uma sessão que não abre é um aluno perdido.

## Por que a validação é por linha

Se o modelo devolve cinco falas e a terceira traz um número, descartar as
cinco custa uma sessão inteira por causa de um deslize. A validação é por
linha: guarda as boas, descarta a que vazou, e só cai para o narrador fixo
se não sobrar nada.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable, Protocol

from .perfis import PerfilClinico
from .prescricao import TipoPrescricao
from .semana import Semana

#: Quanto da tarefa foi cumprido, em palavra — nunca em número.
#:
#: O paciente não diz "cumpri três dos sete dias". Diz "fiz umas vezes", e
#: cabe ao aluno perguntar. Entregar a fração ao narrador convidaria o
#: modelo a escrevê-la de volta.
#:
#: Os cortes vêm da granularidade real do dado, que é SÉTIMOS — não de
#: números redondos. A primeira versão usava 0,15 / 0,45 / 0,75 / 0,95, e
#: com ela 3 de 7 dias (0,4286) caía em "tentou uma vez", o que é
#: simplesmente falso. Mapeado por contagem de dias:
#:
#:     0/7  nao_fez            4/7  fez_algumas_vezes
#:     1/7  tentou_uma_vez     5/7  fez_quase_sempre
#:     2/7  fez_algumas_vezes  6/7  fez_quase_sempre
#:     3/7  fez_algumas_vezes  7/7  fez_todos_os_dias
FAIXAS_DE_ADESAO: tuple[tuple[float, str], ...] = (
    (0.00, "nao_fez"),
    (0.01, "tentou_uma_vez"),
    (0.20, "fez_algumas_vezes"),
    (0.65, "fez_quase_sempre"),
    (0.99, "fez_todos_os_dias"),
)


def faixa_de_adesao(taxa: float) -> str:
    escolhida = FAIXAS_DE_ADESAO[0][1]
    for limite, nome in FAIXAS_DE_ADESAO:
        if taxa >= limite:
            escolhida = nome
    return escolhida


@dataclass(frozen=True)
class Fatos:
    """Tudo — e só — o que o narrador tem direito de saber.

    A ausência é o ponto deste objeto. Não há `alianca`, não há `risco`,
    não há `saldo`, não há `houve_sobrecarga`, não há nenhuma das sete
    dimensões. Acrescentar qualquer um desses campos aqui reabre a porta
    que a classe existe para fechar — se um dia a narração parecer pobre,
    a resposta é melhorar o prompt, não alargar os fatos.
    """

    #: Nome do perfil, para o narrador acertar o registro de fala.
    perfil: str

    #: Como essa pessoa fala e se defende — vem do texto que o aluno lê.
    descricao: str
    resistencias: tuple[str, ...]

    #: O que aconteceu na vida dele, na ordem em que aconteceu.
    acontecimentos: tuple[str, ...] = ()

    #: Houve tarefa combinada?
    houve_prescricao: bool = False

    #: Faixa de cumprimento da tarefa, em palavra. Ver `FAIXAS_DE_ADESAO`.
    #:
    #: NÃO se chama `adesao` de propósito: `EstadoPaciente.adesao` é um
    #: número em [0, 1], e este campo é uma palavra como "fez_algumas_vezes".
    #: Dois campos de mesmo nome e significados diferentes no mesmo fluxo
    #: são o tipo de coincidência que produz um bug difícil de ver — alguém
    #: passa um no lugar do outro e nada quebra até a tela.
    cumprimento: str = "nao_fez"

    #: Se a semana, no conjunto, foi de alívio ou de piora. Booleano e não
    #: número: o narrador precisa do tom, não da magnitude.
    semana_foi_pior: bool = False


def extrair_fatos(semana: Semana, perfil: PerfilClinico) -> Fatos:
    """Reduz a semana ao que pode ser narrado.

    Este é o estreitamento. Tudo o que o motor calculou e que não passa
    por aqui fica inacessível ao narrador, por construção.
    """
    vistos: set[str] = set()
    acontecimentos: list[str] = []
    for evento in semana.eventos:
        if evento.id not in vistos:
            acontecimentos.append(evento.relato)
            vistos.add(evento.id)

    houve = semana.prescricao.tipo is not TipoPrescricao.NENHUMA
    return Fatos(
        perfil=perfil.nome,
        descricao=perfil.descricao,
        resistencias=perfil.resistencias,
        acontecimentos=tuple(acontecimentos),
        houve_prescricao=houve,
        cumprimento=faixa_de_adesao(semana.taxa_de_adesao) if houve else "nao_fez",
        semana_foi_pior=semana.piorou,
    )


#: Como cada faixa deve soar, para o narrador não ter de adivinhar.
#:
#: Note o "nao_fez": o paciente raramente abre a sessão confessando. A
#: instrução é explícita porque um modelo, sem ela, escreve a confissão —
#: e uma confissão de entrada tira do aluno o trabalho de perguntar.
ORIENTACAO_DE_ADESAO: dict[str, str] = {
    "nao_fez": (
        "Ele NÃO fez a tarefa combinada. Não abra a sessão confessando isso: "
        "mencione de raspão, ou justifique, ou desvie — como uma pessoa faria."
    ),
    "tentou_uma_vez": (
        "Ele tentou uma vez, no começo da semana, e parou. Conta isso sem "
        "precisão de data."
    ),
    "fez_algumas_vezes": (
        "Ele fez algumas vezes, não todo dia. Vago de propósito: 'umas vezes'."
    ),
    "fez_quase_sempre": "Ele fez quase todos os dias, e isso o deixa um pouco orgulhoso.",
    "fez_todos_os_dias": "Ele fez todos os dias, sem falhar, e faz questão de dizer.",
}


def montar_instrucoes(fatos: Fatos) -> str:
    """O prompt. Construído só a partir de `Fatos`.

    Escrito em português porque o paciente fala português, e pedir a um
    modelo que raciocine numa língua e escreva noutra custa qualidade de
    registro — que é exatamente o que esta etapa existe para ganhar.
    """
    linhas = [
        "Você é um PACIENTE em atendimento psicoterapêutico, chegando para a "
        "segunda sessão. Escreva apenas o que você diz ao sentar na cadeira.",
        "",
        f"Seu quadro: {fatos.descricao}.",
        f"Como você se defende: {'; '.join(fatos.resistencias)}.",
        "",
        "O QUE ACONTECEU NA SUA SEMANA (não invente nada além disto):",
    ]

    if fatos.acontecimentos:
        linhas += [f"- {a}" for a in fatos.acontecimentos]
    else:
        linhas.append(
            "- Nada digno de nota. A semana foi comum, e você não tem assunto."
        )

    if fatos.houve_prescricao:
        linhas += ["", ORIENTACAO_DE_ADESAO[fatos.cumprimento]]

    linhas += [
        "",
        (
            "No conjunto, a semana foi PIOR que a anterior."
            if fatos.semana_foi_pior
            else "No conjunto, a semana trouxe algum alívio."
        ),
        "",
        "REGRAS:",
        # Por extenso, e não "de 2 a 5": o prompt inteiro tem de ficar sem
        # algarismo. Um dígito escrito aqui é um dígito que o modelo pode
        # devolver, e a fala do paciente não carrega número nenhum.
        "- De duas a cinco falas curtas, uma por linha, sem marcador nem "
        "numeração.",
        "- Primeira pessoa, como a pessoa falaria. Sem aspas.",
        "- NÃO use algarismo, porcentagem nem contagem de dias: você não "
        "anotou nada, você lembra por cima.",
        # Antes esta linha ENUMERAVA o vocabulário proibido. Duas coisas
        # erradas nisso: o prompt passava a conter as palavras que a
        # camada existe para manter fora do alcance do narrador, e citar
        # uma palavra a um modelo aumenta a chance de ele a escrever.
        # Agora a regra descreve o PAPEL, que é o que de fato importa.
        "- Você é a pessoa atendida, não quem escreve o prontuário: sem "
        "jargão de psicologia e sem termo de avaliação.",
        "- NÃO se autodiagnostique e NÃO julgue quem te atende.",
        "- NÃO descreva seu corpo nem seus gestos: só a fala.",
        "- Escreva no registro do seu quadro — quem tem pouca energia fala "
        "pouco e devagar; quem racionaliza explica demais.",
    ]
    return "\n".join(linhas)


# ── validação ────────────────────────────────────────────────────────────

#: Vocabulário que denuncia vazamento da camada técnica para o aluno.
#:
#: "sessão" e "consulta" NÃO estão aqui de propósito: paciente de verdade
#: usa essas palavras. Já "paciente" e "terapeuta" ficam, porque na boca
#: do próprio paciente elas denunciam um modelo escrevendo SOBRE a pessoa
#: em vez de COMO a pessoa.
TERMOS_PROIBIDOS: tuple[str, ...] = (
    "aliança", "alianca", "adesão", "adesao", "prescrição", "prescricao",
    "perfil", "dimensão", "dimensao", "sobrecarga", "carga", "escala",
    "sintoma", "sintomas", "pontuação", "pontuacao", "nota", "notas",
    "índice", "indice", "evolução", "evolucao", "paciente", "terapeuta",
)

#: Os termos acima, compilados com fronteira de palavra.
#:
#: A primeira versão comparava por substring e rejeitava fala legítima:
#: "minha esposa anota tudo" contém "nota", e "recarga" contém "carga".
#: Um filtro que descarta fala boa é pior que um filtro frouxo — ele
#: empurra a sessão para o narrador fixo sem que ninguém entenda por quê.
_PADRAO_PROIBIDO = re.compile(
    r"\b(?:" + "|".join(re.escape(t) for t in TERMOS_PROIBIDOS) + r")\b",
    re.IGNORECASE,
)

#: Uma fala de paciente não tem 400 caracteres. Acima disso é o modelo
#: escrevendo prosa, não gente falando.
MAX_CARACTERES_POR_FALA = 320

#: Quantas falas, no máximo, chegam à tela.
MAX_FALAS = 5


def fala_valida(texto: str) -> bool:
    """Se esta linha pode ser mostrada ao aluno.

    Barra três coisas: número (que entregaria a contagem que o paciente não
    tem), vocabulário técnico (que entregaria a leitura que o aluno deveria
    fazer sozinho) e comprimento de redação.
    """
    limpo = texto.strip()
    if not limpo or len(limpo) > MAX_CARACTERES_POR_FALA:
        return False
    if any(caractere.isdigit() for caractere in limpo):
        return False
    return _PADRAO_PROIBIDO.search(limpo) is None


def limpar_resposta(bruto: str) -> tuple[str, ...]:
    """Transforma a resposta do modelo em falas exibíveis.

    Tolerante de propósito com a forma — modelos devolvem marcador, número
    de lista, aspas e linha em branco por conta própria, e brigar com isso
    no prompt gasta mais do que limpar aqui. Intolerante com o conteúdo:
    o que não passa em `fala_valida` é descartado.
    """
    falas: list[str] = []
    for linha in bruto.splitlines():
        limpo = linha.strip()
        # marcador de lista, numeração e aspas decorativas
        limpo = re.sub(r"^\s*(?:[-*•–]|\d+[.)])\s*", "", limpo)
        limpo = limpo.strip().strip('"').strip("“”").strip()
        if fala_valida(limpo):
            falas.append(limpo)
        if len(falas) >= MAX_FALAS:
            break
    return tuple(falas)


# ── narradores ───────────────────────────────────────────────────────────


class Narrador(Protocol):
    """Recebe o prompt, devolve o texto cru. Nada mais.

    Assinatura mínima porque o núcleo não deve saber de HTTP, de chave de
    API nem de qual fornecedor está em uso. Quem liga o modelo é a camada
    de cima; aqui só se recebe texto.
    """

    def __call__(self, instrucoes: str) -> str: ...


def narrar(
    semana: Semana,
    perfil: PerfilClinico,
    narrador: Narrador | None = None,
) -> tuple[str, ...]:
    """A fala de abertura da sessão seguinte.

    Cai para o narrador fixo em três casos, todos silenciosos para o aluno:
    nenhum narrador configurado, o narrador levantou exceção, ou nada do
    que ele devolveu passou na validação. Uma sessão com fala menos viva é
    um problema; uma sessão que não abre é um aluno perdido.
    """
    if narrador is None:
        return NARRADOR_FIXO(semana, perfil)

    try:
        bruto = narrador(montar_instrucoes(extrair_fatos(semana, perfil)))
    except Exception:
        # Sem registro aqui de propósito: este módulo não conhece o sistema
        # de log do projeto. Quem injeta o narrador é quem deve registrar a
        # falha — e o faz sabendo o que aconteceu.
        return NARRADOR_FIXO(semana, perfil)

    falas = limpar_resposta(bruto or "")
    return falas or NARRADOR_FIXO(semana, perfil)


def _narrador_fixo(semana: Semana, perfil: PerfilClinico) -> tuple[str, ...]:
    """A fala montada dos textos de `eventos.py`, sem chamar nada."""
    from .briefing import fala_de_abertura

    return fala_de_abertura(semana, perfil)


#: O caminho de queda. Ver o cabeçalho do módulo.
NARRADOR_FIXO: Callable[[Semana, PerfilClinico], tuple[str, ...]] = _narrador_fixo

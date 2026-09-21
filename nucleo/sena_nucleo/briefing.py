"""
O briefing: a semana simulada virando o que o paciente traz para a sessão.

┌───────────────────────────────────────────────────────────────────────┐
│  DUAS SAÍDAS, PARA DOIS LEITORES, QUE NÃO PODEM SE MISTURAR           │
│                                                                       │
│  · `fala_de_abertura()`  → vai para o ALUNO. É o paciente falando.    │
│    Não contém números, não contém diagnóstico, não contém a palavra   │
│    "aliança". Contém o que uma pessoa diria ao sentar na cadeira,     │
│    inclusive as omissões: um paciente que não cumpriu a tarefa        │
│    raramente abre a sessão confessando isso.                          │
│                                                                       │
│  · `ficha_do_supervisor()` → vai para a DEVOLUTIVA, DEPOIS. Aí sim    │
│    números, causa e nome técnico do que aconteceu.                    │
│                                                                       │
│  Misturar as duas é o erro que mataria o recurso: se o aluno lê "a    │
│  aliança caiu 12% porque a prescrição estava acima da carga", ele     │
│  não precisou perceber nada. O trabalho clínico é perceber. O         │
│  simulador só pode entregar a matéria-prima da percepção.             │
└───────────────────────────────────────────────────────────────────────┘
"""

from __future__ import annotations

from .corpo import descrever, ler_corpo, sinais_de_alerta
from .estado import DIMENSOES_INVERTIDAS
from .narrativa import faixa_de_adesao
from .perfis import PerfilClinico
from .prescricao import TipoPrescricao
from .semana import Semana

#: A frase de cada faixa de cumprimento.
#:
#: As FAIXAS vivem em `narrativa.FAIXAS_DE_ADESAO`; aqui só mora a redação
#: de cada uma. Este arquivo já teve os próprios limites, copiados, e
#: quando os de `narrativa` foram corrigidos para sétimos os dois
#: divergiram: a mesma semana virava "fez algumas vezes" no prompt do
#: narrador e "tentei uma vez" na fala do narrador fixo. Uma cópia de
#: regra é uma divergência agendada.
#:
#: Nenhuma frase dá o número. Pacientes não dizem "cumpri três dos sete
#: dias" — dizem "fiz umas vezes", e cabe ao aluno perguntar. A imprecisão
#: aqui é fidelidade, não preguiça.
FRASES_DE_CUMPRIMENTO: dict[str, str] = {
    "nao_fez": "Não consegui fazer aquilo que a gente combinou.",
    "tentou_uma_vez": "Tentei uma vez, no começo da semana. Depois não deu.",
    "fez_algumas_vezes": "Fiz umas vezes. Não todo dia, mas fiz.",
    "fez_quase_sempre": "Fiz quase todos os dias.",
    "fez_todos_os_dias": "Fiz todos os dias, sem falhar.",
}


def _comentario_de_adesao(taxa: float) -> str:
    return FRASES_DE_CUMPRIMENTO[faixa_de_adesao(taxa)]


def fala_de_abertura(semana: Semana, perfil: PerfilClinico) -> tuple[str, ...]:
    """O que o paciente diz ao sentar, na voz dele. Para o aluno ler.

    A ordem imita a de uma sessão real: primeiro o que aconteceu de mais
    vivo (os eventos), depois — e só se perguntado, o que aqui vira "só se
    houve prescrição" — a tarefa combinada.

    Os eventos entram na ordem em que ocorreram, sem repetir o mesmo tipo
    duas vezes: quem teve insônia na segunda e na sexta conta insônia uma
    vez, não duas. Repetir soaria a máquina, e a única coisa que o paciente
    virtual não pode soar é máquina.
    """
    falas: list[str] = []
    ja_relatados: set[str] = set()

    for evento in semana.eventos:
        if evento.id not in ja_relatados:
            falas.append(evento.relato)
            ja_relatados.add(evento.id)

    if semana.prescricao.tipo is not TipoPrescricao.NENHUMA:
        falas.append(_comentario_de_adesao(semana.taxa_de_adesao))

    if not falas:
        # Semana sem nada: o paciente não inventa assunto. O vazio é
        # informação clínica, e o aluno precisa aprender a trabalhar com ele
        # em vez de receber sempre um gancho pronto.
        falas.append("Foi uma semana normal. Não tenho muito o que contar.")

    return tuple(falas)


def abertura_completa(semana: Semana, perfil: PerfilClinico) -> dict[str, object]:
    """Tudo o que a tela precisa para montar a abertura da sessão seguinte.

    Junta a fala e o corpo, que é o par que o aluno tem que ler junto —
    e é justamente onde mora a lição, porque os dois costumam discordar.
    Um paciente dizendo "foi tudo bem" com respiração a 26 rpm e mandíbula
    travada está dando ao aluno a informação mais importante da sessão,
    desde que o aluno esteja olhando.
    """
    sinais = ler_corpo(semana.estado_final, perfil)
    return {
        "perfil": perfil.nome,
        "fala": fala_de_abertura(semana, perfil),
        "corpo": descrever(sinais),
        "sinais": sinais.como_dicionario(),
    }


def ficha_do_supervisor(semana: Semana, perfil: PerfilClinico) -> dict[str, object]:
    """A leitura técnica da semana. Só DEPOIS da sessão.

    É daqui que sai a devolutiva, a autópsia do caso e o gráfico de
    evolução. Nunca exibir enquanto o aluno conduz — ver o cabeçalho.
    """
    variacoes = semana.estado_inicial.diferenca(semana.estado_final)

    ganhos = []
    perdas = []
    for dimensao, delta in variacoes.items():
        foi_bom = (delta < 0) if dimensao in DIMENSOES_INVERTIDAS else (delta > 0)
        (ganhos if foi_bom else perdas).append((dimensao, delta))

    leitura: list[str] = []

    if semana.houve_sobrecarga:
        leitura.append(
            "A prescrição ficou acima da carga que este paciente suportava na "
            "semana. A baixa adesão não é resistência: é dose. O paciente "
            "tentou, não conseguiu, e a tentativa frustrada custou esperança — "
            "por isso ele chega pior do que se nada tivesse sido prescrito."
        )
    elif semana.prescricao.tipo is TipoPrescricao.NENHUMA:
        leitura.append(
            "Nenhuma prescrição foi feita. A semana correu pela deriva própria "
            "do perfil e pelos eventos de vida — o paciente ficou sozinho com "
            "o que tinha."
        )
    elif semana.taxa_de_adesao <= 0.3 and semana.prescricao.especificidade < 0.5:
        leitura.append(
            "Adesão baixa com prescrição vaga. Antes de ler isto como "
            "resistência, vale checar se havia o que cumprir: tarefa sem hora, "
            "sem lugar e sem número não é cumprível."
        )

    if semana.estado_final.risco >= 0.55 and not semana.prescricao.plano_de_seguranca:
        leitura.append(
            "O risco fechou a semana em faixa alta e não houve plano de "
            "segurança combinado. Este é o achado mais grave da semana."
        )

    return {
        "perfil": perfil.nome,
        "dias_cumpridos": semana.dias_cumpridos,
        "taxa_de_adesao": round(semana.taxa_de_adesao, 3),
        "houve_sobrecarga": semana.houve_sobrecarga,
        "piorou": semana.piorou,
        "variacoes": variacoes,
        "ganhos": sorted(ganhos, key=lambda par: -abs(par[1])),
        "perdas": sorted(perdas, key=lambda par: -abs(par[1])),
        "eventos": [evento.id for evento in semana.eventos],
        "leitura": leitura,
        "alertas": list(
            sinais_de_alerta(ler_corpo(semana.estado_final, perfil), semana.estado_final)
        ),
        "estado_final": semana.estado_final.como_dicionario(),
    }

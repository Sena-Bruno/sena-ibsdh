"""
O repositório: a ponte entre linhas de banco e os objetos do motor.

┌───────────────────────────────────────────────────────────────────────┐
│  A REGRA DESTE ARQUIVO                                                │
│                                                                       │
│  Toda função aqui recebe a conexão como primeiro argumento — nunca    │
│  um global, nunca um singleton de módulo. É o que torna testável sem  │
│  servidor: um teste abre um banco temporário, chama a função direto,  │
│  confere a linha. A API (`api.py`) é só mais um chamador.              │
│                                                                       │
│  E toda função que DECIDE algo clínico reconstrói o objeto `Semana`   │
│  do motor a partir de `estado_inicial` + `prescricao` + `semente` —   │
│  nunca lê os campos desnormalizados da tabela `semanas` para decidir  │
│  nada. Esses campos são instantâneo para listagem, não verdade — ver  │
│  o cabeçalho de `banco.py`.                                           │
└───────────────────────────────────────────────────────────────────────┘
"""

from __future__ import annotations

import json
import secrets
import sqlite3
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone

from sena_nucleo.estado import EstadoPaciente
from sena_nucleo.perfis import PerfilClinico, obter
from sena_nucleo.prescricao import Prescricao, TipoPrescricao
from sena_nucleo.semana import Semana, simular_semana

#: Teto do gerador de semente. 31 bits cabe inteiro no INTEGER do SQLite
#: (que é 64-bit assinado) sem risco de estourar, com folga enorme contra
#: repetição: mais de 2 bilhões de valores possíveis por chamada.
TETO_DA_SEMENTE = 2**31


def _agora() -> str:
    return datetime.now(timezone.utc).isoformat()


def gerar_semente() -> int:
    """Uma semente nova, imprevisível para quem está do lado do aluno.

    Usa `secrets`, não `random`: o motor exige apenas que a MESMA semente
    reproduza a MESMA semana (para a Máquina do Tempo) — nada exige que a
    semente em si seja previsível, e não há razão para deixá-la ser.
    """
    return secrets.randbelow(TETO_DA_SEMENTE)


class PacienteNaoEncontrado(LookupError):
    """O id não corresponde a nenhum paciente vivo."""


@dataclass(frozen=True)
class PacienteRegistro:
    """Uma linha de `pacientes`, com o estado já desserializado."""

    id: str
    aluno_email: str
    curso: str
    perfil: str
    numero_sessao: int
    estado_atual: EstadoPaciente
    criado_em: str
    atualizado_em: str

    @classmethod
    def _de_linha(cls, linha: sqlite3.Row) -> "PacienteRegistro":
        return cls(
            id=linha["id"],
            aluno_email=linha["aluno_email"],
            curso=linha["curso"],
            perfil=linha["perfil"],
            numero_sessao=linha["numero_sessao"],
            estado_atual=EstadoPaciente(**json.loads(linha["estado_atual"])),
            criado_em=linha["criado_em"],
            atualizado_em=linha["atualizado_em"],
        )


@dataclass(frozen=True)
class SemanaRegistro:
    """Uma linha de `semanas` — o suficiente para RECONSTRUIR a semana.

    Guarda também os três campos desnormalizados, mas quem decide algo
    clínico deve ignorá-los e chamar `reconstruir_semana`.
    """

    id: int
    paciente_id: str
    numero_sessao: int
    semente: int
    prescricao: Prescricao
    estado_inicial: EstadoPaciente
    estado_final: EstadoPaciente
    dias_cumpridos: int
    houve_sobrecarga: bool
    deterioracao_clinica: bool
    criado_em: str

    @classmethod
    def _de_linha(cls, linha: sqlite3.Row) -> "SemanaRegistro":
        p = json.loads(linha["prescricao"])
        return cls(
            id=linha["id"],
            paciente_id=linha["paciente_id"],
            numero_sessao=linha["numero_sessao"],
            semente=linha["semente"],
            prescricao=Prescricao(
                tipo=TipoPrescricao(p["tipo"]),
                especificidade=p["especificidade"],
                carga=p["carga"],
                plano_de_seguranca=p["plano_de_seguranca"],
            ),
            estado_inicial=EstadoPaciente(**json.loads(linha["estado_inicial"])),
            estado_final=EstadoPaciente(**json.loads(linha["estado_final"])),
            dias_cumpridos=linha["dias_cumpridos"],
            houve_sobrecarga=bool(linha["houve_sobrecarga"]),
            deterioracao_clinica=bool(linha["deterioracao_clinica"]),
            criado_em=linha["criado_em"],
        )


def _serializar_prescricao(p: Prescricao) -> str:
    return json.dumps(
        {
            "tipo": p.tipo.value,
            "especificidade": p.especificidade,
            "carga": p.carga,
            "plano_de_seguranca": p.plano_de_seguranca,
        }
    )


# ── pacientes ──────────────────────────────────────────────────────────


def criar_ou_obter_paciente(
    conexao: sqlite3.Connection, aluno_email: str, curso: str, perfil: str
) -> tuple[PacienteRegistro, bool]:
    """Garante um paciente vivo para este aluno+curso. Idempotente.

    Devolve `(registro, criado)`. Se já existir um paciente para este par,
    devolve O EXISTENTE — o `perfil` do argumento é ignorado nesse caso, e
    `criado` vem `False`. Isso é deliberado: um retry de rede na criação
    (o front chamando duas vezes por causa de um clique duplo, ou um timeout
    seguido de nova tentativa) não pode gerar um segundo caso clínico
    silenciosamente por baixo do aluno.

    Escolher QUAL perfil este aluno recebe é decisão pedagógica — de quem
    chama, não deste repositório. Aqui é sempre explícito.
    """
    existente = obter_paciente_por_aluno(conexao, aluno_email, curso)
    if existente is not None:
        return existente, False

    perfil_obj = obter(perfil)  # levanta KeyError com nomes válidos se errado

    agora = _agora()
    id_novo = str(uuid.uuid4())
    conexao.execute(
        """INSERT INTO pacientes
           (id, aluno_email, curso, perfil, numero_sessao, estado_atual,
            criado_em, atualizado_em)
           VALUES (?, ?, ?, ?, 1, ?, ?, ?)""",
        (
            id_novo,
            aluno_email,
            curso,
            perfil,
            json.dumps(asdict(perfil_obj.basal)),
            agora,
            agora,
        ),
    )
    conexao.commit()
    return obter_paciente(conexao, id_novo), True  # type: ignore[return-value]


def obter_paciente(conexao: sqlite3.Connection, id: str) -> PacienteRegistro | None:
    linha = conexao.execute(
        "SELECT * FROM pacientes WHERE id = ?", (id,)
    ).fetchone()
    return PacienteRegistro._de_linha(linha) if linha else None


def obter_paciente_por_aluno(
    conexao: sqlite3.Connection, aluno_email: str, curso: str
) -> PacienteRegistro | None:
    linha = conexao.execute(
        "SELECT * FROM pacientes WHERE aluno_email = ? AND curso = ?",
        (aluno_email, curso),
    ).fetchone()
    return PacienteRegistro._de_linha(linha) if linha else None


def exigir_paciente(conexao: sqlite3.Connection, id: str) -> PacienteRegistro:
    registro = obter_paciente(conexao, id)
    if registro is None:
        raise PacienteNaoEncontrado(id)
    return registro


# ── semanas ────────────────────────────────────────────────────────────


def registrar_semana(
    conexao: sqlite3.Connection,
    paciente_id: str,
    prescricao: Prescricao,
    semente: int | None = None,
) -> tuple[Semana, PerfilClinico, int]:
    """Simula os 7 dias a partir do estado ATUAL do paciente e persiste.

    Devolve `(semana, perfil, numero_da_sessao_que_a_semana_sucede)`. O
    objeto `Semana` é o do motor — não um DTO próprio — porque é ele que
    `briefing.abertura_completa` e `briefing.ficha_do_supervisor` já sabem
    consumir. O repositório não reinventa essa forma.

    O terceiro valor da tupla evita quem chama precisar ler o paciente de
    novo só para saber que sessão acabou de virar — o número já estava em
    mãos aqui dentro, antes do `UPDATE` avançar `numero_sessao`.

    `semente` é parâmetro só para TESTE (reproduzir um cenário exato). Em
    uso normal, deixe `None`: uma semente nova é gerada e persistida.
    """
    registro = exigir_paciente(conexao, paciente_id)
    perfil = obter(registro.perfil)
    semente_final = gerar_semente() if semente is None else semente

    semana = simular_semana(registro.estado_atual, perfil, prescricao, semente_final)

    agora = _agora()
    conexao.execute(
        """INSERT INTO semanas
           (paciente_id, numero_sessao, semente, prescricao,
            estado_inicial, estado_final, dias_cumpridos, houve_sobrecarga,
            deterioracao_clinica, criado_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            paciente_id,
            registro.numero_sessao,
            semente_final,
            _serializar_prescricao(prescricao),
            json.dumps(asdict(semana.estado_inicial)),
            json.dumps(asdict(semana.estado_final)),
            semana.dias_cumpridos,
            int(semana.houve_sobrecarga),
            int(semana.deterioracao_clinica),
            agora,
        ),
    )
    conexao.execute(
        """UPDATE pacientes
           SET estado_atual = ?, numero_sessao = numero_sessao + 1,
               atualizado_em = ?
           WHERE id = ?""",
        (json.dumps(asdict(semana.estado_final)), agora, paciente_id),
    )
    conexao.commit()
    return semana, perfil, registro.numero_sessao


def historico(conexao: sqlite3.Connection, paciente_id: str) -> list[SemanaRegistro]:
    """As semanas já vividas, mais recente por último. Para LISTAGEM.

    Devolve os registros desnormalizados — rápido, sem tocar o motor. Quem
    precisa decidir algo sobre uma semana específica (não só mostrá-la)
    deve passar o registro para `reconstruir_semana`.
    """
    linhas = conexao.execute(
        """SELECT * FROM semanas WHERE paciente_id = ?
           ORDER BY numero_sessao ASC, id ASC""",
        (paciente_id,),
    ).fetchall()
    return [SemanaRegistro._de_linha(linha) for linha in linhas]


def reconstruir_semana(registro: SemanaRegistro, perfil: PerfilClinico) -> Semana:
    """Recomputa a semana INTEIRA a partir do que foi persistido.

    É a diferença entre "olhar a tabela" e "saber o que aconteceu": os
    três campos desnormalizados do registro podem estar defasados em
    relação à versão atual do motor (a etapa 1 já mudou o que conta como
    deterioração uma vez). Isto aqui roda o motor DE NOVO, com o código de
    hoje, sobre o estado e a semente de então — a única fonte que não
    envelhece mal.

    `perfil` é OBRIGATÓRIO e não tem valor padrão: `SemanaRegistro` não
    guarda o nome do perfil — ele pertence ao paciente, não à semana — e
    não há como adivinhá-lo aqui. Quem chama já tem o `PacienteRegistro`
    em mãos (foi ele que devolveu a lista de semanas); o custo de exigir
    o argumento é uma linha a mais no chamador, e a alternativa seria
    inventar um valor, que é sempre pior que recusar.
    """
    return simular_semana(
        registro.estado_inicial, perfil, registro.prescricao, registro.semente
    )

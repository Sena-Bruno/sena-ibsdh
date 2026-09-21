"""
O repositório: a ponte entre linhas de banco e os objetos do motor.

┌───────────────────────────────────────────────────────────────────────┐
│  A REGRA DESTE ARQUIVO                                                │
│                                                                       │
│  Toda função aqui recebe a conexão (`sqlalchemy.engine.Connection`)   │
│  como primeiro argumento — nunca um global, nunca um singleton de     │
│  módulo. É o que torna testável sem servidor: um teste abre           │
│  `banco.motor_de_teste()`, chama a função direto, confere a linha.    │
│  A API (`api.py`) é só mais um chamador.                              │
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
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.engine import Connection

from sena_nucleo.estado import EstadoPaciente
from sena_nucleo.perfis import PerfilClinico, obter
from sena_nucleo.prescricao import Prescricao, TipoPrescricao
from sena_nucleo.semana import Semana, simular_semana

from .banco import pacientes, semanas

#: Teto do gerador de semente. 31 bits cabe folgado no `Integer` de
#: qualquer um dos dois dialetos, com margem enorme contra repetição.
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
    def _de_linha(cls, linha) -> "PacienteRegistro":
        return cls(
            id=linha.id,
            aluno_email=linha.aluno_email,
            curso=linha.curso,
            perfil=linha.perfil,
            numero_sessao=linha.numero_sessao,
            estado_atual=EstadoPaciente(**json.loads(linha.estado_atual)),
            criado_em=linha.criado_em,
            atualizado_em=linha.atualizado_em,
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
    def _de_linha(cls, linha) -> "SemanaRegistro":
        p = json.loads(linha.prescricao)
        return cls(
            id=linha.id,
            paciente_id=linha.paciente_id,
            numero_sessao=linha.numero_sessao,
            semente=linha.semente,
            prescricao=Prescricao(
                tipo=TipoPrescricao(p["tipo"]),
                especificidade=p["especificidade"],
                carga=p["carga"],
                plano_de_seguranca=p["plano_de_seguranca"],
            ),
            estado_inicial=EstadoPaciente(**json.loads(linha.estado_inicial)),
            estado_final=EstadoPaciente(**json.loads(linha.estado_final)),
            dias_cumpridos=linha.dias_cumpridos,
            houve_sobrecarga=bool(linha.houve_sobrecarga),
            deterioracao_clinica=bool(linha.deterioracao_clinica),
            criado_em=linha.criado_em,
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


def _serializar_estado(estado: EstadoPaciente) -> str:
    # asdict(), NUNCA como_dicionario(): aquele método arredonda para 4
    # casas — certo para exibição, errado para persistir. Ver o aviso em
    # sena_nucleo/estado.py. Precisão perdida a cada sessão salva divergiria
    # de uma simulação contínua equivalente, e a divergência cresce
    # justamente perto dos limiares (carga_tolerada, LIMIAR_DE_DETERIORACAO)
    # onde ela mais importa.
    return json.dumps(asdict(estado))


# ── pacientes ──────────────────────────────────────────────────────────


def criar_ou_obter_paciente(
    conexao: Connection, aluno_email: str, curso: str, perfil: str
) -> tuple[PacienteRegistro, bool]:
    """Garante um paciente vivo para este aluno+curso. Idempotente.

    Devolve `(registro, criado)`. Se já existir um paciente para este par,
    devolve O EXISTENTE — o `perfil` do argumento é ignorado nesse caso, e
    `criado` vem `False`. Isso é deliberado: um retry de rede na criação
    (o front chamando duas vezes por causa de um clique duplo, ou um timeout
    seguido de nova tentativa) não pode gerar um segundo caso clínico
    silenciosamente por baixo do aluno.

    Há uma janela de corrida pequena entre o SELECT e o INSERT (duas
    requisições simultâneas para o mesmo aluno+curso, na primeira vez,
    poderiam ambas ver "não existe" e ambas tentar inserir — a segunda
    falharia na restrição UNIQUE do banco). Aceitável no volume do piloto
    (só instrutores, uso manual, nunca duas abas simultâneas no mesmo
    caso); resolver isso com um upsert nativo do banco reintroduziria a
    divergência de dialeto entre SQLite e Postgres que SQLAlchemy existe
    para evitar aqui — ver o cabeçalho de `banco.py`.

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
        pacientes.insert().values(
            id=id_novo,
            aluno_email=aluno_email,
            curso=curso,
            perfil=perfil,
            numero_sessao=1,
            estado_atual=_serializar_estado(perfil_obj.basal),
            criado_em=agora,
            atualizado_em=agora,
        )
    )
    conexao.commit()
    return obter_paciente(conexao, id_novo), True  # type: ignore[return-value]


def obter_paciente(conexao: Connection, id: str) -> PacienteRegistro | None:
    linha = conexao.execute(
        select(pacientes).where(pacientes.c.id == id)
    ).fetchone()
    return PacienteRegistro._de_linha(linha) if linha else None


def obter_paciente_por_aluno(
    conexao: Connection, aluno_email: str, curso: str
) -> PacienteRegistro | None:
    linha = conexao.execute(
        select(pacientes).where(
            pacientes.c.aluno_email == aluno_email, pacientes.c.curso == curso
        )
    ).fetchone()
    return PacienteRegistro._de_linha(linha) if linha else None


def exigir_paciente(conexao: Connection, id: str) -> PacienteRegistro:
    registro = obter_paciente(conexao, id)
    if registro is None:
        raise PacienteNaoEncontrado(id)
    return registro


# ── semanas ────────────────────────────────────────────────────────────


def registrar_semana(
    conexao: Connection,
    paciente_id: str,
    prescricao: Prescricao,
    semente: int | None = None,
) -> tuple[Semana, PerfilClinico, int]:
    """Simula os 7 dias a partir do estado ATUAL do paciente e persiste.

    Devolve `(semana, perfil, numero_da_sessao_que_a_semana_sucede)`. O
    objeto `Semana` é o do motor — não um DTO próprio — porque é ele que
    `briefing.abertura_completa` e `briefing.ficha_do_supervisor` já sabem
    consumir. O repositório não reinventa essa forma.

    `semente` é parâmetro só para TESTE (reproduzir um cenário exato). Em
    uso normal, deixe `None`: uma semente nova é gerada e persistida.
    """
    registro = exigir_paciente(conexao, paciente_id)
    perfil = obter(registro.perfil)
    semente_final = gerar_semente() if semente is None else semente

    semana = simular_semana(registro.estado_atual, perfil, prescricao, semente_final)

    agora = _agora()
    conexao.execute(
        semanas.insert().values(
            paciente_id=paciente_id,
            numero_sessao=registro.numero_sessao,
            semente=semente_final,
            prescricao=_serializar_prescricao(prescricao),
            estado_inicial=_serializar_estado(semana.estado_inicial),
            estado_final=_serializar_estado(semana.estado_final),
            dias_cumpridos=semana.dias_cumpridos,
            houve_sobrecarga=semana.houve_sobrecarga,
            deterioracao_clinica=semana.deterioracao_clinica,
            criado_em=agora,
        )
    )
    conexao.execute(
        update(pacientes)
        .where(pacientes.c.id == paciente_id)
        .values(
            estado_atual=_serializar_estado(semana.estado_final),
            numero_sessao=registro.numero_sessao + 1,
            atualizado_em=agora,
        )
    )
    conexao.commit()
    return semana, perfil, registro.numero_sessao


def historico(conexao: Connection, paciente_id: str) -> list[SemanaRegistro]:
    """As semanas já vividas, mais recente por último. Para LISTAGEM.

    Devolve os registros desnormalizados — rápido, sem tocar o motor. Quem
    precisa decidir algo sobre uma semana específica (não só mostrá-la)
    deve passar o registro para `reconstruir_semana`.
    """
    linhas = conexao.execute(
        select(semanas)
        .where(semanas.c.paciente_id == paciente_id)
        .order_by(semanas.c.numero_sessao.asc(), semanas.c.id.asc())
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
    em mãos (foi ele que devolveu a lista de semanas).
    """
    return simular_semana(
        registro.estado_inicial, perfil, registro.prescricao, registro.semente
    )

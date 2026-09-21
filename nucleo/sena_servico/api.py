"""
A API: o Paciente Vivo servido por HTTP.

┌───────────────────────────────────────────────────────────────────────┐
│  ESTA API AINDA NÃO É PARA O ALUNO VER                                │
│                                                                       │
│  Ela existe para provar, isolada, que persistência + motor + narração │
│  funcionam juntos — não para receber tráfego de produção. A etapa 4   │
│  é quem decide COMO isso chega ao SENA de verdade (proxy do Netlify,  │
│  autenticação por token como em `appscript/autenticacao.gs`, etc.).   │
│                                                                       │
│  Por isso as respostas aqui são DELIBERADAMENTE completas — incluem   │
│  `estado_atual`, `ficha_do_supervisor`, tudo. Nenhuma rota aqui separa │
│  "o que é seguro mostrar ao aluno" de "o que é leitura de supervisor" │
│  — quem fizer essa separação é o gateway da etapa 4, usando           │
│  `abertura` (já sem número, já sem termo técnico — ver `narrativa.py` │
│  e `briefing.fala_de_abertura`) para o aluno e `ficha` para o resto.  │
│  Nunca devolva `ficha` nem `estado_atual` a um cliente de aluno.       │
└───────────────────────────────────────────────────────────────────────┘

## A narração aqui é onde as etapas 2 e 3 se encontram

No fim da etapa 2, a narração por IA não tinha onde acontecer de verdade —
não existia estado persistente para narrar a EVOLUÇÃO de. Esta API é esse
lugar: toda vez que uma prescrição é registrada, `narrar()` é chamada com
o narrador HTTP se `SENA_IA_URL`/`SENA_IA_CHAVE`/`SENA_IA_MODELOS`
estiverem configuradas, e cai para o texto fixo se não estiverem, se a
chamada falhar, ou se a resposta não passar na validação. Ver
`narrativa.py` e `narrador_http.py` para as garantias.

## Rodar localmente

    pip install -r nucleo/requirements-servico.txt
    cd nucleo
    uvicorn sena_servico.api:app --reload

Banco em `sena_servico.sqlite3` neste diretório (ver `CAMINHO_DO_BANCO`).
Documentação interativa em /docs.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

from sena_nucleo.briefing import abertura_completa, ficha_do_supervisor
from sena_nucleo.perfis import PERFIS, obter
from sena_nucleo.prescricao import Prescricao, TipoPrescricao

from . import banco, repositorio
from .narrador import obter_narrador

#: Onde o banco fica, sobrescrevível por variável de ambiente — é o que
#: permite os testes apontarem para um arquivo temporário sem tocar no
#: banco de desenvolvimento.
CAMINHO_DO_BANCO = os.environ.get(
    "SENA_BANCO", str(Path(__file__).parent / "sena_servico.sqlite3")
)


def obter_conexao():
    """Uma conexão por requisição, fechada ao fim — o padrão do FastAPI.

    Reabrir por requisição custa pouco em SQLite local e evita guardar
    estado de conexão entre chamadas, que é a fonte mais comum de bug
    difícil de reproduzir num serviço web.
    """
    conexao = banco.conectar(CAMINHO_DO_BANCO)
    try:
        yield conexao
    finally:
        conexao.close()


app = FastAPI(
    title="SENA · Paciente Vivo",
    description=(
        "Serviço interno de persistência e narração do Paciente Vivo. "
        "Não é a API pública do SENA — ver o aviso no topo de api.py."
    ),
)

#: Instanciado uma vez, no processo — não por requisição, porque montar a
#: fila de modelos e ler variáveis de ambiente a cada chamada seria
#: trabalho repetido sem motivo. Se a configuração mudar, reinicie o
#: processo (comportamento normal de qualquer serviço configurado por
#: variável de ambiente).
_NARRADOR = obter_narrador()


# ── modelos HTTP ─────────────────────────────────────────────────────────


class PrescricaoEntrada(BaseModel):
    """O corpo de POST /pacientes/{id}/sessoes.

    Os limites (`ge=0, le=1`) duplicam a validação que `Prescricao` já faz
    internamente — de propósito. Aqui a mensagem de erro chega ao cliente
    HTTP em formato claro (422 com o campo nomeado); lá dentro é a defesa
    de quem chama o motor por qualquer outro caminho que não este.
    """

    tipo: str = Field(
        description=f"Um de: {', '.join(t.name for t in TipoPrescricao)}"
    )
    especificidade: float = Field(0.5, ge=0.0, le=1.0)
    carga: float = Field(0.5, ge=0.0, le=1.0)
    plano_de_seguranca: bool = False

    def para_prescricao(self) -> Prescricao:
        try:
            tipo = TipoPrescricao[self.tipo]
        except KeyError:
            validos = ", ".join(t.name for t in TipoPrescricao)
            raise HTTPException(
                422, f"tipo de prescrição desconhecido: {self.tipo!r}. Válidos: {validos}"
            ) from None
        return Prescricao(tipo, self.especificidade, self.carga, self.plano_de_seguranca)


class PacienteEntrada(BaseModel):
    aluno_email: str
    curso: str
    perfil: str = Field(description=f"Um de: {', '.join(PERFIS)}")


class PacienteSaida(BaseModel):
    id: str
    aluno_email: str
    curso: str
    perfil: str
    numero_sessao: int
    estado_atual: dict[str, float]
    criado_em: str
    atualizado_em: str
    criado_agora: bool


class SemanaSaida(BaseModel):
    """Resposta de POST /pacientes/{id}/sessoes.

    `abertura` é o que um cliente de aluno pode um dia receber — sem
    número, sem termo técnico (ver `narrativa.py`). `ficha` é leitura de
    supervisor e NUNCA deve ir para esse cliente. Ambas voltam juntas
    aqui porque esta API ainda não tem os dois públicos separados — ver o
    aviso no topo do arquivo.
    """

    numero_sessao_concluida: int
    narrador: Literal["http", "fixo"]
    abertura: dict
    ficha: dict


class HistoricoItem(BaseModel):
    numero_sessao: int
    dias_cumpridos: int
    houve_sobrecarga: bool
    deterioracao_clinica: bool
    criado_em: str


class Diagnostico(BaseModel):
    narrador_configurado: bool
    banco: str
    perfis_disponiveis: list[str]


# ── rotas ──────────────────────────────────────────────────────────────


@app.get("/diagnostico", response_model=Diagnostico)
def diagnostico():
    """Se a IA está de fato ligada, e para onde o banco aponta.

    Existe para responder, em segundos, a pergunta que mais custa
    descobrir do jeito difícil: "por que a fala está saindo genérica?" —
    resposta: o narrador HTTP não está configurado, e é esperado, não bug.
    """
    return Diagnostico(
        narrador_configurado=_NARRADOR is not None,
        banco=CAMINHO_DO_BANCO,
        perfis_disponiveis=sorted(PERFIS),
    )


@app.get("/perfis")
def listar_perfis():
    """Os 8 perfis, com o texto clínico e o estado basal — para o front
    montar telas sem duplicar o catálogo."""
    return {
        nome: {
            "descricao": p.descricao,
            "resistencias": list(p.resistencias),
            "abordagem_ideal": p.abordagem_ideal,
            "basal": p.basal.como_dicionario(),
            "carga_tolerada": p.carga_tolerada,
        }
        for nome, p in PERFIS.items()
    }


@app.post("/pacientes", response_model=PacienteSaida, status_code=201)
def criar_paciente(entrada: PacienteEntrada, conexao=Depends(obter_conexao)):
    """Cria o paciente deste aluno+curso, ou devolve o que já existe.

    Idempotente por design (ver `repositorio.criar_ou_obter_paciente`): um
    retry de rede nunca duplica o caso clínico do aluno. `criado_agora`
    diferencia os dois casos para quem chama decidir o que fazer (mostrar
    a primeira sessão do zero, ou retomar de onde o aluno parou).
    """
    try:
        registro, criado = repositorio.criar_ou_obter_paciente(
            conexao, entrada.aluno_email, entrada.curso, entrada.perfil
        )
    except KeyError as erro:
        raise HTTPException(422, str(erro)) from None

    return PacienteSaida(
        id=registro.id,
        aluno_email=registro.aluno_email,
        curso=registro.curso,
        perfil=registro.perfil,
        numero_sessao=registro.numero_sessao,
        estado_atual=registro.estado_atual.como_dicionario(),
        criado_em=registro.criado_em,
        atualizado_em=registro.atualizado_em,
        criado_agora=criado,
    )


@app.get("/pacientes/{paciente_id}", response_model=PacienteSaida)
def obter_paciente_rota(paciente_id: str, conexao=Depends(obter_conexao)):
    registro = repositorio.obter_paciente(conexao, paciente_id)
    if registro is None:
        raise HTTPException(404, f"paciente {paciente_id!r} não encontrado")
    return PacienteSaida(
        id=registro.id,
        aluno_email=registro.aluno_email,
        curso=registro.curso,
        perfil=registro.perfil,
        numero_sessao=registro.numero_sessao,
        estado_atual=registro.estado_atual.como_dicionario(),
        criado_em=registro.criado_em,
        atualizado_em=registro.atualizado_em,
        criado_agora=False,
    )


@app.post("/pacientes/{paciente_id}/sessoes", response_model=SemanaSaida)
def registrar_sessao(
    paciente_id: str, entrada: PrescricaoEntrada, conexao=Depends(obter_conexao)
):
    """O coração da etapa: simula a semana, persiste, narra, devolve os dois
    lados — a abertura (segura) e a ficha (supervisor)."""
    try:
        semana, perfil, numero_sessao_anterior = repositorio.registrar_semana(
            conexao, paciente_id, entrada.para_prescricao()
        )
    except repositorio.PacienteNaoEncontrado:
        raise HTTPException(404, f"paciente {paciente_id!r} não encontrado") from None

    abertura = abertura_completa(semana, perfil)
    abertura["fala"] = list(narrar_ou_texto_fixo(semana, perfil))

    return SemanaSaida(
        numero_sessao_concluida=numero_sessao_anterior,
        narrador="http" if _NARRADOR is not None else "fixo",
        abertura=abertura,
        ficha=ficha_do_supervisor(semana, perfil),
    )


@app.get("/pacientes/{paciente_id}/historico", response_model=list[HistoricoItem])
def obter_historico(paciente_id: str, conexao=Depends(obter_conexao)):
    if repositorio.obter_paciente(conexao, paciente_id) is None:
        raise HTTPException(404, f"paciente {paciente_id!r} não encontrado")
    return [
        HistoricoItem(
            numero_sessao=s.numero_sessao,
            dias_cumpridos=s.dias_cumpridos,
            houve_sobrecarga=s.houve_sobrecarga,
            deterioracao_clinica=s.deterioracao_clinica,
            criado_em=s.criado_em,
        )
        for s in repositorio.historico(conexao, paciente_id)
    ]


def narrar_ou_texto_fixo(semana, perfil):
    from sena_nucleo.narrativa import narrar

    return narrar(semana, perfil, _NARRADOR)

"""
A API: o Paciente Vivo servido por HTTP.

┌───────────────────────────────────────────────────────────────────────┐
│  ETAPA 4 — PILOTO INTERNO, NÃO ABERTO A ALUNO                         │
│                                                                       │
│  Toda rota exige um token de sessão válido (o MESMO emitido pelo      │
│  Apps Script — ver `autenticacao.py`) E que o e-mail autenticado      │
│  esteja em `SENA_EMAILS_PILOTO`. Isso não é um detalhe: é o gate que  │
│  torna concreto o que ficou registrado na etapa 1 — o instituto ainda │
│  não tem responsável técnico revisando o conteúdo clínico, então      │
│  nenhum aluno pode encostar nisto ainda, só quem esse gate autoriza    │
│  explicitamente.                                                      │
│                                                                       │
│  Tirar esse gate é decisão de produto de quem administra o SENA,      │
│  nunca uma linha de código a remover por conveniência.                 │
└───────────────────────────────────────────────────────────────────────┘

## A separação aluno / supervisor é real agora, não só documentada

`POST /pacientes/{id}/sessoes` devolve só `abertura` — fala e corpo, sem
número, sem termo técnico (ver `narrativa.py`). É o formato seguro para
QUALQUER cliente, inclusive um aluno, no dia em que o gate acima abrir.

`GET /pacientes/{id}/ficha/{numero_sessao}` devolve a leitura de
supervisor (`ficha_do_supervisor`, com `estado_atual`, ganhos/perdas,
alertas). Hoje, com o gate do piloto, quem chama uma rota chama a outra
— mas a arquitetura já separa os dois papéis, porque essa separação não
pode ser adiada para quando for tarde.

## Rodar localmente

    pip install -r nucleo/requirements-servico.txt
    export SENA_SESSION_SECRET=...   # o MESMO valor de SESSION_SECRET no Apps Script
    export SENA_EMAILS_PILOTO=voce@ibsdh.com.br,instrutor@ibsdh.com.br
    cd nucleo
    uvicorn sena_servico.api:app --reload

Banco em `sqlite:///./sena_servico.sqlite3` por padrão (sobrescrevível por
`SENA_BANCO_URL`). Documentação interativa em /docs.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from sena_nucleo.briefing import abertura_completa, ficha_do_supervisor
from sena_nucleo.perfis import PERFIS, obter
from sena_nucleo.prescricao import Prescricao, TipoPrescricao

from . import banco, repositorio
from .autenticacao import Sessao, TokenInvalido, verificar_token
from .narrador import obter_narrador

#: Onde o banco fica. Em produção, uma URL do Postgres (Neon); em
#: desenvolvimento local, um arquivo SQLite ao lado deste módulo.
URL_DO_BANCO = os.environ.get(
    "SENA_BANCO_URL", f"sqlite:///{Path(__file__).parent / 'sena_servico.sqlite3'}"
)

_ENGINE = banco.conectar(URL_DO_BANCO)


def obter_conexao():
    """Uma conexão por requisição, fechada ao fim — o padrão do FastAPI."""
    conexao = _ENGINE.connect()
    try:
        yield conexao
    finally:
        conexao.close()


def _emails_do_piloto() -> frozenset[str]:
    bruto = os.environ.get("SENA_EMAILS_PILOTO", "")
    return frozenset(e.strip().lower() for e in bruto.split(",") if e.strip())


def exigir_sessao(authorization: str | None = Header(default=None)) -> Sessao:
    """Verifica o token do cabeçalho `Authorization: Bearer <token>`.

    O MESMO token que o resto do SENA já usa (ver `autenticacao.py`) — não
    um sistema de login novo. `Header` com nome em kebab-case é o padrão
    do FastAPI para `Authorization`; ele mesmo faz a tradução.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Cabeçalho Authorization: Bearer <token> ausente.")
    token = authorization[len("bearer "):].strip()
    try:
        return verificar_token(token)
    except TokenInvalido as erro:
        raise HTTPException(401, str(erro)) from None


def exigir_piloto(sessao: Sessao = Depends(exigir_sessao)) -> Sessao:
    """Além de autenticado, o e-mail precisa estar na lista do piloto.

    Ver o aviso no topo do arquivo: este gate existe porque o instituto
    ainda não tem responsável técnico revisando o conteúdo clínico. Não é
    "autorização insuficiente" no sentido comum — é o produto ainda não
    estar pronto para qualquer aluno, mesmo autenticado de verdade.
    """
    permitidos = _emails_do_piloto()
    if not permitidos:
        raise HTTPException(
            503,
            "SENA_EMAILS_PILOTO não configurado — nenhum e-mail está "
            "autorizado a usar o Paciente Vivo ainda.",
        )
    if sessao.email.lower() not in permitidos:
        raise HTTPException(
            403,
            "O Paciente Vivo está em piloto interno. Este e-mail não está "
            "na lista de acesso.",
        )
    return sessao


app = FastAPI(
    title="SENA · Paciente Vivo",
    description=(
        "Serviço do Paciente Vivo — etapa 4, piloto interno. Toda rota "
        "exige sessão autenticada E e-mail autorizado (SENA_EMAILS_PILOTO). "
        "Ver o aviso no topo de api.py."
    ),
)

#: Instanciado uma vez, no processo — não por requisição.
_NARRADOR = obter_narrador()

# ── CORS ─────────────────────────────────────────────────────────────────
#
# Este serviço roda num host separado do site (Render, não Netlify — ver
# render.yaml), então uma chamada do Vue sai do domínio do site e o
# navegador exige CORS. A allowlist é por REGEX, não "*": liberar qualquer
# origem devolveria dado autenticado (a ficha de um paciente) para um site
# arbitrário que soubesse forjar o cabeçalho Origin. O gate de verdade
# continua sendo o token (autenticacao.py) + o e-mail no piloto
# (exigir_piloto) — CORS aqui é a segunda camada, não a primeira.
#
# Cobre: o domínio próprio de produção (simulador.institutobrunosena.com.br
# — o site aponta pra lá, não pro *.netlify.app cru, mesmo hospedado no
# Netlify), o subdomínio padrão do Netlify (caso o domínio próprio mude ou
# saia do ar), cada deploy preview de PR (deploy-preview-123--sena-ibsdh.
# netlify.app) e o dev local do Vite.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(https://simulador\.institutobrunosena\.com\.br|https://([a-z0-9-]+--)?sena-ibsdh\.netlify\.app|http://localhost:\d+)$",
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


# ── modelos HTTP ─────────────────────────────────────────────────────────


class PrescricaoEntrada(BaseModel):
    """O corpo de POST /pacientes/{id}/sessoes."""

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
    curso: str
    perfil: str = Field(description=f"Um de: {', '.join(PERFIS)}")


class PacienteSaida(BaseModel):
    """Forma SEGURA do paciente — sem `estado_atual`.

    Diferente da etapa 3: naquela versão, esta resposta incluía o estado
    numérico porque não havia ainda separação de público. Agora não —
    mesmo com o gate do piloto ligado, a API já se comporta como se
    qualquer cliente pudesse ser um aluno, porque um dia vai poder.
    """

    id: str
    curso: str
    perfil: str
    numero_sessao: int
    criado_agora: bool


class AberturaSaida(BaseModel):
    """A resposta de POST /pacientes/{id}/sessoes — segura para qualquer
    cliente. Fala e corpo, sem número, sem termo técnico.

    `sinais` é a única exceção numérica, e é deliberada: são os mesmos 7
    valores de `SinaisCorporais.como_dicionario()` (corpo.py) que já
    viram as frases de `corpo` — respiração, contato visual, tensão,
    presença, velocidade da fala. Não são leitura clínica (não têm
    "aliança", "sofrimento", nenhuma das 7 dimensões de `estado.py`) — são
    o MESMO sinal observável de `corpo`, só que em número em vez de
    frase, para o avatar (ideia #2: "o paciente tem corpo") animar o
    sinal em vez de só descrevê-lo em texto. Ainda é "o sinal é exibido,
    a leitura nunca é": o aluno vê o corpo respirar mais rápido, não lê
    "respiracao_por_minuto: 22.3" em lugar nenhum da tela."""

    numero_sessao_concluida: int
    narrador: Literal["http", "fixo"]
    perfil: str
    fala: list[str]
    corpo: list[str]
    sinais: dict[str, float]


class HistoricoItem(BaseModel):
    numero_sessao: int
    criado_em: str


class FichaSaida(BaseModel):
    """Leitura de supervisor — NUNCA para um cliente de aluno.

    Só existe atrás de `exigir_piloto`, que hoje é a única porta desta
    API. O dia em que uma rota de aluno for exposta, ela nunca deve
    importar este modelo nem chamar `ficha_do_supervisor`.
    """

    perfil: str
    dias_cumpridos: int
    taxa_de_adesao: float
    houve_sobrecarga: bool
    piorou: bool
    estado_final: dict[str, float]
    variacoes: dict[str, float]
    leitura: list[str]
    alertas: list[str]


class Diagnostico(BaseModel):
    narrador_configurado: bool
    banco: str
    piloto_configurado: bool
    perfis_disponiveis: list[str]


# ── rotas ──────────────────────────────────────────────────────────────


@app.get("/saude")
def saude():
    """Health check público, sem autenticação — de propósito.

    Existe só para o Render (ou qualquer orquestrador) saber que o
    processo está de pé; um health check automatizado não tem como
    carregar um token. Por isso não devolve NADA além de "estou vivo" —
    nem versão, nem configuração, nem contagem de nada. Quem quer
    diagnóstico de verdade usa `/diagnostico`, que exige sessão do piloto.
    """
    return {"ok": True}


@app.get("/diagnostico", response_model=Diagnostico)
def diagnostico(sessao: Sessao = Depends(exigir_piloto)):
    """Mesmo esta rota exige sessão do piloto — nenhuma informação sobre a
    configuração do serviço é pública."""
    return Diagnostico(
        narrador_configurado=_NARRADOR is not None,
        banco=URL_DO_BANCO.split("@")[-1] if "@" in URL_DO_BANCO else URL_DO_BANCO,
        piloto_configurado=bool(_emails_do_piloto()),
        perfis_disponiveis=sorted(PERFIS),
    )


@app.get("/perfis")
def listar_perfis(sessao: Sessao = Depends(exigir_piloto)):
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
def criar_paciente(
    entrada: PacienteEntrada,
    sessao: Sessao = Depends(exigir_piloto),
    conexao=Depends(obter_conexao),
):
    """Cria o paciente deste aluno+curso, ou devolve o que já existe.

    O aluno vem do TOKEN (`sessao.email`), nunca de um campo do corpo da
    requisição — é exatamente a troca que fechou os achados F1/F2 no
    resto do SENA, e este serviço novo não pode reabrir o mesmo buraco.
    """
    try:
        registro, criado = repositorio.criar_ou_obter_paciente(
            conexao, sessao.email, entrada.curso, entrada.perfil
        )
    except KeyError as erro:
        raise HTTPException(422, str(erro)) from None

    return PacienteSaida(
        id=registro.id, curso=registro.curso, perfil=registro.perfil,
        numero_sessao=registro.numero_sessao, criado_agora=criado,
    )


def _exigir_dono(conexao, paciente_id: str, sessao: Sessao) -> repositorio.PacienteRegistro:
    """Confirma que o paciente existe E pertence ao e-mail da sessão.

    Sem isto, um e-mail do piloto autenticado poderia ler ou avançar o
    caso de OUTRO e-mail do piloto só sabendo o id — o mesmo tipo de
    falha que o token já resolve para "quem é você", mas aplicado a "isto
    é seu". `PacienteNaoEncontrado` para os dois casos (não existe, ou não
    é seu) de propósito: um 404 não revela a um e-mail do piloto que outro
    caso existe.
    """
    registro = repositorio.obter_paciente(conexao, paciente_id)
    if registro is None or registro.aluno_email != sessao.email:
        raise HTTPException(404, f"paciente {paciente_id!r} não encontrado")
    return registro


@app.get("/pacientes/{paciente_id}", response_model=PacienteSaida)
def obter_paciente_rota(
    paciente_id: str,
    sessao: Sessao = Depends(exigir_piloto),
    conexao=Depends(obter_conexao),
):
    registro = _exigir_dono(conexao, paciente_id, sessao)
    return PacienteSaida(
        id=registro.id, curso=registro.curso, perfil=registro.perfil,
        numero_sessao=registro.numero_sessao, criado_agora=False,
    )


@app.post("/pacientes/{paciente_id}/sessoes", response_model=AberturaSaida)
def registrar_sessao(
    paciente_id: str,
    entrada: PrescricaoEntrada,
    sessao: Sessao = Depends(exigir_piloto),
    conexao=Depends(obter_conexao),
):
    """O coração da etapa: simula a semana, persiste, narra.

    Devolve SÓ a abertura — fala e corpo. Quem quiser a leitura técnica
    desta mesma sessão chama GET .../ficha/{numero_sessao_concluida} logo
    em seguida, uma rota separada, nunca esta.
    """
    _exigir_dono(conexao, paciente_id, sessao)
    try:
        semana, perfil, numero_sessao_anterior = repositorio.registrar_semana(
            conexao, paciente_id, entrada.para_prescricao()
        )
    except repositorio.PacienteNaoEncontrado:
        raise HTTPException(404, f"paciente {paciente_id!r} não encontrado") from None

    from sena_nucleo.narrativa import narrar

    abertura = abertura_completa(semana, perfil)
    fala = list(narrar(semana, perfil, _NARRADOR))

    return AberturaSaida(
        numero_sessao_concluida=numero_sessao_anterior,
        narrador="http" if _NARRADOR is not None else "fixo",
        perfil=perfil.nome,
        fala=fala,
        corpo=list(abertura["corpo"]),
        sinais=dict(abertura["sinais"]),
    )


@app.get("/pacientes/{paciente_id}/ficha/{numero_sessao}", response_model=FichaSaida)
def obter_ficha(
    paciente_id: str,
    numero_sessao: int,
    sessao: Sessao = Depends(exigir_piloto),
    conexao=Depends(obter_conexao),
):
    """A leitura de supervisor de UMA sessão já concluída. NUNCA para
    cliente de aluno — ver o aviso no topo do arquivo."""
    registro = _exigir_dono(conexao, paciente_id, sessao)
    perfil = obter(registro.perfil)

    candidatos = [
        s for s in repositorio.historico(conexao, paciente_id)
        if s.numero_sessao == numero_sessao
    ]
    if not candidatos:
        raise HTTPException(404, f"sessão {numero_sessao} não encontrada para este paciente")

    semana = repositorio.reconstruir_semana(candidatos[-1], perfil)
    ficha = ficha_do_supervisor(semana, perfil)

    return FichaSaida(
        perfil=perfil.nome,
        dias_cumpridos=ficha["dias_cumpridos"],
        taxa_de_adesao=ficha["taxa_de_adesao"],
        houve_sobrecarga=ficha["houve_sobrecarga"],
        piorou=ficha["piorou"],
        estado_final=ficha["estado_final"],
        variacoes=ficha["variacoes"],
        leitura=ficha["leitura"],
        alertas=ficha["alertas"],
    )


@app.get("/pacientes/{paciente_id}/historico", response_model=list[HistoricoItem])
def obter_historico(
    paciente_id: str,
    sessao: Sessao = Depends(exigir_piloto),
    conexao=Depends(obter_conexao),
):
    """Lista SÓ os números de sessão e datas — sem os campos clínicos.

    Para "quais sessões existem, pra eu pedir a ficha de qual" — não para
    montar um painel de leitura clínica direto daqui. Quem quer isso
    chama `obter_ficha` sessão por sessão.
    """
    _exigir_dono(conexao, paciente_id, sessao)
    return [
        HistoricoItem(numero_sessao=s.numero_sessao, criado_em=s.criado_em)
        for s in repositorio.historico(conexao, paciente_id)
    ]

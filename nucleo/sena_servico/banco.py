"""
O banco: onde o paciente passa a existir entre uma sessão real e a próxima.

┌───────────────────────────────────────────────────────────────────────┐
│  POR QUE SQLITE, E POR QUE AGORA                                      │
│                                                                       │
│  Esta camada ainda não vai para produção — é a peça que prova,        │
│  isolada, que o paciente pode ter memória de verdade antes de         │
│  encostar em aluno pagante (isso é a etapa 4). Para essa prova,        │
│  SQLite é a escolha certa: um arquivo, zero servidor para operar,     │
│  testável sem infraestrutura nenhuma. Trocar por Postgres depois é    │
│  mudança de uma função (`conectar`); adotar Postgres agora seria      │
│  infraestrutura antes da hora.                                        │
└───────────────────────────────────────────────────────────────────────┘

## Por que este esquema é tão pequeno

O motor (`sena_nucleo`) é determinístico por semente — é a invariante que
sustenta a Máquina do Tempo desde a etapa 0. Isso significa que o dia-a-dia
de uma semana NUNCA precisa ser guardado: guardando `estado_inicial`, a
prescrição e a `semente`, `simular_semana()` reproduz a semana inteira, com
todos os sete dias, a qualquer momento.

Por isso a tabela `semanas` não tem coluna de eventos nem de trajetória
dia a dia. O que ela guarda a mais (`dias_cumpridos`, `houve_sobrecarga`,
`deterioracao_clinica`) é DESNORMALIZADO de propósito, só para listagem
rápida num painel — nunca é a fonte de verdade. Se a lógica de avaliação
do motor mudar (como mudou na etapa 1), essas colunas ficam com o
julgamento ANTIGO gravado. Todo código que decide algo — não só mostra —
deve reconstruir via `sena_servico.repositorio.reconstruir_semana`, nunca
confiar nessas colunas. Ver o aviso lá.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path

ESQUEMA = """
CREATE TABLE IF NOT EXISTS pacientes (
    id              TEXT PRIMARY KEY,
    aluno_email     TEXT NOT NULL,
    curso           TEXT NOT NULL,
    perfil          TEXT NOT NULL,
    numero_sessao   INTEGER NOT NULL,
    estado_atual    TEXT NOT NULL,   -- JSON das 7 dimensões
    criado_em       TEXT NOT NULL,
    atualizado_em   TEXT NOT NULL,
    UNIQUE (aluno_email, curso)
);

-- Um paciente vivo por aluno+curso. Não por aluno só: o mesmo aluno pode
-- estar em duas formações ao mesmo tempo (Practitioner e Master, por
-- exemplo), e cada uma tem o próprio caso, sem se misturar.

CREATE TABLE IF NOT EXISTS semanas (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id             TEXT NOT NULL REFERENCES pacientes(id),
    numero_sessao           INTEGER NOT NULL,  -- sessão que esta semana sucede
    semente                 INTEGER NOT NULL,
    prescricao              TEXT NOT NULL,     -- JSON
    estado_inicial          TEXT NOT NULL,     -- JSON — junto com semente e
                                                -- prescrição, reproduz tudo
    estado_final            TEXT NOT NULL,     -- JSON — snapshot, não fonte
    dias_cumpridos          INTEGER NOT NULL,  -- desnormalizado (ver módulo)
    houve_sobrecarga        INTEGER NOT NULL,  -- idem
    deterioracao_clinica    INTEGER NOT NULL,  -- idem
    criado_em               TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_semanas_paciente
    ON semanas (paciente_id, numero_sessao);
"""


def conectar(caminho: str | Path) -> sqlite3.Connection:
    """Abre uma conexão pronta para uso: linhas por nome, chaves estrangeiras.

    `caminho=":memory:"` funciona para teste rápido, mas cada conexão a
    `:memory:` é seu PRÓPRIO banco vazio — duas conexões nunca veem os
    dados uma da outra. Para testes que abrem mais de uma conexão (a API
    faz isso por requisição), use `banco_temporario()`, que aponta as duas
    para o mesmo arquivo em disco.
    """
    conexao = sqlite3.connect(str(caminho))
    conexao.row_factory = sqlite3.Row
    conexao.execute("PRAGMA foreign_keys = ON")
    conexao.executescript(ESQUEMA)
    return conexao


@contextmanager
def banco_temporario():
    """Um banco de arquivo real, apagado ao sair do bloco `with`.

    Existe para teste: `:memory:` não serve quando mais de uma conexão
    precisa enxergar os mesmos dados (a API abre uma conexão por
    requisição), e um arquivo real evita esse problema sem exigir nenhuma
    infraestrutura.
    """
    import tempfile

    with tempfile.TemporaryDirectory() as pasta:
        caminho = Path(pasta) / "sena_teste.sqlite3"
        yield caminho

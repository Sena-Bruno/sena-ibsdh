"""
O banco: onde o paciente passa a existir entre uma sessão real e a próxima.

┌───────────────────────────────────────────────────────────────────────┐
│  POR QUE SQLALCHEMY, E NÃO sqlite3 PURO (COMO NA PRIMEIRA VERSÃO)     │
│                                                                       │
│  A etapa 3 rodava em SQLite puro — certo para provar que a            │
│  persistência funciona, isolada. Mas a etapa 4 esbarrou numa          │
│  restrição real: sem orçamento para hospedagem, o único caminho       │
│  viável é computação GRATUITA (Render free) + banco GRATUITO que não  │
│  perde dado (Postgres gratuito via Neon) — e computação gratuita tem  │
│  disco EFÊMERO: todo restart apaga um SQLite local.                   │
│                                                                       │
│  A solução não é hospedar SQLite em outro lugar — é parar de          │
│  depender de um arquivo local. SQLAlchemy Core fala os dois dialetos  │
│  (`sqlite:///...` para teste e desenvolvimento, `postgresql://...`    │
│  para produção) com o MESMO código Python, o que elimina o risco que  │
│  duas implementações de SQL escritas à mão para dois bancos           │
│  diferentes trariam: uma query que funciona num dialeto e tem         │
│  semântica sutilmente diferente no outro, passando limpo nos testes   │
│  (SQLite) e falhando só em produção (Postgres).                       │
└───────────────────────────────────────────────────────────────────────┘

## Por que este esquema é tão pequeno

O motor (`sena_nucleo`) é determinístico por semente — a invariante da etapa
0. O dia-a-dia de uma semana nunca precisa ser guardado: com `estado_inicial`,
a prescrição e a `semente`, `simular_semana()` reproduz a semana inteira, com
todos os sete dias, a qualquer momento.

Os três campos "a mais" na tabela `semanas` (`dias_cumpridos`,
`houve_sobrecarga`, `deterioracao_clinica`) são DESNORMALIZADOS de propósito,
só para listagem rápida — nunca a fonte de verdade. Se a lógica de avaliação
do motor mudar (já mudou uma vez, na etapa 1), essas colunas ficam com o
julgamento ANTIGO gravado. Código que decide algo — não só mostra — deve
reconstruir via `sena_servico.repositorio.reconstruir_semana`.
"""

from __future__ import annotations

from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    UniqueConstraint,
    create_engine,
)
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool

metadata = MetaData()

#: Um paciente vivo por aluno+curso. Não por aluno só: o mesmo aluno pode
#: estar em duas formações ao mesmo tempo, e cada uma tem o próprio caso,
#: sem se misturar.
pacientes = Table(
    "pacientes",
    metadata,
    Column("id", String(64), primary_key=True),
    Column("aluno_email", String(320), nullable=False),
    Column("curso", String(120), nullable=False),
    Column("perfil", String(60), nullable=False),
    Column("numero_sessao", Integer, nullable=False),
    Column("estado_atual", Text, nullable=False),  # JSON das 7 dimensões
    Column("criado_em", String(40), nullable=False),
    Column("atualizado_em", String(40), nullable=False),
    UniqueConstraint("aluno_email", "curso", name="uq_paciente_aluno_curso"),
)

semanas = Table(
    "semanas",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("paciente_id", String(64), ForeignKey("pacientes.id"), nullable=False),
    Column("numero_sessao", Integer, nullable=False),  # sessão que esta semana sucede
    Column("semente", Integer, nullable=False),
    Column("prescricao", Text, nullable=False),  # JSON
    # estado_inicial + prescrição + semente reproduzem a semana inteira —
    # ver o cabeçalho do módulo.
    Column("estado_inicial", Text, nullable=False),
    Column("estado_final", Text, nullable=False),  # snapshot, não fonte
    Column("dias_cumpridos", Integer, nullable=False),  # desnormalizado
    Column("houve_sobrecarga", Boolean, nullable=False),  # idem
    Column("deterioracao_clinica", Boolean, nullable=False),  # idem
    Column("criado_em", String(40), nullable=False),
)

Index("idx_semanas_paciente", semanas.c.paciente_id, semanas.c.numero_sessao)


def conectar(url: str) -> Engine:
    """Abre (ou cria) o banco na URL indicada e garante o esquema.

    `url` segue o padrão do SQLAlchemy:

        sqlite:///caminho/para/arquivo.db     desenvolvimento local
        sqlite:///:memory:                     teste (ver `motor_de_teste`)
        postgresql+psycopg://usuario:senha@host/banco   produção (Neon)

    `metadata.create_all` só cria o que ainda não existe — chamar de novo
    numa URL já populada não apaga nada, é seguro chamar a cada subida do
    serviço.
    """
    engine = create_engine(url, future=True)
    metadata.create_all(engine)
    return engine


def motor_de_teste() -> Engine:
    """Um banco SQLite em memória, pronto para teste — sem arquivo, sem rede.

    `StaticPool` é o que torna isto possível: SQLite em memória normalmente
    é um banco NOVO E VAZIO por conexão, o que quebraria qualquer teste que
    abra mais de uma conexão (a API abre uma por requisição). `StaticPool`
    faz todas as conexões deste engine compartilharem a mesma conexão
    física por baixo — mesmo efeito do arquivo temporário que a etapa 3
    usava, sem tocar o disco.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
        future=True,
    )
    metadata.create_all(engine)
    return engine

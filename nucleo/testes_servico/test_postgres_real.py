"""Os mesmos pontos críticos do repositório, contra um Postgres DE VERDADE.

Pulado por padrão — a maioria de quem for rodar `test:servico` não tem
Postgres instalado, e não deveria precisar. Roda quando
`SENA_TESTE_POSTGRES_URL` está definido, por exemplo:

    docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=teste postgres:16
    SENA_TESTE_POSTGRES_URL=postgresql+psycopg://postgres:teste@127.0.0.1/postgres \
        python3 -m unittest testes_servico.test_postgres_real -v

Por que este arquivo existe, separado de `test_repositorio.py`: aquele
roda contra SQLite em memória, o que prova que a LÓGICA está certa, mas
não prova que o SQL gerado pelo SQLAlchemy é válido no dialeto do
Postgres — autoincrement, tipo BOOLEAN nativo, e a restrição UNIQUE
podem, em teoria, ter tradução diferente entre os dois dialetos.
Verificado manualmente uma vez contra Postgres 16 local antes deste
arquivo existir (todos os pontos abaixo passaram); este arquivo é o que
trava essa verificação para não precisar repeti-la à mão.
"""

import os
import unittest

PRECISA_DE_POSTGRES = "SENA_TESTE_POSTGRES_URL não definido — pulado por padrão"


@unittest.skipUnless(os.environ.get("SENA_TESTE_POSTGRES_URL"), PRECISA_DE_POSTGRES)
class TestContraPostgresReal(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from sqlalchemy.exc import IntegrityError

        from sena_servico.banco import conectar, metadata

        cls.IntegrityError = IntegrityError
        cls.engine = conectar(os.environ["SENA_TESTE_POSTGRES_URL"])
        cls.metadata = metadata

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()

    def setUp(self):
        self.conexao = self.engine.connect()
        self.addCleanup(self.conexao.close)
        # limpa as tabelas antes de cada teste — Postgres real persiste
        # entre execuções, ao contrário do SQLite em memória dos outros
        # testes.
        for tabela in reversed(self.metadata.sorted_tables):
            self.conexao.execute(tabela.delete())
        self.conexao.commit()

    def test_criar_e_idempotencia(self):
        from sena_servico.repositorio import criar_ou_obter_paciente

        reg, criado = criar_ou_obter_paciente(self.conexao, "a@x.com", "P", "Depressivo")
        self.assertTrue(criado)
        reg2, criado2 = criar_ou_obter_paciente(self.conexao, "a@x.com", "P", "Ansioso")
        self.assertFalse(criado2)
        self.assertEqual(reg.id, reg2.id)

    def test_unique_constraint_e_reconhecida_pelo_dialeto(self):
        from sena_servico.banco import pacientes

        self.conexao.execute(
            pacientes.insert().values(
                id="a", aluno_email="x@x.com", curso="P", perfil="Ansioso",
                numero_sessao=1, estado_atual="{}", criado_em="t", atualizado_em="t",
            )
        )
        self.conexao.commit()
        with self.assertRaises(self.IntegrityError):
            self.conexao.execute(
                pacientes.insert().values(
                    id="b", aluno_email="x@x.com", curso="P", perfil="Cético",
                    numero_sessao=1, estado_atual="{}", criado_em="t", atualizado_em="t",
                )
            )
            self.conexao.commit()

    def test_booleano_volta_como_bool_nativo_nao_0_ou_1(self):
        """Postgres tem tipo BOOLEAN nativo; SQLite finge com 0/1. O
        repositório precisa devolver `bool` de verdade nos dois casos."""
        from sena_nucleo.prescricao import Prescricao, TipoPrescricao
        from sena_servico.repositorio import (
            criar_ou_obter_paciente,
            historico,
            registrar_semana,
        )

        reg, _ = criar_ou_obter_paciente(self.conexao, "a@x.com", "P", "Depressivo")
        registrar_semana(
            self.conexao, reg.id,
            Prescricao(TipoPrescricao.ATIVACAO_COMPORTAMENTAL, 0.9, 0.7), semente=1,
        )
        (linha,) = historico(self.conexao, reg.id)
        self.assertIs(linha.houve_sobrecarga, True)

    def test_precisao_exata_preservada(self):
        from sena_nucleo.prescricao import Prescricao, TipoPrescricao
        from sena_servico.repositorio import (
            criar_ou_obter_paciente,
            obter_paciente,
            registrar_semana,
        )

        reg, _ = criar_ou_obter_paciente(self.conexao, "a@x.com", "P", "Ansioso")
        semana, _, _ = registrar_semana(
            self.conexao, reg.id, Prescricao(TipoPrescricao.NENHUMA), semente=7
        )
        atualizado = obter_paciente(self.conexao, reg.id)
        self.assertEqual(atualizado.estado_atual, semana.estado_final)

    def test_reconstrucao_identica(self):
        from sena_nucleo.perfis import obter
        from sena_nucleo.prescricao import Prescricao, TipoPrescricao
        from sena_servico.repositorio import (
            criar_ou_obter_paciente,
            historico,
            reconstruir_semana,
            registrar_semana,
        )

        reg, _ = criar_ou_obter_paciente(self.conexao, "a@x.com", "P", "Obsessivo")
        semana, perfil, _ = registrar_semana(
            self.conexao, reg.id, Prescricao(TipoPrescricao.EXPOSICAO_GRADUAL, 0.8, 0.4),
            semente=99,
        )
        (linha,) = historico(self.conexao, reg.id)
        reconstruida = reconstruir_semana(linha, perfil)
        self.assertEqual(reconstruida.estado_final, semana.estado_final)


if __name__ == "__main__":
    unittest.main()

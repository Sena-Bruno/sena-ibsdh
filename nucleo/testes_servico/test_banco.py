"""Testes da camada de banco."""

import sqlite3
import unittest

from sena_servico.banco import banco_temporario, conectar


class TestConexao(unittest.TestCase):
    def test_cria_esquema_ao_conectar(self):
        with banco_temporario() as caminho:
            c = conectar(caminho)
            tabelas = {
                linha["name"]
                for linha in c.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                )
            }
            self.assertIn("pacientes", tabelas)
            self.assertIn("semanas", tabelas)

    def test_conectar_e_idempotente(self):
        """Conectar duas vezes ao mesmo arquivo não recria nem apaga nada."""
        with banco_temporario() as caminho:
            c1 = conectar(caminho)
            c1.execute(
                "INSERT INTO pacientes VALUES ('x','a@b.com','P','Ansioso',1,'{}','t','t')"
            )
            c1.commit()
            c2 = conectar(caminho)  # reabre o mesmo arquivo
            linhas = c2.execute("SELECT * FROM pacientes").fetchall()
            self.assertEqual(len(linhas), 1)

    def test_chaves_estrangeiras_ligadas(self):
        with banco_temporario() as caminho:
            c = conectar(caminho)
            valor = c.execute("PRAGMA foreign_keys").fetchone()[0]
            self.assertEqual(valor, 1)


class TestBancoTemporario(unittest.TestCase):
    def test_conexoes_diferentes_veem_os_mesmos_dados(self):
        """Diferente de `:memory:`: duas conexões precisam enxergar o
        mesmo banco, porque a API abre uma conexão por requisição."""
        with banco_temporario() as caminho:
            c1 = conectar(caminho)
            c2 = conectar(caminho)
            c1.execute(
                "INSERT INTO pacientes VALUES ('y','a@b.com','P','Ansioso',1,'{}','t','t')"
            )
            c1.commit()
            self.assertIsNotNone(
                c2.execute("SELECT id FROM pacientes WHERE id='y'").fetchone()
            )

    def test_apagado_ao_sair_do_bloco(self):
        import os

        with banco_temporario() as caminho:
            conectar(caminho)
            caminho_salvo = caminho
            self.assertTrue(os.path.exists(caminho_salvo))
        self.assertFalse(os.path.exists(caminho_salvo))

    def test_unique_aluno_curso(self):
        with banco_temporario() as caminho:
            c = conectar(caminho)
            c.execute(
                "INSERT INTO pacientes VALUES ('a','x@x.com','P','Ansioso',1,'{}','t','t')"
            )
            c.commit()
            with self.assertRaises(sqlite3.IntegrityError):
                c.execute(
                    "INSERT INTO pacientes VALUES ('b','x@x.com','P','Cético',1,'{}','t','t')"
                )


if __name__ == "__main__":
    unittest.main()

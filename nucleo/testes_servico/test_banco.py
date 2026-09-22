"""Testes da camada de banco."""

import unittest

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from sena_servico.banco import conectar, motor_de_teste


class TestMotorDeTeste(unittest.TestCase):
    def test_cria_esquema(self):
        engine = motor_de_teste()
        with engine.connect() as c:
            tabelas = {
                linha[0]
                for linha in c.execute(
                    text("SELECT name FROM sqlite_master WHERE type='table'")
                )
            }
            self.assertIn("pacientes", tabelas)
            self.assertIn("semanas", tabelas)

    def test_conexoes_diferentes_compartilham_o_mesmo_banco(self):
        """A API abre uma conexão por requisição — todas precisam ver os
        mesmos dados. Sem StaticPool, cada conexão a `:memory:` seria um
        banco novo e vazio."""
        engine = motor_de_teste()
        with engine.connect() as c1:
            c1.execute(
                text(
                    "INSERT INTO pacientes VALUES "
                    "('x','a@b.com','P','Ansioso',1,'{}','t','t')"
                )
            )
            c1.commit()
        with engine.connect() as c2:
            linha = c2.execute(text("SELECT id FROM pacientes WHERE id='x'")).fetchone()
            self.assertIsNotNone(linha)

    def test_unique_aluno_curso(self):
        engine = motor_de_teste()
        with engine.connect() as c:
            c.execute(
                text(
                    "INSERT INTO pacientes VALUES "
                    "('a','x@x.com','P','Ansioso',1,'{}','t','t')"
                )
            )
            c.commit()
            with self.assertRaises(IntegrityError):
                c.execute(
                    text(
                        "INSERT INTO pacientes VALUES "
                        "('b','x@x.com','P','Cético',1,'{}','t','t')"
                    )
                )
                c.commit()


class TestConectar(unittest.TestCase):
    def test_url_sqlite_de_arquivo_persiste_entre_conexoes(self):
        """`conectar` (produção/dev) versus `motor_de_teste` (só teste): a
        diferença é só a URL. Confirma que `conectar` não depende de
        StaticPool para funcionar com um arquivo real."""
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as pasta:
            url = f"sqlite:///{Path(pasta) / 'teste.db'}"
            engine1 = conectar(url)
            with engine1.connect() as c1:
                c1.execute(
                    text(
                        "INSERT INTO pacientes VALUES "
                        "('y','a@b.com','P','Ansioso',1,'{}','t','t')"
                    )
                )
                c1.commit()

            engine2 = conectar(url)  # reabre o mesmo arquivo
            with engine2.connect() as c2:
                linha = c2.execute(text("SELECT id FROM pacientes WHERE id='y'")).fetchone()
                self.assertIsNotNone(linha)


if __name__ == "__main__":
    unittest.main()

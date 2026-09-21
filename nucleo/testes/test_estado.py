"""Testes do vetor de estado."""

import unittest

from sena_nucleo.estado import DIMENSOES, EstadoPaciente, limitar


class TestLimites(unittest.TestCase):
    def test_prende_na_construcao(self):
        e = EstadoPaciente(alianca=2.5, risco=-1.0)
        self.assertEqual(e.alianca, 1.0)
        self.assertEqual(e.risco, 0.0)

    def test_prende_depois_de_somar(self):
        """Uma semana muito ruim não pode empurrar a dimensão abaixo de zero.

        Sem o limite, a esperança ficaria negativa e a semana seguinte
        precisaria 'subir' só para voltar ao chão — um poço invisível de
        que nenhuma condução tira o paciente.
        """
        e = EstadoPaciente(esperanca=0.05).com(esperanca=-0.9)
        self.assertEqual(e.esperanca, 0.0)

    def test_limitar_preserva_meio(self):
        self.assertEqual(limitar(0.42), 0.42)


class TestCom(unittest.TestCase):
    def test_soma_delta_nao_substitui(self):
        e = EstadoPaciente(alianca=0.5).com(alianca=0.2)
        self.assertAlmostEqual(e.alianca, 0.7)

    def test_nao_altera_o_original(self):
        original = EstadoPaciente(alianca=0.5)
        original.com(alianca=0.3)
        self.assertEqual(original.alianca, 0.5)

    def test_dimensao_inexistente_falha_alto(self):
        """Um nome errado seria um efeito clínico que nunca acontece."""
        with self.assertRaises(ValueError) as ctx:
            EstadoPaciente().com(aliansa=0.1)
        self.assertIn("aliansa", str(ctx.exception))


class TestComparacao(unittest.TestCase):
    def test_diferenca_ignora_ruido(self):
        a = EstadoPaciente(alianca=0.50)
        b = a.com(alianca=0.005)
        self.assertEqual(a.diferenca(b), {})

    def test_diferenca_reporta_o_relevante(self):
        a = EstadoPaciente(alianca=0.50)
        b = a.com(alianca=0.10)
        self.assertIn("alianca", a.diferenca(b))

    def test_melhorou_entende_dimensao_invertida(self):
        """Sofrimento caindo é melhora, não piora."""
        a = EstadoPaciente(sofrimento=0.8)
        self.assertTrue(a.melhorou(a.com(sofrimento=-0.2)))
        self.assertFalse(a.melhorou(a.com(sofrimento=+0.2)))

    def test_melhorou_entende_dimensao_normal(self):
        a = EstadoPaciente(esperanca=0.4)
        self.assertTrue(a.melhorou(a.com(esperanca=+0.2)))
        self.assertFalse(a.melhorou(a.com(esperanca=-0.2)))


class TestSerializacao(unittest.TestCase):
    def test_todas_as_dimensoes_presentes(self):
        d = EstadoPaciente().como_dicionario()
        self.assertEqual(set(d), set(DIMENSOES))


if __name__ == "__main__":
    unittest.main()

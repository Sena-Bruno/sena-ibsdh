"""Testes do briefing — e da separação entre o que o aluno vê e o que não vê."""

import unittest

from sena_nucleo.briefing import abertura_completa, fala_de_abertura, ficha_do_supervisor
from sena_nucleo.perfis import PERFIS, obter
from sena_nucleo.prescricao import Prescricao, TipoPrescricao
from sena_nucleo.semana import simular_semana

NADA = Prescricao(TipoPrescricao.NENHUMA)


class TestSeparacaoDeCamadas(unittest.TestCase):
    """O erro que mataria o recurso é vazar a leitura técnica para o aluno.

    Se ele lê "a aliança caiu 12% porque a prescrição estava acima da
    carga", não precisou perceber nada — e perceber é o trabalho clínico.
    """

    def _todas_as_falas(self):
        for perfil in PERFIS.values():
            for prescricao in (
                NADA,
                Prescricao(TipoPrescricao.ATIVACAO_COMPORTAMENTAL, 0.9, 0.15),
                Prescricao(TipoPrescricao.EXPOSICAO_GRADUAL, 0.2, 0.9),
            ):
                for semente in range(4):
                    semana = simular_semana(perfil.basal, perfil, prescricao, semente)
                    for fala in fala_de_abertura(semana, perfil):
                        yield perfil.nome, fala

    def test_o_paciente_nunca_da_numeros(self):
        """Ninguém diz 'cumpri 3 dos 7 dias'. Diz 'fiz umas vezes'."""
        for nome, fala in self._todas_as_falas():
            with self.subTest(perfil=nome, fala=fala):
                self.assertFalse(
                    any(caractere.isdigit() for caractere in fala),
                    "a fala do paciente não pode conter número",
                )

    def test_o_paciente_nunca_usa_vocabulario_tecnico(self):
        proibidas = ("aliança", "alianca", "adesão", "adesao", "prescrição",
                     "prescricao", "carga", "perfil", "sobrecarga", "dimensão")
        for nome, fala in self._todas_as_falas():
            with self.subTest(perfil=nome, fala=fala):
                for palavra in proibidas:
                    self.assertNotIn(palavra, fala.lower())

    def test_a_ficha_do_supervisor_da_os_numeros(self):
        """O contrapeso: depois da sessão, tudo é explícito."""
        dep = obter("Depressivo")
        semana = simular_semana(
            dep.basal, dep, Prescricao(TipoPrescricao.ATIVACAO_COMPORTAMENTAL, 0.9, 0.9), 1
        )
        ficha = ficha_do_supervisor(semana, dep)
        self.assertIn("dias_cumpridos", ficha)
        self.assertIn("taxa_de_adesao", ficha)
        self.assertIn("estado_final", ficha)


class TestFalaDeAbertura(unittest.TestCase):
    def test_semana_vazia_nao_inventa_assunto(self):
        """O vazio é informação clínica; o aluno tem que trabalhar com ele."""
        intel = obter("Intelectualizador")
        # Semente escolhida por não sortear nenhum evento nos sete dias.
        vazias = [
            s for s in range(200)
            if not simular_semana(intel.basal, intel, NADA, s).eventos
        ]
        self.assertTrue(vazias, "esperava ao menos uma semana sem eventos")
        semana = simular_semana(intel.basal, intel, NADA, vazias[0])
        self.assertEqual(
            fala_de_abertura(semana, intel),
            ("Foi uma semana normal. Não tenho muito o que contar.",),
        )

    def test_nao_repete_o_mesmo_evento(self):
        """Quem teve insônia na segunda e na sexta conta insônia uma vez."""
        for perfil in PERFIS.values():
            for semente in range(20):
                semana = simular_semana(perfil.basal, perfil, NADA, semente)
                falas = fala_de_abertura(semana, perfil)
                with self.subTest(perfil=perfil.nome, semente=semente):
                    self.assertEqual(len(falas), len(set(falas)))

    def test_sem_prescricao_nao_comenta_tarefa(self):
        ans = obter("Ansioso")
        semana = simular_semana(ans.basal, ans, NADA, 3)
        for fala in fala_de_abertura(semana, ans):
            self.assertNotIn("combinamos", fala.lower())
            self.assertNotIn("combinou", fala.lower())

    def test_com_prescricao_sempre_comenta_a_tarefa(self):
        ans = obter("Ansioso")
        p = Prescricao(TipoPrescricao.RESPIRATORIA, 0.9, 0.3)
        semana = simular_semana(ans.basal, ans, p, 3)
        self.assertGreater(len(fala_de_abertura(semana, ans)), len(semana.eventos) - 1)


class TestAberturaCompleta(unittest.TestCase):
    def test_entrega_fala_e_corpo(self):
        ans = obter("Ansioso")
        semana = simular_semana(ans.basal, ans, NADA, 1)
        abertura = abertura_completa(semana, ans)
        self.assertEqual(abertura["perfil"], "Ansioso")
        self.assertTrue(abertura["fala"])
        self.assertTrue(abertura["corpo"])
        self.assertIn("respiracao_por_minuto", abertura["sinais"])


class TestLeituraDoSupervisor(unittest.TestCase):
    def test_nomeia_sobrecarga_em_vez_de_resistencia(self):
        """O achado que o aluno não conseguiria ver sozinho."""
        dep = obter("Depressivo")
        semana = simular_semana(
            dep.basal, dep, Prescricao(TipoPrescricao.ATIVACAO_COMPORTAMENTAL, 0.9, 0.9), 2
        )
        leitura = " ".join(ficha_do_supervisor(semana, dep)["leitura"])
        self.assertIn("dose", leitura)
        self.assertIn("não é resistência", leitura)

    def test_aponta_prescricao_vaga(self):
        ans = obter("Ansioso")
        semana = simular_semana(
            ans.basal, ans, Prescricao(TipoPrescricao.RESPIRATORIA, 0.05, 0.2), 4
        )
        if semana.taxa_de_adesao <= 0.3:
            leitura = " ".join(ficha_do_supervisor(semana, ans)["leitura"])
            self.assertIn("cumprível", leitura)

    def test_risco_alto_sem_plano_de_seguranca_e_o_achado_mais_grave(self):
        dep = obter("Depressivo")
        arriscado = dep.basal.com(risco=+0.3)
        semana = simular_semana(arriscado, dep, NADA, 5)
        ficha = ficha_do_supervisor(semana, dep)
        self.assertTrue(
            any("plano de" in linha for linha in ficha["leitura"]),
            f"esperava o achado de segurança, veio: {ficha['leitura']}",
        )

    def test_separa_ganhos_de_perdas_com_o_sinal_certo(self):
        """Sofrimento caindo é ganho, não perda."""
        dep = obter("Depressivo")
        semana = simular_semana(dep.basal, dep, NADA, 6)
        ficha = ficha_do_supervisor(semana, dep)
        for dimensao, delta in ficha["ganhos"]:
            if dimensao in ("sofrimento", "risco"):
                self.assertLess(delta, 0)
            else:
                self.assertGreater(delta, 0)


if __name__ == "__main__":
    unittest.main()

"""Testes da tradução estado → corpo observável."""

import unittest

from sena_nucleo.corpo import descrever, ler_corpo, sinais_de_alerta
from sena_nucleo.estado import EstadoPaciente
from sena_nucleo.perfis import PERFIS, obter


class TestFaixas(unittest.TestCase):
    def test_sinais_normalizados_ficam_na_faixa(self):
        extremos = [
            EstadoPaciente(**{d: v for d in ("alianca", "sofrimento", "abertura",
                                             "esperanca", "adesao", "risco", "energia")})
            for v in (0.0, 0.5, 1.0)
        ]
        for perfil in PERFIS.values():
            for estado in extremos:
                with self.subTest(perfil=perfil.nome):
                    s = ler_corpo(estado, perfil)
                    for nome in ("variabilidade_respiratoria", "contato_visual",
                                 "micro_tensao", "presenca"):
                        self.assertTrue(0.0 <= getattr(s, nome) <= 1.0)

    def test_valores_fisiologicos_plausiveis(self):
        for perfil in PERFIS.values():
            with self.subTest(perfil=perfil.nome):
                s = ler_corpo(perfil.basal, perfil)
                self.assertGreaterEqual(s.respiracao_por_minuto, 6.0)
                self.assertGreater(s.latencia_de_resposta, 0.0)
                self.assertGreaterEqual(s.velocidade_da_fala, 40.0)

    def test_determinismo(self):
        ans = obter("Ansioso")
        self.assertEqual(ler_corpo(ans.basal, ans), ler_corpo(ans.basal, ans))


class TestPerfisTemCorposDistintos(unittest.TestCase):
    def test_ansioso_acelera_e_depressivo_desacelera(self):
        """Dois pacientes com o mesmo sofrimento não têm o mesmo corpo."""
        mesmo = EstadoPaciente(sofrimento=0.7, energia=0.5, alianca=0.4)
        ansioso = ler_corpo(mesmo, obter("Ansioso"))
        depressivo = ler_corpo(mesmo, obter("Depressivo"))
        self.assertGreater(ansioso.respiracao_por_minuto, depressivo.respiracao_por_minuto)
        self.assertGreater(ansioso.velocidade_da_fala, depressivo.velocidade_da_fala)
        self.assertLess(ansioso.latencia_de_resposta, depressivo.latencia_de_resposta)

    def test_dissociado_tem_a_menor_presenca(self):
        mesmo = EstadoPaciente(sofrimento=0.6, energia=0.5, abertura=0.4, risco=0.3)
        presencas = {
            nome: ler_corpo(mesmo, perfil).presenca for nome, perfil in PERFIS.items()
        }
        self.assertEqual(min(presencas, key=presencas.get), "Dissociado")

    def test_evitativo_tem_o_menor_contato_visual(self):
        mesmo = EstadoPaciente(abertura=0.5, alianca=0.5)
        contatos = {
            nome: ler_corpo(mesmo, perfil).contato_visual for nome, perfil in PERFIS.items()
        }
        self.assertEqual(min(contatos, key=contatos.get), "Evitativo")


class TestRelacoesClinicas(unittest.TestCase):
    def test_sofrimento_acelera_a_respiracao(self):
        p = obter("Cético")
        calmo = ler_corpo(EstadoPaciente(sofrimento=0.1), p)
        aflito = ler_corpo(EstadoPaciente(sofrimento=0.9), p)
        self.assertGreater(aflito.respiracao_por_minuto, calmo.respiracao_por_minuto)

    def test_alianca_afrouxa_a_tensao(self):
        p = obter("Cético")
        base = EstadoPaciente(sofrimento=0.7, alianca=0.1)
        self.assertLess(
            ler_corpo(base.com(alianca=+0.8), p).micro_tensao,
            ler_corpo(base, p).micro_tensao,
        )

    def test_risco_alto_derruba_a_presenca(self):
        """O paciente vai embora de dentro antes de ir embora da sala."""
        p = obter("Cético")
        base = EstadoPaciente(energia=0.6, abertura=0.5, risco=0.1)
        self.assertLess(
            ler_corpo(base.com(risco=+0.8), p).presenca, ler_corpo(base, p).presenca
        )


class TestDescricaoNaoInterpreta(unittest.TestCase):
    """A regra de ouro do módulo: exibir o sinal, nunca a leitura dele.

    No instante em que o simulador entrega a conclusão pronta, ele para de
    treinar calibração e passa a treinar leitura de legenda.
    """

    PALAVRAS_PROIBIDAS = (
        "resist", "aliança", "alianca", "ansios", "depress", "dissoci",
        "risco", "abertura", "esperança", "esperanca", "adesão", "adesao",
        "sofrimento", "perfil",
    )

    def test_nenhuma_frase_nomeia_o_mecanismo(self):
        for perfil in PERFIS.values():
            for estado in (perfil.basal, EstadoPaciente(), EstadoPaciente(sofrimento=1.0)):
                for frase in descrever(ler_corpo(estado, perfil)):
                    with self.subTest(perfil=perfil.nome, frase=frase):
                        minuscula = frase.lower()
                        for proibida in self.PALAVRAS_PROIBIDAS:
                            self.assertNotIn(proibida, minuscula)

    def test_sempre_devolve_ao_menos_uma_frase(self):
        for perfil in PERFIS.values():
            with self.subTest(perfil=perfil.nome):
                self.assertTrue(descrever(ler_corpo(perfil.basal, perfil)))


class TestAlertas(unittest.TestCase):
    def test_risco_alto_dispara(self):
        p = obter("Depressivo")
        estado = p.basal.com(risco=+0.4)
        alertas = " ".join(sinais_de_alerta(ler_corpo(estado, p), estado))
        self.assertIn("segurança", alertas)

    def test_paciente_estavel_nao_dispara(self):
        p = obter("Intelectualizador")
        estado = EstadoPaciente(
            alianca=0.8, sofrimento=0.3, abertura=0.6,
            esperanca=0.7, adesao=0.7, risco=0.05, energia=0.8,
        )
        self.assertEqual(sinais_de_alerta(ler_corpo(estado, p), estado), ())


if __name__ == "__main__":
    unittest.main()

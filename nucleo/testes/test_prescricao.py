"""Testes do modelo de prescrição — onde mora a lição de titulação."""

import unittest

from sena_nucleo.estado import EstadoPaciente
from sena_nucleo.perfis import obter
from sena_nucleo.prescricao import (
    Prescricao,
    TipoPrescricao,
    ajuste_ao_perfil,
    efeito_de_um_dia,
    excesso_de_carga,
    peso_da_falha,
    probabilidade_de_adesao,
)


class TestValidacao(unittest.TestCase):
    def test_recusa_fora_da_faixa(self):
        with self.assertRaises(ValueError):
            Prescricao(TipoPrescricao.REGISTRO, especificidade=1.4)
        with self.assertRaises(ValueError):
            Prescricao(TipoPrescricao.REGISTRO, carga=-0.1)


class TestAjusteAoPerfil(unittest.TestCase):
    def test_indicada_vale_mais_que_morna_que_contraindicada(self):
        dep = obter("Depressivo")
        indicada = ajuste_ao_perfil(
            Prescricao(TipoPrescricao.ATIVACAO_COMPORTAMENTAL), dep
        )
        morna = ajuste_ao_perfil(Prescricao(TipoPrescricao.RESPIRATORIA), dep)
        contra = ajuste_ao_perfil(Prescricao(TipoPrescricao.EXPOSICAO_GRADUAL), dep)
        self.assertGreater(indicada, morna)
        self.assertGreater(morna, contra)
        self.assertLess(contra, 0)

    def test_nenhuma_e_neutra(self):
        self.assertEqual(
            ajuste_ao_perfil(Prescricao(TipoPrescricao.NENHUMA), obter("Ansioso")), 0.0
        )

    def test_contraindicada_inverte_o_efeito(self):
        """Ancoragem num Cético não é só ineficaz: gasta a aliança."""
        cet = obter("Cético")
        efeitos = efeito_de_um_dia(
            Prescricao(TipoPrescricao.ANCORAGEM, carga=0.3), cet, cumpriu=True
        )
        self.assertGreater(efeitos["sofrimento"], 0)


class TestCarga(unittest.TestCase):
    def test_teto_e_o_mais_apertado_dos_dois(self):
        """Obsessivo tem teto estrutural alto, mas se chegar exausto vale
        a exaustão."""
        obs = obter("Obsessivo")  # carga_tolerada 0.75
        exausto = EstadoPaciente(energia=0.20)
        p = Prescricao(TipoPrescricao.EXPOSICAO_GRADUAL, carga=0.60)
        self.assertGreater(excesso_de_carga(p, obs, exausto), 0)
        self.assertEqual(excesso_de_carga(p, obs, EstadoPaciente(energia=0.9)), 0.0)

    def test_nenhuma_nunca_sobrecarrega(self):
        dep = obter("Depressivo")
        p = Prescricao(TipoPrescricao.NENHUMA, carga=1.0)
        self.assertEqual(excesso_de_carga(p, dep, dep.basal), 0.0)


class TestAdesao(unittest.TestCase):
    def test_sem_alianca_a_adesao_despenca(self):
        """Nenhuma dose de clareza compensa vínculo ausente."""
        dep = obter("Depressivo")
        p = Prescricao(TipoPrescricao.ATIVACAO_COMPORTAMENTAL, 1.0, 0.1)
        com = probabilidade_de_adesao(p, dep, dep.basal.com(alianca=+0.5))
        sem = probabilidade_de_adesao(p, dep, dep.basal.com(alianca=-0.5))
        self.assertGreater(com, sem)

    def test_vagueza_reduz_adesao(self):
        """'Tente relaxar mais' não é prescrição."""
        ans = obter("Ansioso")
        clara = Prescricao(TipoPrescricao.RESPIRATORIA, especificidade=1.0, carga=0.3)
        vaga = Prescricao(TipoPrescricao.RESPIRATORIA, especificidade=0.0, carga=0.3)
        self.assertGreater(
            probabilidade_de_adesao(clara, ans, ans.basal),
            probabilidade_de_adesao(vaga, ans, ans.basal),
        )

    def test_sobrecarga_derruba_a_viabilidade(self):
        dep = obter("Depressivo")
        leve = Prescricao(TipoPrescricao.ATIVACAO_COMPORTAMENTAL, 0.9, 0.15)
        pesada = Prescricao(TipoPrescricao.ATIVACAO_COMPORTAMENTAL, 0.9, 0.80)
        self.assertGreater(
            probabilidade_de_adesao(leve, dep, dep.basal),
            probabilidade_de_adesao(pesada, dep, dep.basal) * 3,
        )

    def test_nenhuma_tem_adesao_zero(self):
        ans = obter("Ansioso")
        self.assertEqual(
            probabilidade_de_adesao(Prescricao(TipoPrescricao.NENHUMA), ans, ans.basal),
            0.0,
        )

    def test_sempre_na_faixa(self):
        ans = obter("Ansioso")
        for esp in (0.0, 0.5, 1.0):
            for carga in (0.0, 0.5, 1.0):
                p = Prescricao(TipoPrescricao.RESPIRATORIA, esp, carga)
                valor = probabilidade_de_adesao(p, ans, ans.basal)
                self.assertTrue(0.0 <= valor <= 1.0)


class TestPesoDaFalha(unittest.TestCase):
    def test_falhar_pedido_grande_fere_mais(self):
        """Não cumprir 'abrir a janela' e não cumprir 'correr 30 minutos'
        são a mesma linha no diário e ferimentos diferentes."""
        self.assertGreater(peso_da_falha(0.9), peso_da_falha(0.1))

    def test_falhar_nunca_e_de_graca(self):
        """Combinar e não fazer sempre custa alguma coisa."""
        self.assertGreater(peso_da_falha(0.0), 0.0)

    def test_falha_sempre_tira_esperanca(self):
        dep = obter("Depressivo")
        p = Prescricao(TipoPrescricao.ATIVACAO_COMPORTAMENTAL, 0.9, 0.5)
        self.assertLess(efeito_de_um_dia(p, dep, cumpriu=False)["esperanca"], 0)


class TestCustoEnergetico(unittest.TestCase):
    def test_cumprir_custa_energia(self):
        """Sem custo, a receita ótima seria 'prescreva o máximo'."""
        obs = obter("Obsessivo")
        leve = efeito_de_um_dia(
            Prescricao(TipoPrescricao.ANCORAGEM, carga=0.1), obs, cumpriu=True
        )
        pesada = efeito_de_um_dia(
            Prescricao(TipoPrescricao.ANCORAGEM, carga=1.0), obs, cumpriu=True
        )
        self.assertLess(pesada["energia"], leve["energia"])


if __name__ == "__main__":
    unittest.main()

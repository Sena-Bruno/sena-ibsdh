"""Testes de integridade dos perfis clínicos."""

import unittest

from sena_nucleo.perfis import PERFIS, obter
from sena_nucleo.prescricao import TipoPrescricao


class TestCatalogo(unittest.TestCase):
    def test_os_oito_perfis_do_simulador(self):
        """Os mesmos oito de `src/views/SimuladorView.vue`.

        Se este teste quebrar, o front e o motor divergiram — o aluno
        treinaria contra um paciente e seria avaliado contra outro.
        """
        self.assertEqual(
            set(PERFIS),
            {
                "Ansioso", "Cético", "Evitativo", "Intelectualizador",
                "Dissociado", "Depressivo", "Histriônico", "Obsessivo",
            },
        )

    def test_chave_bate_com_o_nome(self):
        for chave, perfil in PERFIS.items():
            self.assertEqual(chave, perfil.nome)

    def test_todo_perfil_tem_texto_clinico(self):
        for perfil in PERFIS.values():
            with self.subTest(perfil=perfil.nome):
                self.assertTrue(perfil.descricao.strip())
                self.assertTrue(perfil.resistencias)
                self.assertTrue(perfil.abordagem_ideal.strip())


class TestIntegridadeDaFisica(unittest.TestCase):
    def test_prescricoes_citadas_existem(self):
        """Um nome de prescrição com erro de digitação seria silencioso.

        `ajuste_ao_perfil` cai no caso morno quando não encontra o nome nas
        listas, então 'ANCORAJEM' não levantaria erro nenhum: o perfil
        simplesmente perderia a indicação dele, e a calibração inteira
        daquele perfil ficaria errada sem nenhum sintoma.
        """
        validos = {tipo.name for tipo in TipoPrescricao}
        for perfil in PERFIS.values():
            with self.subTest(perfil=perfil.nome):
                self.assertLessEqual(set(perfil.indicadas), validos)
                self.assertLessEqual(set(perfil.contraindicadas), validos)

    def test_indicada_e_contraindicada_nao_se_sobrepoem(self):
        for perfil in PERFIS.values():
            with self.subTest(perfil=perfil.nome):
                self.assertFalse(set(perfil.indicadas) & set(perfil.contraindicadas))

    def test_deriva_usa_dimensoes_reais(self):
        """A deriva é aplicada com `com(**deriva)`, que valida — mas só em
        tempo de execução, dentro da semana. Aqui a checagem é estática."""
        from sena_nucleo.estado import DIMENSOES

        for perfil in PERFIS.values():
            with self.subTest(perfil=perfil.nome):
                self.assertLessEqual(set(perfil.deriva), set(DIMENSOES))

    def test_carga_tolerada_na_faixa(self):
        for perfil in PERFIS.values():
            with self.subTest(perfil=perfil.nome):
                self.assertTrue(0.0 < perfil.carga_tolerada <= 1.0)

    def test_depressivo_tolera_menos_que_obsessivo(self):
        """A relação clínica que sustenta a lição de titulação."""
        self.assertLess(
            PERFIS["Depressivo"].carga_tolerada, PERFIS["Obsessivo"].carga_tolerada
        )


class TestBusca(unittest.TestCase):
    def test_erro_lista_os_conhecidos(self):
        """Os nomes vêm de planilha, onde o acento some com frequência."""
        with self.assertRaises(KeyError) as ctx:
            obter("Cetico")
        self.assertIn("Cético", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()

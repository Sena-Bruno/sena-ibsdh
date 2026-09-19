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

    def test_taxa_de_retorno_na_faixa_da_literatura(self):
        """Sem tratamento, os sintomas caem 10–15% ao longo de ~10 semanas.

        Uma taxa muito alta faria o tempo curar mais do que a terapia, que
        é a pior lição que um simulador de formação clínica poderia dar.
        """
        for perfil in PERFIS.values():
            with self.subTest(perfil=perfil.nome):
                self.assertTrue(0.0 < perfil.taxa_de_retorno <= 0.02)

    def test_equilibrio_alivia_o_sofrimento_da_chegada(self):
        """Ninguém chega no próprio nível habitual — chega na crise.

        Se o equilíbrio tivesse sofrimento igual ou maior que o basal, o
        perfil perderia o mecanismo de regressão à média que a literatura
        de lista de espera descreve.
        """
        for perfil in PERFIS.values():
            with self.subTest(perfil=perfil.nome):
                self.assertLess(perfil.equilibrio.sofrimento, perfil.basal.sofrimento)

    def test_equilibrio_nao_e_saude(self):
        """O Depressivo regride para um estado ainda deprimido.

        O tempo resolve a distância entre a crise e o fundo habitual. Tudo
        abaixo disso é o que só o tratamento alcança — e um equilíbrio
        saudável faria o simulador ensinar que basta esperar.
        """
        dep = PERFIS["Depressivo"].equilibrio
        self.assertLess(dep.esperanca, 0.45)
        self.assertLess(dep.energia, 0.45)
        self.assertGreater(dep.sofrimento, 0.45)

    def test_tres_perfis_pioram_numa_dimensao_nomeada(self):
        """Onde mora o "não fazer nada custa", perfil a perfil."""
        self.assertLess(PERFIS["Cético"].equilibrio.alianca,
                        PERFIS["Cético"].basal.alianca)
        self.assertLess(PERFIS["Evitativo"].equilibrio.abertura,
                        PERFIS["Evitativo"].basal.abertura)
        self.assertLess(PERFIS["Histriônico"].equilibrio.adesao,
                        PERFIS["Histriônico"].basal.adesao)

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

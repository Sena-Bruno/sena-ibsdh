"""Testes da API — o contrato HTTP.

Cada teste isola seu próprio banco temporário via `override` da
dependência `obter_conexao`. Sem isso, todos os testes compartilhariam o
arquivo `sena_servico.sqlite3` de desenvolvimento — o tipo de vazamento de
estado entre testes que produz falha intermitente e ninguém consegue
reproduzir depois.
"""

import unittest

from fastapi.testclient import TestClient

from sena_servico import api, banco


class ComCliente(unittest.TestCase):
    def setUp(self):
        self._ctx = banco.banco_temporario()
        caminho = self._ctx.__enter__()
        self.addCleanup(self._ctx.__exit__, None, None, None)

        def conexao_de_teste():
            conexao = banco.conectar(caminho)
            try:
                yield conexao
            finally:
                conexao.close()

        api.app.dependency_overrides[api.obter_conexao] = conexao_de_teste
        self.addCleanup(api.app.dependency_overrides.clear)
        self.cliente = TestClient(api.app)


class TestDiagnostico(ComCliente):
    def test_sem_narrador_configurado(self):
        resposta = self.cliente.get("/diagnostico")
        self.assertEqual(resposta.status_code, 200)
        corpo = resposta.json()
        self.assertFalse(corpo["narrador_configurado"])
        self.assertEqual(len(corpo["perfis_disponiveis"]), 8)


class TestPerfis(ComCliente):
    def test_lista_os_oito(self):
        resposta = self.cliente.get("/perfis")
        corpo = resposta.json()
        self.assertEqual(len(corpo), 8)
        self.assertIn("Depressivo", corpo)
        self.assertIn("basal", corpo["Depressivo"])
        self.assertIn("descricao", corpo["Depressivo"])


class TestCriarPaciente(ComCliente):
    def test_cria_e_devolve_201(self):
        resposta = self.cliente.post(
            "/pacientes",
            json={"aluno_email": "a@ibsdh.com", "curso": "Practitioner",
                  "perfil": "Depressivo"},
        )
        self.assertEqual(resposta.status_code, 201)
        corpo = resposta.json()
        self.assertTrue(corpo["criado_agora"])
        self.assertEqual(corpo["numero_sessao"], 1)
        self.assertIn("esperanca", corpo["estado_atual"])

    def test_perfil_invalido_e_422(self):
        resposta = self.cliente.post(
            "/pacientes",
            json={"aluno_email": "a@ibsdh.com", "curso": "P", "perfil": "Ghost"},
        )
        self.assertEqual(resposta.status_code, 422)

    def test_repetir_a_chamada_nao_duplica(self):
        primeira = self.cliente.post(
            "/pacientes",
            json={"aluno_email": "a@ibsdh.com", "curso": "P", "perfil": "Ansioso"},
        ).json()
        segunda = self.cliente.post(
            "/pacientes",
            json={"aluno_email": "a@ibsdh.com", "curso": "P", "perfil": "Cético"},
        ).json()
        self.assertEqual(primeira["id"], segunda["id"])
        self.assertFalse(segunda["criado_agora"])
        self.assertEqual(segunda["perfil"], "Ansioso")  # o primeiro prevalece

    def test_corpo_invalido_e_422_nao_500(self):
        """Carga fora de [0, 1] deve virar erro de validação, não estourar
        dentro do motor com um ValueError cru vazando pra fora."""
        resposta = self.cliente.post(
            "/pacientes",
            json={"aluno_email": "a@x.com", "curso": "P"},  # falta 'perfil'
        )
        self.assertEqual(resposta.status_code, 422)


class TestObterPaciente(ComCliente):
    def test_404_quando_nao_existe(self):
        resposta = self.cliente.get("/pacientes/id-fantasma")
        self.assertEqual(resposta.status_code, 404)

    def test_200_apos_criar(self):
        criado = self.cliente.post(
            "/pacientes",
            json={"aluno_email": "a@x.com", "curso": "P", "perfil": "Obsessivo"},
        ).json()
        resposta = self.cliente.get(f"/pacientes/{criado['id']}")
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["perfil"], "Obsessivo")


class TestRegistrarSessao(ComCliente):
    def _criar(self, perfil="Depressivo"):
        return self.cliente.post(
            "/pacientes",
            json={"aluno_email": "a@x.com", "curso": "P", "perfil": perfil},
        ).json()

    def test_avanca_a_sessao_e_devolve_abertura_e_ficha(self):
        paciente = self._criar()
        resposta = self.cliente.post(
            f"/pacientes/{paciente['id']}/sessoes",
            json={"tipo": "NENHUMA"},
        )
        self.assertEqual(resposta.status_code, 200)
        corpo = resposta.json()
        self.assertEqual(corpo["numero_sessao_concluida"], 1)
        self.assertEqual(corpo["narrador"], "fixo")  # sem env configurado
        self.assertIn("fala", corpo["abertura"])
        self.assertIn("corpo", corpo["abertura"])
        self.assertIn("leitura", corpo["ficha"])

    def test_estado_persiste_entre_duas_chamadas(self):
        """A memória real, vista pela borda HTTP."""
        paciente = self._criar("Ansioso")
        self.cliente.post(
            f"/pacientes/{paciente['id']}/sessoes", json={"tipo": "NENHUMA"}
        )
        depois = self.cliente.get(f"/pacientes/{paciente['id']}").json()
        self.assertEqual(depois["numero_sessao"], 2)
        self.assertNotEqual(
            depois["estado_atual"], paciente["estado_atual"]
        )

    def test_tipo_de_prescricao_invalido_e_422(self):
        paciente = self._criar()
        resposta = self.cliente.post(
            f"/pacientes/{paciente['id']}/sessoes",
            json={"tipo": "VOAR"},
        )
        self.assertEqual(resposta.status_code, 422)

    def test_carga_fora_da_faixa_e_422(self):
        paciente = self._criar()
        resposta = self.cliente.post(
            f"/pacientes/{paciente['id']}/sessoes",
            json={"tipo": "REGISTRO", "carga": 1.5},
        )
        self.assertEqual(resposta.status_code, 422)

    def test_paciente_inexistente_e_404(self):
        resposta = self.cliente.post(
            "/pacientes/fantasma/sessoes", json={"tipo": "NENHUMA"}
        )
        self.assertEqual(resposta.status_code, 404)

    def test_a_fala_nunca_carrega_numero(self):
        """A garantia da etapa 2, vista pela borda HTTP: mesmo sem
        narrador configurado (caindo no texto fixo), nada na fala do
        paciente pode ser um algarismo."""
        paciente = self._criar("Depressivo")
        corpo = self.cliente.post(
            f"/pacientes/{paciente['id']}/sessoes",
            json={"tipo": "ATIVACAO_COMPORTAMENTAL", "carga": 0.15,
                  "especificidade": 0.9},
        ).json()
        for fala in corpo["abertura"]["fala"]:
            self.assertFalse(any(c.isdigit() for c in fala), fala)


class TestHistorico(ComCliente):
    def test_cresce_a_cada_sessao(self):
        paciente = self.cliente.post(
            "/pacientes",
            json={"aluno_email": "a@x.com", "curso": "P", "perfil": "Ansioso"},
        ).json()
        for _ in range(3):
            self.cliente.post(
                f"/pacientes/{paciente['id']}/sessoes", json={"tipo": "NENHUMA"}
            )
        historico = self.cliente.get(
            f"/pacientes/{paciente['id']}/historico"
        ).json()
        self.assertEqual(len(historico), 3)
        self.assertEqual([h["numero_sessao"] for h in historico], [1, 2, 3])

    def test_404_para_paciente_inexistente(self):
        resposta = self.cliente.get("/pacientes/fantasma/historico")
        self.assertEqual(resposta.status_code, 404)


if __name__ == "__main__":
    unittest.main()

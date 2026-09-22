"""Testes da API — o contrato HTTP, com autenticação real.

Cada teste isola seu próprio banco (via override de `obter_conexao`) E seu
próprio par segredo/lista-do-piloto (via `patch.dict` no ambiente) — sem
isso, testes vazariam configuração uns para os outros através de variáveis
de processo compartilhadas.
"""

import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from sena_servico import api, banco
from sena_servico.autenticacao import _emitir_token_para_teste

SEGREDO = "segredo-de-teste-da-api"
ALUNO = "aluno-piloto@ibsdh.com.br"
OUTRO_ALUNO = "outro-piloto@ibsdh.com.br"
FORA_DO_PILOTO = "nao-autorizado@ibsdh.com.br"


class ComCliente(unittest.TestCase):
    def setUp(self):
        engine = banco.motor_de_teste()

        def conexao_de_teste():
            conexao = engine.connect()
            try:
                yield conexao
            finally:
                conexao.close()

        api.app.dependency_overrides[api.obter_conexao] = conexao_de_teste
        self.addCleanup(api.app.dependency_overrides.clear)

        self._patch_env = patch.dict(
            os.environ,
            {
                "SENA_SESSION_SECRET": SEGREDO,
                "SENA_EMAILS_PILOTO": f"{ALUNO},{OUTRO_ALUNO}",
            },
        )
        self._patch_env.start()
        self.addCleanup(self._patch_env.stop)

        self.cliente = TestClient(api.app)

    def token_de(self, email: str) -> str:
        return _emitir_token_para_teste(email, SEGREDO)

    def cabecalho_de(self, email: str) -> dict:
        return {"Authorization": f"Bearer {self.token_de(email)}"}


class TestSaudePublica(ComCliente):
    def test_saude_nao_exige_autenticacao(self):
        """Health check de orquestrador (Render) não tem como carregar
        token — esta rota tem que responder sem um."""
        resposta = self.cliente.get("/saude")
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json(), {"ok": True})

    def test_saude_nao_vaza_configuracao(self):
        resposta = self.cliente.get("/saude").json()
        self.assertEqual(set(resposta), {"ok"})


class TestCORS(ComCliente):
    """O Vue chama este serviço de outro host (Render, não Netlify — ver o
    comentário de CORSMiddleware em api.py). Sem o cabeçalho certo, o
    navegador bloqueia a resposta antes de ela chegar ao componente."""

    def test_dominio_proprio_de_producao_e_liberado(self):
        """O site aponta para o domínio próprio, não para o *.netlify.app
        cru — foi isto que quebrou em produção antes deste teste existir:
        o CORS liberava só o subdomínio padrão do Netlify, e o navegador
        bloqueava toda chamada feita a partir do domínio de verdade."""
        resposta = self.cliente.get(
            "/saude", headers={"Origin": "https://simulador.institutobrunosena.com.br"}
        )
        self.assertEqual(
            resposta.headers.get("access-control-allow-origin"),
            "https://simulador.institutobrunosena.com.br",
        )

    def test_subdominio_padrao_do_netlify_tambem_e_liberado(self):
        resposta = self.cliente.get(
            "/saude", headers={"Origin": "https://sena-ibsdh.netlify.app"}
        )
        self.assertEqual(
            resposta.headers.get("access-control-allow-origin"),
            "https://sena-ibsdh.netlify.app",
        )

    def test_deploy_preview_e_liberado(self):
        resposta = self.cliente.get(
            "/saude", headers={"Origin": "https://deploy-preview-32--sena-ibsdh.netlify.app"}
        )
        self.assertEqual(
            resposta.headers.get("access-control-allow-origin"),
            "https://deploy-preview-32--sena-ibsdh.netlify.app",
        )

    def test_origem_arbitraria_nao_e_liberada(self):
        """Um site qualquer forjando o cabeçalho Origin não pode ganhar o
        header de CORS — sem isto, um token roubado valeria de qualquer
        lugar que embutisse uma chamada a este serviço."""
        resposta = self.cliente.get(
            "/saude", headers={"Origin": "https://site-malicioso.example"}
        )
        self.assertNotIn("access-control-allow-origin", resposta.headers)


class TestAutenticacao(ComCliente):
    def test_sem_cabecalho_e_401(self):
        resposta = self.cliente.get("/perfis")
        self.assertEqual(resposta.status_code, 401)

    def test_token_invalido_e_401(self):
        resposta = self.cliente.get("/perfis", headers={"Authorization": "Bearer lixo"})
        self.assertEqual(resposta.status_code, 401)

    def test_token_valido_mas_fora_do_piloto_e_403(self):
        resposta = self.cliente.get("/perfis", headers=self.cabecalho_de(FORA_DO_PILOTO))
        self.assertEqual(resposta.status_code, 403)

    def test_token_valido_e_no_piloto_passa(self):
        resposta = self.cliente.get("/perfis", headers=self.cabecalho_de(ALUNO))
        self.assertEqual(resposta.status_code, 200)

    def test_piloto_vazio_e_503_nao_libera_geral(self):
        """Sem NINGUÉM configurado, a rota tem que RECUSAR — não virar
        'sem lista, libera todo mundo'."""
        with patch.dict(os.environ, {"SENA_EMAILS_PILOTO": ""}):
            resposta = self.cliente.get("/perfis", headers=self.cabecalho_de(ALUNO))
        self.assertEqual(resposta.status_code, 503)

    def test_email_do_piloto_e_case_insensitive(self):
        resposta = self.cliente.get("/perfis", headers=self.cabecalho_de(ALUNO.upper()))
        self.assertEqual(resposta.status_code, 200)


class TestCriarPaciente(ComCliente):
    def test_cria_com_o_email_do_TOKEN_nunca_do_corpo(self):
        """A troca que fecha F1/F2 no resto do SENA: o e-mail vem da
        sessão, não de um campo que o cliente poderia forjar."""
        resposta = self.cliente.post(
            "/pacientes", json={"curso": "Practitioner", "perfil": "Depressivo"},
            headers=self.cabecalho_de(ALUNO),
        )
        self.assertEqual(resposta.status_code, 201)
        corpo = resposta.json()
        self.assertTrue(corpo["criado_agora"])
        self.assertNotIn("estado_atual", corpo, "resposta não pode vazar o estado numérico")
        self.assertNotIn("aluno_email", corpo, "resposta não precisa nem deveria ecoar o e-mail")

    def test_perfil_invalido_e_422(self):
        resposta = self.cliente.post(
            "/pacientes", json={"curso": "P", "perfil": "Ghost"},
            headers=self.cabecalho_de(ALUNO),
        )
        self.assertEqual(resposta.status_code, 422)

    def test_dois_alunos_do_piloto_tem_casos_separados(self):
        um = self.cliente.post(
            "/pacientes", json={"curso": "P", "perfil": "Ansioso"},
            headers=self.cabecalho_de(ALUNO),
        ).json()
        dois = self.cliente.post(
            "/pacientes", json={"curso": "P", "perfil": "Ansioso"},
            headers=self.cabecalho_de(OUTRO_ALUNO),
        ).json()
        self.assertNotEqual(um["id"], dois["id"])


class TestIsolamentoEntreAlunos(ComCliente):
    """O paciente de um e-mail do piloto é invisível para outro — mesmo
    com id em mãos e mesmo os dois estando autorizados."""

    def _criar_para(self, email):
        return self.cliente.post(
            "/pacientes", json={"curso": "P", "perfil": "Ansioso"},
            headers=self.cabecalho_de(email),
        ).json()

    def test_ler_paciente_de_outro_e_404(self):
        paciente = self._criar_para(ALUNO)
        resposta = self.cliente.get(
            f"/pacientes/{paciente['id']}", headers=self.cabecalho_de(OUTRO_ALUNO)
        )
        self.assertEqual(resposta.status_code, 404)

    def test_registrar_sessao_no_paciente_de_outro_e_404(self):
        paciente = self._criar_para(ALUNO)
        resposta = self.cliente.post(
            f"/pacientes/{paciente['id']}/sessoes",
            json={"tipo": "NENHUMA"},
            headers=self.cabecalho_de(OUTRO_ALUNO),
        )
        self.assertEqual(resposta.status_code, 404)

    def test_historico_de_outro_e_404(self):
        paciente = self._criar_para(ALUNO)
        resposta = self.cliente.get(
            f"/pacientes/{paciente['id']}/historico", headers=self.cabecalho_de(OUTRO_ALUNO)
        )
        self.assertEqual(resposta.status_code, 404)


class TestRegistrarSessaoEFicha(ComCliente):
    def _criar(self, perfil="Depressivo"):
        return self.cliente.post(
            "/pacientes", json={"curso": "P", "perfil": perfil},
            headers=self.cabecalho_de(ALUNO),
        ).json()

    def test_abertura_nunca_contem_numero_ou_termo_tecnico(self):
        """A garantia da etapa 2, pela borda HTTP real desta vez."""
        paciente = self._criar()
        corpo = self.cliente.post(
            f"/pacientes/{paciente['id']}/sessoes",
            json={"tipo": "ATIVACAO_COMPORTAMENTAL", "carga": 0.15, "especificidade": 0.9},
            headers=self.cabecalho_de(ALUNO),
        ).json()
        self.assertNotIn("estado_atual", corpo)
        self.assertNotIn("ficha", corpo)
        for fala in corpo["fala"]:
            self.assertFalse(any(c.isdigit() for c in fala), fala)

    def test_sinais_tem_so_os_7_campos_de_corpo_nunca_dimensao_clinica(self):
        """`sinais` (ideia #2 — o avatar anima o sinal em vez de só
        descrevê-lo) é a única exceção numérica em AberturaSaida, e só pode
        ser os campos de `SinaisCorporais` — nunca uma das 7 dimensões de
        `EstadoPaciente` (alianca, sofrimento, etc.). Se esse limite vazar
        um dia, é aqui que quebra."""
        paciente = self._criar()
        corpo = self.cliente.post(
            f"/pacientes/{paciente['id']}/sessoes",
            json={"tipo": "NENHUMA"},
            headers=self.cabecalho_de(ALUNO),
        ).json()

        self.assertEqual(
            set(corpo["sinais"]),
            {
                "respiracao_por_minuto", "variabilidade_respiratoria",
                "latencia_de_resposta", "velocidade_da_fala",
                "contato_visual", "micro_tensao", "presenca",
            },
        )
        dimensoes_clinicas = {"alianca", "sofrimento", "abertura", "esperanca", "adesao", "risco", "energia"}
        self.assertFalse(dimensoes_clinicas & set(corpo["sinais"]))

    def test_ficha_fica_numa_rota_separada(self):
        paciente = self._criar()
        registrado = self.cliente.post(
            f"/pacientes/{paciente['id']}/sessoes", json={"tipo": "NENHUMA"},
            headers=self.cabecalho_de(ALUNO),
        ).json()
        sessao_concluida = registrado["numero_sessao_concluida"]

        ficha = self.cliente.get(
            f"/pacientes/{paciente['id']}/ficha/{sessao_concluida}",
            headers=self.cabecalho_de(ALUNO),
        )
        self.assertEqual(ficha.status_code, 200)
        corpo = ficha.json()
        self.assertIn("estado_final", corpo)
        self.assertIn("leitura", corpo)

    def test_ficha_de_sessao_inexistente_e_404(self):
        paciente = self._criar()
        resposta = self.cliente.get(
            f"/pacientes/{paciente['id']}/ficha/99", headers=self.cabecalho_de(ALUNO)
        )
        self.assertEqual(resposta.status_code, 404)

    def test_carga_fora_da_faixa_e_422(self):
        paciente = self._criar()
        resposta = self.cliente.post(
            f"/pacientes/{paciente['id']}/sessoes",
            json={"tipo": "REGISTRO", "carga": 1.5},
            headers=self.cabecalho_de(ALUNO),
        )
        self.assertEqual(resposta.status_code, 422)

    def test_estado_persiste_entre_chamadas(self):
        paciente = self._criar("Ansioso")
        self.cliente.post(
            f"/pacientes/{paciente['id']}/sessoes", json={"tipo": "NENHUMA"},
            headers=self.cabecalho_de(ALUNO),
        )
        depois = self.cliente.get(
            f"/pacientes/{paciente['id']}", headers=self.cabecalho_de(ALUNO)
        ).json()
        self.assertEqual(depois["numero_sessao"], 2)


class TestHistorico(ComCliente):
    def test_lista_so_numero_e_data_sem_campo_clinico(self):
        paciente = self.cliente.post(
            "/pacientes", json={"curso": "P", "perfil": "Ansioso"},
            headers=self.cabecalho_de(ALUNO),
        ).json()
        for _ in range(2):
            self.cliente.post(
                f"/pacientes/{paciente['id']}/sessoes", json={"tipo": "NENHUMA"},
                headers=self.cabecalho_de(ALUNO),
            )
        historico = self.cliente.get(
            f"/pacientes/{paciente['id']}/historico", headers=self.cabecalho_de(ALUNO)
        ).json()
        self.assertEqual([h["numero_sessao"] for h in historico], [1, 2])
        for item in historico:
            self.assertEqual(set(item), {"numero_sessao", "criado_em"})


if __name__ == "__main__":
    unittest.main()

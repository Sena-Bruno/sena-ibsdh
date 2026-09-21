"""Testes da narração — e do estreitamento que a mantém honesta."""

import unittest

from sena_nucleo.narrativa import (
    MAX_FALAS,
    Fatos,
    extrair_fatos,
    fala_valida,
    faixa_de_adesao,
    limpar_resposta,
    montar_instrucoes,
    narrar,
)
from sena_nucleo.perfis import PERFIS, obter
from sena_nucleo.prescricao import Prescricao, TipoPrescricao
from sena_nucleo.semana import simular_semana

NADA = Prescricao(TipoPrescricao.NENHUMA)
TAREFA = Prescricao(TipoPrescricao.ATIVACAO_COMPORTAMENTAL, 0.9, 0.15)


def semana_de(nome, prescricao=NADA, semente=42):
    perfil = obter(nome)
    return simular_semana(perfil.basal, perfil, prescricao, semente), perfil


class TestEstreitamento(unittest.TestCase):
    """A regra central: a IA não pode vazar o que nunca recebeu.

    Se algum destes testes quebrar, alguém alargou `Fatos` — e a garantia
    deixou de ser estrutural para voltar a ser promessa de prompt.
    """

    CAMPOS_PERMITIDOS = {
        "perfil", "descricao", "resistencias", "acontecimentos",
        "houve_prescricao", "cumprimento", "semana_foi_pior",
    }

    def test_fatos_nao_ganharam_campos_novos(self):
        self.assertEqual(set(Fatos.__dataclass_fields__), self.CAMPOS_PERMITIDOS)

    def test_nenhuma_dimensao_chega_aos_fatos(self):
        """Nem por valor, nem por NOME.

        `Fatos.cumprimento` já se chamou `adesao`, colidindo com a dimensão
        `EstadoPaciente.adesao`. Uma é palavra, a outra é número em [0, 1];
        com o mesmo nome no mesmo fluxo, passar uma no lugar da outra não
        quebra nada até chegar à tela.
        """
        from sena_nucleo.estado import DIMENSOES

        self.assertFalse(set(DIMENSOES) & set(Fatos.__dataclass_fields__))

    def test_o_prompt_nao_contem_numero(self):
        """Nem a contagem de dias, nem nota, nem fração."""
        for nome in PERFIS:
            for prescricao in (NADA, TAREFA):
                for semente in range(6):
                    semana, perfil = semana_de(nome, prescricao, semente)
                    prompt = montar_instrucoes(extrair_fatos(semana, perfil))
                    with self.subTest(perfil=nome, semente=semente):
                        self.assertFalse(
                            any(c.isdigit() for c in prompt),
                            "algarismo no prompt entregaria o que o paciente não sabe",
                        )

    def test_o_prompt_nao_contem_a_leitura_tecnica(self):
        # REGRESSÃO: a lista de regras do prompt ENUMERAVA estas palavras,
        # então o prompt continha exatamente o vocabulário que esta camada
        # existe para manter longe do narrador — e citá-lo a um modelo
        # aumenta a chance de ele o escrever de volta.
        proibidos = ("aliança", "alianca", "sobrecarga", "iatrog", "saldo",
                     "dimensão", "escala", "adesão")
        for nome in PERFIS:
            semana, perfil = semana_de(nome, TAREFA)
            prompt = montar_instrucoes(extrair_fatos(semana, perfil)).lower()
            for termo in proibidos:
                with self.subTest(perfil=nome, termo=termo):
                    self.assertNotIn(termo, prompt)


class TestFaixaDeAdesao(unittest.TestCase):
    def test_cada_contagem_de_dias_cai_na_palavra_certa(self):
        """Os cortes seguem sétimos, que é a granularidade real do dado.

        Com os cortes redondos da primeira versão, 3 de 7 dias caía em
        "tentou uma vez" — descrição falsa do que aconteceu, entregue ao
        narrador como se fosse fato.
        """
        esperado = {
            0: "nao_fez",
            1: "tentou_uma_vez",
            2: "fez_algumas_vezes",
            3: "fez_algumas_vezes",
            4: "fez_algumas_vezes",
            5: "fez_quase_sempre",
            6: "fez_quase_sempre",
            7: "fez_todos_os_dias",
        }
        for dias, palavra in esperado.items():
            with self.subTest(dias=dias):
                self.assertEqual(faixa_de_adesao(dias / 7), palavra)

    def test_monotona(self):
        vistos = [faixa_de_adesao(t / 20) for t in range(21)]
        ordem = ["nao_fez", "tentou_uma_vez", "fez_algumas_vezes",
                 "fez_quase_sempre", "fez_todos_os_dias"]
        posicoes = [ordem.index(v) for v in vistos]
        self.assertEqual(posicoes, sorted(posicoes))


class TestExtracao(unittest.TestCase):
    def test_sem_prescricao_a_adesao_nao_e_narrada(self):
        semana, perfil = semana_de("Ansioso", NADA)
        fatos = extrair_fatos(semana, perfil)
        self.assertFalse(fatos.houve_prescricao)
        self.assertEqual(fatos.cumprimento, "nao_fez")
        self.assertNotIn("tarefa combinada", montar_instrucoes(fatos))

    def test_acontecimento_nao_se_repete(self):
        for nome in PERFIS:
            for semente in range(15):
                semana, perfil = semana_de(nome, NADA, semente)
                acs = extrair_fatos(semana, perfil).acontecimentos
                with self.subTest(perfil=nome, semente=semente):
                    self.assertEqual(len(acs), len(set(acs)))

    def test_semana_vazia_e_declarada(self):
        intel = obter("Intelectualizador")
        vazias = [
            s for s in range(200)
            if not simular_semana(intel.basal, intel, NADA, s).eventos
        ]
        self.assertTrue(vazias)
        semana = simular_semana(intel.basal, intel, NADA, vazias[0])
        prompt = montar_instrucoes(extrair_fatos(semana, intel))
        self.assertIn("não tem assunto", prompt)


class TestValidacao(unittest.TestCase):
    def test_barra_numero_e_termo_tecnico(self):
        self.assertFalse(fala_valida("Fiz 3 dos 7 dias."))
        self.assertFalse(fala_valida("Minha aliança com você mudou."))
        self.assertFalse(fala_valida("Eu sou um paciente difícil."))

    def test_nao_barra_fala_legitima(self):
        """REGRESSÃO — a primeira versão comparava por substring.

        "anota" contém "nota" e "recarga" contém "carga", então fala boa
        era descartada e a sessão caía para o narrador fixo sem motivo
        aparente. Um filtro que rejeita fala legítima é pior que um
        frouxo: ele falha em silêncio.
        """
        for texto in (
            "Minha esposa anota tudo num caderno.",
            "Comprei uma recarga e esqueci de usar.",
            "Na sessão passada você falou de respiração.",
            "Não consegui fazer o que a gente combinou.",
        ):
            with self.subTest(texto=texto):
                self.assertTrue(fala_valida(texto))

    def test_barra_redacao(self):
        self.assertFalse(fala_valida("a" * 400))

    def test_barra_vazio(self):
        self.assertFalse(fala_valida("   "))


class TestLimpeza(unittest.TestCase):
    def test_remove_marcador_numeracao_e_aspas(self):
        bruto = '- Dormi mal.\n2) Briguei em casa.\n"Não sei o que fazer."'
        self.assertEqual(
            limpar_resposta(bruto),
            ("Dormi mal.", "Briguei em casa.", "Não sei o que fazer."),
        )

    def test_descarta_so_a_linha_que_vazou(self):
        """Uma linha ruim não pode custar a sessão inteira."""
        bruto = "Dormi mal.\nMinha nota foi baixa.\nBriguei em casa."
        self.assertEqual(limpar_resposta(bruto), ("Dormi mal.", "Briguei em casa."))

    def test_respeita_o_teto_de_falas(self):
        bruto = "\n".join(f"Falei disso e daquilo, coisa {c}." for c in "abcdefgh")
        self.assertLessEqual(len(limpar_resposta(bruto)), MAX_FALAS)


class TestUmaFonteDeVerdade(unittest.TestCase):
    """REGRESSÃO — `briefing.py` tinha a própria cópia das faixas.

    Quando as faixas de `narrativa` foram corrigidas para sétimos, a cópia
    ficou para trás e a MESMA semana passou a render duas descrições
    diferentes: "fez algumas vezes" no prompt entregue ao narrador e
    "tentei uma vez" na fala do narrador fixo. O aluno veria uma; o modelo
    receberia a outra.
    """

    def test_as_duas_pontas_descrevem_o_mesmo_cumprimento(self):
        from sena_nucleo.briefing import FRASES_DE_CUMPRIMENTO, fala_de_abertura

        for nome in PERFIS:
            for semente in range(25):
                semana, perfil = semana_de(nome, TAREFA, semente)
                faixa = extrair_fatos(semana, perfil).cumprimento
                esperada = FRASES_DE_CUMPRIMENTO[faixa]
                with self.subTest(perfil=nome, semente=semente):
                    self.assertIn(esperada, fala_de_abertura(semana, perfil))

    def test_toda_faixa_tem_frase(self):
        from sena_nucleo.briefing import FRASES_DE_CUMPRIMENTO
        from sena_nucleo.narrativa import FAIXAS_DE_ADESAO, ORIENTACAO_DE_ADESAO

        faixas = {nome for _, nome in FAIXAS_DE_ADESAO}
        self.assertEqual(faixas, set(FRASES_DE_CUMPRIMENTO))
        self.assertEqual(faixas, set(ORIENTACAO_DE_ADESAO))


class TestQueda(unittest.TestCase):
    """Uma sessão que não abre é um aluno perdido."""

    def test_sem_narrador_usa_o_fixo(self):
        semana, perfil = semana_de("Depressivo", TAREFA)
        self.assertEqual(narrar(semana, perfil), narrar(semana, perfil, None))
        self.assertTrue(narrar(semana, perfil))

    def test_narrador_que_explode_cai_para_o_fixo(self):
        def quebrado(instrucoes):
            raise RuntimeError("cota estourada")

        semana, perfil = semana_de("Depressivo", TAREFA)
        self.assertEqual(
            narrar(semana, perfil, quebrado), narrar(semana, perfil)
        )

    def test_resposta_vazia_cai_para_o_fixo(self):
        semana, perfil = semana_de("Ansioso", TAREFA)
        for vazio in ("", "   ", "\n\n"):
            with self.subTest(vazio=repr(vazio)):
                self.assertEqual(
                    narrar(semana, perfil, lambda i: vazio), narrar(semana, perfil)
                )

    def test_resposta_toda_invalida_cai_para_o_fixo(self):
        semana, perfil = semana_de("Ansioso", TAREFA)
        suja = "Tirei nota 4.\nMinha aliança caiu 12%."
        self.assertEqual(narrar(semana, perfil, lambda i: suja), narrar(semana, perfil))

    def test_narrador_bom_e_usado(self):
        semana, perfil = semana_de("Ansioso", TAREFA)
        falas = narrar(semana, perfil, lambda i: "Dormi mal.\nEstou cansado.")
        self.assertEqual(falas, ("Dormi mal.", "Estou cansado."))


class TestNarradorHttpNaoTocaARede(unittest.TestCase):
    def test_sem_configuracao_falha_antes_de_qualquer_chamada(self):
        from sena_nucleo.narrador_http import FalhaDoNarrador, narrador_http

        with self.assertRaises(FalhaDoNarrador):
            narrador_http(url="", chave="", modelos=())


if __name__ == "__main__":
    unittest.main()

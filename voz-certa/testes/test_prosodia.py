"""Testes de prosodia.py — a única parte deste projeto sem dependência
pesada (sem torch, sem TTS, sem faster-whisper), então a única que roda
em qualquer máquina sem instalar nada além do Python padrão."""

import unittest

from voz_certa.prosodia import (
    PAUSA_CURTA,
    PAUSA_LONGA,
    PAUSA_MEDIA,
    inserir_pausas,
    normalizar_reticencias,
)


class TestNormalizarReticencias(unittest.TestCase):
    def test_colapsa_sequencias_irregulares_de_pontos(self):
        self.assertEqual(normalizar_reticencias("e então....."), "e então...")
        self.assertEqual(normalizar_reticencias("pausa.."), "pausa...")

    def test_nao_mexe_em_ponto_unico(self):
        self.assertEqual(normalizar_reticencias("Relaxe."), "Relaxe.")

    def test_nao_mexe_em_texto_sem_pontuacao(self):
        self.assertEqual(normalizar_reticencias("sem pontuação nenhuma"), "sem pontuação nenhuma")


class TestInserirPausas(unittest.TestCase):
    def test_intensidade_invalida_levanta(self):
        with self.assertRaises(ValueError):
            inserir_pausas("qualquer coisa", intensidade="extrema")

    def test_leve_so_normaliza_reticencias_sem_adicionar_pausa(self):
        resultado = inserir_pausas("Feche os olhos..... Respire fundo.", intensidade="leve")
        self.assertEqual(resultado, "Feche os olhos... Respire fundo.")

    def test_media_alonga_ponto_final(self):
        resultado = inserir_pausas("Respire fundo.", intensidade="media")
        self.assertEqual(resultado, f"Respire fundo.{PAUSA_MEDIA}")

    def test_media_alonga_exclamacao_e_interrogacao(self):
        self.assertTrue(inserir_pausas("Relaxe!", intensidade="media").endswith(PAUSA_MEDIA))
        self.assertTrue(inserir_pausas("Sente isso?", intensidade="media").endswith(PAUSA_MEDIA))

    def test_media_nao_mexe_em_virgula(self):
        resultado = inserir_pausas("Sinta o peso, deixe ir.", intensidade="media")
        self.assertIn("peso, deixe", resultado)  # vírgula intacta, sem pausa extra

    def test_media_nao_mexe_em_reticencia_existente(self):
        resultado = inserir_pausas("E então... tudo fica mais leve.", intensidade="media")
        # a reticência original permanece EXATAMENTE como está — três pontos,
        # nunca alongada — só o ponto final da frase ganha pausa nova.
        self.assertIn("então... tudo", resultado)
        self.assertTrue(resultado.endswith(PAUSA_MEDIA))

    def test_forte_tambem_pausa_virgula_ponto_e_virgula_e_dois_pontos(self):
        resultado = inserir_pausas("Sinta o peso, deixe ir; relaxe: agora.", intensidade="forte")
        self.assertIn(f",{PAUSA_CURTA}", resultado)
        self.assertIn(f";{PAUSA_CURTA}", resultado)
        self.assertIn(f":{PAUSA_CURTA}", resultado)
        self.assertTrue(resultado.endswith(PAUSA_LONGA))

    def test_forte_usa_pausa_mais_longa_que_media_no_final_de_frase(self):
        media = inserir_pausas("Durma.", intensidade="media")
        forte = inserir_pausas("Durma.", intensidade="forte")
        self.assertGreater(len(forte), len(media))

    def test_frase_sem_pontuacao_final_nao_ganha_pausa_orfa(self):
        resultado = inserir_pausas("continue respirando", intensidade="forte")
        self.assertEqual(resultado, "continue respirando")


if __name__ == "__main__":
    unittest.main()

"""Testes do motor da semana."""

import unittest

from sena_nucleo.estado import EstadoPaciente
from sena_nucleo.perfis import PERFIS, obter
from sena_nucleo.prescricao import Prescricao, TipoPrescricao
from sena_nucleo.semana import DIAS, simular_alternativa, simular_semana

NADA = Prescricao(TipoPrescricao.NENHUMA)


def ids_dos_eventos(semana):
    return [dia.evento.id if dia.evento else None for dia in semana.dias]


class TestDeterminismo(unittest.TestCase):
    def test_mesma_semente_mesma_semana(self):
        dep = obter("Depressivo")
        p = Prescricao(TipoPrescricao.ATIVACAO_COMPORTAMENTAL, 0.8, 0.2)
        a = simular_semana(dep.basal, dep, p, semente=7)
        b = simular_semana(dep.basal, dep, p, semente=7)
        self.assertEqual(a.estado_final, b.estado_final)
        self.assertEqual(ids_dos_eventos(a), ids_dos_eventos(b))
        self.assertEqual(a.dias_cumpridos, b.dias_cumpridos)

    def test_sementes_diferentes_semanas_diferentes(self):
        dep = obter("Depressivo")
        p = Prescricao(TipoPrescricao.ATIVACAO_COMPORTAMENTAL, 0.8, 0.2)
        semanas = {
            tuple(ids_dos_eventos(simular_semana(dep.basal, dep, p, semente=s)))
            for s in range(12)
        }
        # Não exige que todas sejam distintas (colisão é legítima), só que
        # a semente realmente esteja variando a vida do paciente.
        self.assertGreater(len(semanas), 6)

    def test_nao_toca_no_gerador_global(self):
        """Duas chamadas ao motor não podem deslocar o `random` do processo,
        senão qualquer outro sorteio do backend vira refém da simulação."""
        import random

        random.seed(1234)
        esperado = [random.random() for _ in range(3)]

        random.seed(1234)
        dep = obter("Depressivo")
        simular_semana(dep.basal, dep, NADA, semente=99)
        obtido = [random.random() for _ in range(3)]

        self.assertEqual(esperado, obtido)


class TestAlinhamentoContrafactual(unittest.TestCase):
    """REGRESSÃO — a premissa inteira da Máquina do Tempo.

    O motor consome um sorteio de adesão por dia MESMO quando não há
    prescrição. Antes disso, `TipoPrescricao.NENHUMA` pulava o sorteio e
    deslocava todo o fluxo seguinte: os eventos de vida caíam em dias
    diferentes, e a comparação "e se você tivesse prescrito outra coisa?"
    creditava à prescrição uma diferença que era puro acaso.
    """

    def test_eventos_identicos_com_qualquer_prescricao(self):
        dep = obter("Depressivo")
        prescricoes = [
            NADA,
            Prescricao(TipoPrescricao.ATIVACAO_COMPORTAMENTAL, 0.9, 0.15),
            Prescricao(TipoPrescricao.ATIVACAO_COMPORTAMENTAL, 0.9, 0.70),
            Prescricao(TipoPrescricao.EXPOSICAO_GRADUAL, 0.2, 0.9),
        ]
        vidas = {
            tuple(ids_dos_eventos(simular_semana(dep.basal, dep, p, semente=42)))
            for p in prescricoes
        }
        self.assertEqual(len(vidas), 1, "a mesma semente deve dar a mesma vida")

    def test_alternativa_preserva_a_vida(self):
        ans = obter("Ansioso")
        original = simular_semana(
            ans.basal, ans, Prescricao(TipoPrescricao.RESPIRATORIA, 0.9, 0.3), 5
        )
        outra = simular_alternativa(original, NADA, ans)
        self.assertEqual(ids_dos_eventos(original), ids_dos_eventos(outra))
        self.assertEqual(original.estado_inicial, outra.estado_inicial)


class TestEstrutura(unittest.TestCase):
    def test_sempre_sete_dias(self):
        ans = obter("Ansioso")
        semana = simular_semana(ans.basal, ans, NADA, semente=1)
        self.assertEqual(len(semana.dias), DIAS)
        self.assertEqual([d.numero for d in semana.dias], list(range(1, DIAS + 1)))

    def test_estado_final_e_o_do_ultimo_dia(self):
        ans = obter("Ansioso")
        semana = simular_semana(ans.basal, ans, NADA, semente=3)
        self.assertEqual(semana.estado_final, semana.dias[-1].estado_ao_fim)

    def test_dias_cumpridos_bate_com_os_dias(self):
        dep = obter("Depressivo")
        semana = simular_semana(
            dep.basal, dep, Prescricao(TipoPrescricao.ATIVACAO_COMPORTAMENTAL, 0.9, 0.1), 11
        )
        self.assertEqual(
            semana.dias_cumpridos, sum(1 for d in semana.dias if d.cumpriu_prescricao)
        )

    def test_sem_prescricao_ninguem_cumpre(self):
        for perfil in PERFIS.values():
            with self.subTest(perfil=perfil.nome):
                semana = simular_semana(perfil.basal, perfil, NADA, semente=2)
                self.assertEqual(semana.dias_cumpridos, 0)
                self.assertEqual(semana.taxa_de_adesao, 0.0)

    def test_estado_sempre_valido(self):
        """Nenhuma combinação pode produzir dimensão fora de [0, 1]."""
        for perfil in PERFIS.values():
            for semente in range(6):
                p = Prescricao(TipoPrescricao.EXPOSICAO_GRADUAL, 0.5, 0.9)
                semana = simular_semana(perfil.basal, perfil, p, semente)
                for dia in semana.dias:
                    for valor in dia.estado_ao_fim.como_dicionario().values():
                        self.assertTrue(0.0 <= valor <= 1.0)


class TestLicaoDeTitulacao(unittest.TestCase):
    """A razão de o Paciente Vivo existir.

    Mesma técnica, mesma clareza, só a DOSE muda — e o desfecho inverte.
    Se estes testes quebrarem, o motor passou a ensinar que prescrever
    mais é sempre melhor, que é o oposto do que a clínica faz.
    """

    def _esperanca(self, carga, semente):
        dep = obter("Depressivo")
        p = Prescricao(TipoPrescricao.ATIVACAO_COMPORTAMENTAL, 0.9, carga)
        return simular_semana(dep.basal, dep, p, semente).estado_final.esperanca

    def _esperanca_sem_nada(self, semente):
        dep = obter("Depressivo")
        return simular_semana(dep.basal, dep, NADA, semente).estado_final.esperanca

    def test_dose_certa_supera_dose_alta(self):
        for semente in range(8):
            with self.subTest(semente=semente):
                self.assertGreater(self._esperanca(0.15, semente), self._esperanca(0.75, semente))

    def test_dose_alta_e_pior_que_nao_prescrever(self):
        """Iatrogenia: o paciente tenta, falha, e a falha vira prova."""
        for semente in range(8):
            with self.subTest(semente=semente):
                self.assertLess(self._esperanca(0.75, semente), self._esperanca_sem_nada(semente))

    def test_dose_certa_supera_nao_prescrever_em_media(self):
        """Prescrever bem melhora a APOSTA, não garante a semana.

        Afirmado sobre a média de muitas semanas, e não semente a semente,
        porque semente a semente é falso — e deve ser. Com adesão em torno
        de 33% ao dia, há semanas em que o paciente não cumpre nenhum dia;
        nelas, a prescrição certa sai pior do que não ter prescrito, porque
        combinar e não fazer custa alguma coisa.

        Um motor em que a boa condução vencesse SEMPRE ensinaria o aluno a
        ler o resultado de uma semana como veredito sobre a própria
        competência. Clínica não devolve isso, e um simulador que devolvesse
        formaria gente que abandona a conduta certa no primeiro revés.
        """
        amostra = range(60)
        media_com = sum(self._esperanca(0.15, s) for s in amostra) / len(amostra)
        media_sem = sum(self._esperanca_sem_nada(s) for s in amostra) / len(amostra)
        self.assertGreater(media_com, media_sem)

    def test_prescrever_certo_nao_e_garantia(self):
        """O contrapeso do teste acima: a variação existe e é para existir.

        Fixa a propriedade que impede alguém de 'consertar' o motor no
        futuro removendo o acaso para fazer o teste da média ficar bonito.
        """
        perde_em_alguma = any(
            self._esperanca(0.15, s) < self._esperanca_sem_nada(s) for s in range(60)
        )
        self.assertTrue(perde_em_alguma)

    def test_sobrecarga_e_sinalizada(self):
        dep = obter("Depressivo")
        pesada = simular_semana(
            dep.basal, dep, Prescricao(TipoPrescricao.ATIVACAO_COMPORTAMENTAL, 0.9, 0.75), 1
        )
        leve = simular_semana(
            dep.basal, dep, Prescricao(TipoPrescricao.ATIVACAO_COMPORTAMENTAL, 0.9, 0.15), 1
        )
        self.assertTrue(pesada.houve_sobrecarga)
        self.assertFalse(leve.houve_sobrecarga)


class TestCursoNaturalContraALiteratura(unittest.TestCase):
    """O que o paciente faz sozinho, aferido contra a pesquisa publicada.

    Estes são os testes que substituíram a primeira versão do motor, em que
    o paciente desabava sem intervenção: o Depressivo perdia 0,15 de
    esperança e ganhava 0,22 de risco por semana, e 85% a 100% das semanas
    terminavam piores. A literatura de grupos de lista de espera mede o
    contrário — melhora leve — e é ela que estes testes travam.

    As fontes de cada número estão em `nucleo/FUNDAMENTACAO.md`.
    """

    #: Grande o bastante para a média parar de oscilar. Com 400 o teste
    #: passava ou falhava conforme o perfil, porque a semana tem variância
    #: alta de propósito — um teste que afirma uma MÉDIA precisa de amostra
    #: à altura, ou vira alarme intermitente que ninguém mais leva a sério.
    AMOSTRA = 1500

    def _sem_intervencao(self, perfil, semente):
        return simular_semana(perfil.basal, perfil, NADA, semente)

    def test_sintoma_cede_sozinho_em_vez_de_piorar(self):
        """Lista de espera melhora (g = 0,37 pré-pós em depressão)."""
        for perfil in PERFIS.values():
            media = sum(
                self._sem_intervencao(perfil, s).estado_final.sofrimento
                - perfil.basal.sofrimento
                for s in range(self.AMOSTRA)
            ) / self.AMOSTRA
            with self.subTest(perfil=perfil.nome):
                self.assertLessEqual(media, 0.002, "o sintoma não pode subir sozinho")

    def test_queda_de_sintoma_em_dez_semanas_bate_com_a_literatura(self):
        """10–15% de redução sem tratamento, ao longo de ~10 semanas.

        Afirmado sobre dez semanas encadeadas porque é assim que os estudos
        medem — uma semana isolada é ruído.
        """
        quedas = []
        for perfil in PERFIS.values():
            for semente in range(40):
                estado = perfil.basal
                for passo in range(10):
                    estado = simular_semana(
                        estado, perfil, NADA, semente * 100 + passo
                    ).estado_final
                quedas.append(
                    (estado.sofrimento - perfil.basal.sofrimento) / perfil.basal.sofrimento
                )
        media = 100 * sum(quedas) / len(quedas)
        self.assertTrue(
            -16.0 <= media <= -8.0,
            f"redução de {media:.1f}% em 10 semanas; esperado entre -8% e -16%",
        )

    def test_deterioracao_fica_na_faixa_dos_controles(self):
        """12–13% dos casos deterioram em grupos de controle. Não 90%."""
        total = piorados = 0
        for perfil in PERFIS.values():
            for semente in range(self.AMOSTRA):
                total += 1
                if self._sem_intervencao(perfil, semente).deterioracao_clinica:
                    piorados += 1
        pct = 100 * piorados / total
        self.assertTrue(
            8.0 <= pct <= 17.0, f"{pct:.1f}% deterioraram; esperado entre 8% e 17%"
        )

    def test_risco_nao_escala_sozinho(self):
        """A versão anterior subia o risco do Depressivo 0,22 por semana.

        Nada na literatura sustenta escalada de risco nessa velocidade em
        alguém apenas aguardando atendimento, e num produto de formação
        clínica esse era o número mais perigoso do motor.
        """
        for perfil in PERFIS.values():
            media = sum(
                self._sem_intervencao(perfil, s).estado_final.risco - perfil.basal.risco
                for s in range(self.AMOSTRA)
            ) / self.AMOSTRA
            with self.subTest(perfil=perfil.nome):
                self.assertLess(media, 0.02)

    def test_alianca_do_cetico_decai_sem_intervencao(self):
        """Não fazer nada com um cético já é perder — o custo nomeado dele."""
        cet = obter("Cético")
        media = sum(
            self._sem_intervencao(cet, s).estado_final.alianca - cet.basal.alianca
            for s in range(self.AMOSTRA)
        ) / self.AMOSTRA
        self.assertLess(media, 0)

    def test_eventos_de_vida_nao_sao_viciados(self):
        """O repertório tem de ser neutro: a tendência é da regressão.

        A primeira versão tinha 6,5 de peso positivo contra 10,0 de
        negativo, e todo perfil afundava mesmo sem deriva nenhuma — o acaso
        estava puxando para um lado só. Com o repertório viciado, nenhuma
        calibração da regressão consegue acertar a tendência.
        """
        from sena_nucleo.estado import DIMENSOES
        from sena_nucleo.eventos import repertorio

        for perfil in PERFIS.values():
            eventos = repertorio(perfil.nome)
            peso_total = sum(e.peso for e in eventos)
            saldo = {d: 0.0 for d in DIMENSOES}
            for evento in eventos:
                for dimensao, valor in evento.efeitos.items():
                    saldo[dimensao] += valor * evento.peso / peso_total
            pior = max(abs(v) for v in saldo.values())
            with self.subTest(perfil=perfil.nome):
                self.assertLess(pior, 0.015, f"repertório viciado: {saldo}")


class TestReserva(unittest.TestCase):
    def test_alianca_alta_amortece_o_revés(self):
        """Quem construiu reserva colhe na crise."""
        cet = obter("Cético")
        frio = cet.basal.com(alianca=-0.2, esperanca=-0.2)
        quente = cet.basal.com(alianca=+0.4, esperanca=+0.4)
        perda_frio = frio.sofrimento - simular_semana(frio, cet, NADA, 13).estado_final.sofrimento
        perda_quente = (
            quente.sofrimento - simular_semana(quente, cet, NADA, 13).estado_final.sofrimento
        )
        self.assertGreater(perda_quente, perda_frio)


if __name__ == "__main__":
    unittest.main()

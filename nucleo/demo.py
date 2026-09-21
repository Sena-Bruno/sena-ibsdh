#!/usr/bin/env python3
"""
Demonstração do Paciente Vivo. Rode com: python3 demo.py

Mostra o arco completo que o simulador não tinha: um paciente sai da
sessão 1 com uma prescrição, vive sete dias, e chega à sessão 2 diferente
por causa dela — com a Máquina do Tempo comparando o que teria acontecido
se a condução tivesse sido outra.
"""

from sena_nucleo.briefing import abertura_completa, ficha_do_supervisor
from sena_nucleo.narrativa import extrair_fatos, montar_instrucoes, narrar
from sena_nucleo.perfis import obter
from sena_nucleo.prescricao import Prescricao, TipoPrescricao
from sena_nucleo.semana import simular_alternativa, simular_semana

LARGURA = 72


def titulo(texto: str) -> None:
    print(f"\n{'─' * LARGURA}\n{texto}\n{'─' * LARGURA}")


def mostrar_sessao(semana, perfil) -> None:
    abertura = abertura_completa(semana, perfil)

    print("\n  O PACIENTE SENTA E DIZ:\n")
    for fala in abertura["fala"]:
        print(f'    — "{fala}"')

    print("\n  O QUE VOCÊ VÊ (nenhuma interpretação é dada):\n")
    for observacao in abertura["corpo"]:
        print(f"    · {observacao}")


def mostrar_ficha(semana, perfil) -> None:
    ficha = ficha_do_supervisor(semana, perfil)
    print(f"\n  Adesão: {semana.dias_cumpridos}/7 dias"
          f"   ·   Sobrecarga: {'SIM' if semana.houve_sobrecarga else 'não'}")

    # A seta segue o SINAL do número, não se a mudança foi boa. Risco
    # subindo é uma perda escrita com sinal positivo, e uma seta para
    # baixo ao lado de "+0.193" faria o leitor duvidar da tabela inteira.
    for rotulo, linhas in (("Ganhos", ficha["ganhos"]), ("Perdas", ficha["perdas"])):
        if not linhas:
            continue
        print(f"\n  {rotulo}:")
        for dimensao, delta in linhas:
            seta = "↑" if delta > 0 else "↓"
            print(f"    {seta} {dimensao:<12} {delta:+.3f}")

    if ficha["leitura"]:
        print("\n  Leitura:")
        for linha in ficha["leitura"]:
            print(f"    {linha}")
    for alerta in ficha["alertas"]:
        print(f"\n    [!] {alerta}")


def main() -> None:
    perfil = obter("Depressivo")
    semente = 42

    print("\n" + "═" * LARGURA)
    print("  SENA · PACIENTE VIVO — demonstração")
    print("═" * LARGURA)
    print(f"\n  Paciente: perfil {perfil.nome}")
    print(f"  {perfil.descricao[:64]}...")
    print(f"\n  Energia na saída da sessão 1: {perfil.basal.energia:.2f}")
    print(f"  Carga que este perfil tolera:  {perfil.carga_tolerada:.2f}")

    # ── O que o aluno prescreveu ────────────────────────────────────────
    prescrita = Prescricao(
        tipo=TipoPrescricao.ATIVACAO_COMPORTAMENTAL,
        especificidade=0.9,   # "caminhe 30 minutos, todo dia, às 7h"
        carga=0.70,           # ...que é muito para quem tem energia 0,20
        plano_de_seguranca=False,
    )

    titulo("SESSÃO 1 — o aluno prescreve")
    print("\n    Ativação comportamental: caminhada de 30 minutos,")
    print("    todos os dias, às 7h da manhã.")
    print("\n    Específica? Sim.   Tecnicamente indicada? Sim.")
    print(f"    Carga: {prescrita.carga:.2f} contra energia {perfil.basal.energia:.2f}.")

    semana = simular_semana(perfil.basal, perfil, prescrita, semente)

    titulo("SETE DIAS DEPOIS — SESSÃO 2")
    mostrar_sessao(semana, perfil)

    titulo("FICHA DO SUPERVISOR — só depois da sessão")
    mostrar_ficha(semana, perfil)

    # ── A Máquina do Tempo ──────────────────────────────────────────────
    alternativa = Prescricao(
        tipo=TipoPrescricao.ATIVACAO_COMPORTAMENTAL,
        especificidade=0.9,   # mesma clareza
        carga=0.15,           # "abra a janela e sente perto dela"
        plano_de_seguranca=True,
    )
    outra = simular_alternativa(semana, alternativa, perfil)

    titulo("MÁQUINA DO TEMPO — a mesma semana, outra dose")
    print("\n    Mesma técnica. Mesma clareza. Mesmos eventos de vida,")
    print("    nos mesmos dias. Só a DOSE muda:")
    print('\n    "Abra a janela do quarto ao acordar e sente perto dela')
    print('     por cinco minutos."\n')
    print(f"    {'':22} prescrito    alternativa")
    print(f"    {'-' * 48}")
    print(f"    {'dias cumpridos':22} {semana.dias_cumpridos}/7          "
          f"{outra.dias_cumpridos}/7")
    for dimensao in ("esperanca", "energia", "adesao", "risco"):
        antes = getattr(semana.estado_final, dimensao)
        depois = getattr(outra.estado_final, dimensao)
        marca = "  ←" if depois > antes else ""
        print(f"    {dimensao:22} {antes:.3f}        {depois:.3f}{marca}")

    print("\n    O aluno fez tudo 'certo' — técnica indicada, prescrição")
    print("    específica. Errou a dose, e a dose era a clínica.")

    # ── Etapa 2 · a narração ────────────────────────────────────────────
    titulo("NARRAÇÃO — o que a IA recebe, e o que ela NÃO recebe")
    fatos = extrair_fatos(semana, perfil)
    print("\n    Campos entregues ao narrador:")
    print(f"      {', '.join(fatos.__dataclass_fields__)}")
    print("\n    Nenhuma das sete dimensões está aí. O narrador não pode")
    print("    vazar a aliança porque nunca viu a aliança — a garantia é")
    print("    estrutural, não uma promessa escrita no prompt.")
    print("\n    O prompt montado a partir disso:\n")
    for linha in montar_instrucoes(fatos).splitlines():
        print(f"      {linha}" if linha else "")

    print("\n    Sem narrador configurado, a fala cai para o texto fixo —")
    print("    e o aluno entra na sessão do mesmo jeito:\n")
    for fala in narrar(semana, perfil):
        print(f'      — "{fala}"')
    print()


if __name__ == "__main__":
    main()

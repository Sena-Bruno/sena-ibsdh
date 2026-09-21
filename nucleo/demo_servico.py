#!/usr/bin/env python3
"""
Demonstração da persistência do Paciente Vivo (etapas 3-4).

Rode com: python3 demo_servico.py

Diferente de `demo.py` (que simula uma semana isolada, na memória), este
script passa pelo REPOSITÓRIO: cria um paciente, registra duas sessões
seguidas, e mostra que a segunda parte de onde a primeira deixou — porque
o estado agora vive num banco, não numa variável Python que morre quando
o processo termina.

Usa um banco SQLite em memória (`banco.motor_de_teste`) — o mesmo motor
que os testes usam, nunca toca disco. Em produção (etapa 4), o banco é
Postgres (Neon), via `SENA_BANCO_URL`; ver o cabeçalho de `sena_servico/banco.py`
para o porquê.

Para ver o mesmo fluxo por HTTP de verdade, com autenticação:

    pip install -r requirements-servico.txt
    export SENA_SESSION_SECRET=...        # o mesmo valor do Apps Script
    export SENA_EMAILS_PILOTO=voce@ibsdh.com.br
    uvicorn sena_servico.api:app --reload
    # depois: http://127.0.0.1:8000/docs (Swagger — cole "Bearer <token>"
    # em Authorize; um token de teste sai de
    # sena_servico.autenticacao._emitir_token_para_teste)
"""

from sena_nucleo.prescricao import Prescricao, TipoPrescricao
from sena_servico.banco import motor_de_teste
from sena_servico.repositorio import criar_ou_obter_paciente, historico, registrar_semana

LARGURA = 72


def titulo(texto: str) -> None:
    print(f"\n{'─' * LARGURA}\n{texto}\n{'─' * LARGURA}")


def main() -> None:
    print("\n" + "═" * LARGURA)
    print("  SENA · PACIENTE VIVO — memória entre sessões reais (etapas 3-4)")
    print("═" * LARGURA)

    engine = motor_de_teste()
    with engine.connect() as conexao:
        titulo("Aluno faz login pela primeira vez")
        paciente, criado = criar_ou_obter_paciente(
            conexao, "bruno@ibsdh.com", "Practitioner", "Ansioso"
        )
        print(f"\n  Paciente criado: {criado}")
        print(f"  Perfil: {paciente.perfil}  ·  Sessão: {paciente.numero_sessao}")
        print(f"  Esperança de partida: {paciente.estado_atual.esperanca:.3f}")

        titulo("O MESMO ALUNO faz login de novo — mesma chamada")
        de_novo, criado_de_novo = criar_ou_obter_paciente(
            conexao, "bruno@ibsdh.com", "Practitioner", "Cético"  # ignorado
        )
        print(f"\n  criado_agora: {criado_de_novo}  (era esperado False)")
        print(f"  Mesmo id: {de_novo.id == paciente.id}")
        print(f"  Perfil continua: {de_novo.perfil}  (não virou Cético)")

        titulo("Sessão 1: aluno prescreve respiração leve")
        p1 = Prescricao(TipoPrescricao.RESPIRATORIA, especificidade=0.9, carga=0.3)
        semana1, perfil, sessao1 = registrar_semana(conexao, paciente.id, p1)
        print(f"\n  Sessão concluída: {sessao1}")
        print(f"  Cumpriu: {semana1.dias_cumpridos}/7 dias")
        print(f"  Esperança: {semana1.estado_inicial.esperanca:.3f} → "
              f"{semana1.estado_final.esperanca:.3f}")

        titulo("Sessão 2 — parte de onde a 1 parou, NÃO do basal")
        p2 = Prescricao(TipoPrescricao.ANCORAGEM, especificidade=0.8, carga=0.4)
        semana2, _, sessao2 = registrar_semana(conexao, paciente.id, p2)
        print(f"\n  Sessão concluída: {sessao2}")
        print(f"  Estado inicial da sessão 2 == estado final da sessão 1: "
              f"{semana2.estado_inicial == semana1.estado_final}")
        print(f"  Esperança: {semana2.estado_inicial.esperanca:.3f} → "
              f"{semana2.estado_final.esperanca:.3f}")

        titulo("Histórico completo — o que um painel de supervisor leria")
        for registro in historico(conexao, paciente.id):
            print(f"\n  Sessão {registro.numero_sessao}: "
                  f"{registro.dias_cumpridos}/7 dias  ·  "
                  f"sobrecarga={registro.houve_sobrecarga}  ·  "
                  f"deteriorou={registro.deterioracao_clinica}")

        print("\n  Nada disto foi guardado dia a dia — cada linha do")
        print("  histórico é (estado_inicial, prescrição, semente). O")
        print("  motor de hoje pode reconstruir a semana inteira, com os")
        print("  sete dias, a qualquer momento — inclusive depois que a")
        print("  lógica de avaliação mudar de novo (como já mudou uma vez,")
        print("  na etapa 1).")
        print()


if __name__ == "__main__":
    main()

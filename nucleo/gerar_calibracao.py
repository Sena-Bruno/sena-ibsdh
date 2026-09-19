#!/usr/bin/env python3
"""
Gera o conjunto de dados da calibração clínica (etapa 1).

Roda o motor DE VERDADE sobre os cenários e despeja o resultado em JSON.
O painel de calibração apenas exibe este arquivo — ele não reimplementa
nada. É o que impede a ferramenta de calibração de divergir do produto:
calibrar uma coisa e rodar outra seria pior do que não calibrar.

Uso:  python3 gerar_calibracao.py > calibracao.json
"""

import json
import statistics
import sys

from sena_nucleo.briefing import abertura_completa, ficha_do_supervisor
from sena_nucleo.corpo import ler_corpo
from sena_nucleo.estado import DIMENSOES
from sena_nucleo.perfis import PERFIS
from sena_nucleo.prescricao import Prescricao, TipoPrescricao
from sena_nucleo.semana import simular_semana

SEM_PRESCRICAO = Prescricao(TipoPrescricao.NENHUMA)

#: Semanas mostradas uma a uma, para o Bruno folhear.
SEMANAS_EXIBIDAS = 12

#: Semanas usadas só para a estatística. Alta de propósito: o número que
#: ele precisa julgar é "quanto este perfil costuma andar em 7 dias", e
#: uma amostra pequena entregaria o acaso de meia dúzia de semanas.
SEMANAS_AGREGADAS = 400


def agregar(perfil) -> dict:
    """Como este perfil costuma evoluir em 7 dias, sozinho."""
    coletado = {dimensao: [] for dimensao in DIMENSOES}
    piorou = 0

    for semente in range(SEMANAS_AGREGADAS):
        semana = simular_semana(perfil.basal, perfil, SEM_PRESCRICAO, semente)
        for dimensao in DIMENSOES:
            coletado[dimensao].append(
                getattr(semana.estado_final, dimensao) - getattr(perfil.basal, dimensao)
            )
        piorou += 1 if semana.piorou else 0

    resumo = {}
    for dimensao, valores in coletado.items():
        ordenados = sorted(valores)
        resumo[dimensao] = {
            "medio": round(statistics.fmean(valores), 4),
            "p10": round(ordenados[len(ordenados) // 10], 4),
            "p90": round(ordenados[(9 * len(ordenados)) // 10], 4),
        }

    resumo["_piorou_pct"] = round(100.0 * piorou / SEMANAS_AGREGADAS, 1)
    return resumo


def exportar_semana(perfil, semente: int) -> dict:
    semana = simular_semana(perfil.basal, perfil, SEM_PRESCRICAO, semente)
    abertura = abertura_completa(semana, perfil)
    ficha = ficha_do_supervisor(semana, perfil)

    return {
        "semente": semente,
        "dias": [
            {
                "numero": dia.numero,
                "evento": (
                    {"id": dia.evento.id, "relato": dia.evento.relato}
                    if dia.evento
                    else None
                ),
                "estado": dia.estado_ao_fim.como_dicionario(),
            }
            for dia in semana.dias
        ],
        "estado_final": semana.estado_final.como_dicionario(),
        "variacoes": ficha["variacoes"],
        "piorou": semana.piorou,
        "fala": list(abertura["fala"]),
        "corpo": list(abertura["corpo"]),
        "sinais": abertura["sinais"],
        "alertas": ficha["alertas"],
    }


def main() -> None:
    perfis = []
    for nome, perfil in PERFIS.items():
        perfis.append(
            {
                "nome": nome,
                "descricao": perfil.descricao,
                "resistencias": list(perfil.resistencias),
                "abordagem_ideal": perfil.abordagem_ideal,
                "basal": perfil.basal.como_dicionario(),
                "corpo_inicial": ler_corpo(perfil.basal, perfil).como_dicionario(),
                "carga_tolerada": perfil.carga_tolerada,
                "deriva": perfil.deriva,
                "agregado": agregar(perfil),
                "semanas": [
                    exportar_semana(perfil, semente)
                    for semente in range(SEMANAS_EXIBIDAS)
                ],
            }
        )

    json.dump(
        {
            "etapa": "1 — calibração da deriva (sem prescrição)",
            "dimensoes": list(DIMENSOES),
            "semanas_agregadas": SEMANAS_AGREGADAS,
            "perfis": perfis,
        },
        sys.stdout,
        ensure_ascii=False,
        separators=(",", ":"),
    )


if __name__ == "__main__":
    main()

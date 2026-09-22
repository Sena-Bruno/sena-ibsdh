"""
Voz Certa — interface local (Gradio). Ver README.md antes de rodar:
tem passo a passo de instalação e as limitações desta v1.

    python app.py

Abre em http://127.0.0.1:7860 — só no seu navegador, só na sua máquina.
Nada daqui sai para a internet.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

import gradio as gr

from voz_certa.clonagem import VELOCIDADE_MAXIMA, VELOCIDADE_MINIMA, clonar_e_sintetizar
from voz_certa.prosodia import INTENSIDADES, inserir_pausas
from voz_certa.transcricao import transcrever

AVISO_CONSENTIMENTO = """
### Antes de começar

Esta ferramenta clona a voz de **quem gravou o áudio**. Use apenas a sua
própria voz, ou a de alguém que deu consentimento explícito e sabe que a
gravação vai ser usada para isso.

Tudo roda **no seu computador** — a gravação e o resultado nunca saem
daqui, nenhum áudio é enviado para a internet (só o download dos modelos,
uma vez, na primeira execução).
"""

AVISO_DEMORA = (
    "_Gerar pode levar de 30 segundos a alguns minutos, dependendo do seu "
    "computador — sem placa de vídeo dedicada, XTTS-v2 é lento mesmo. É "
    "normal a tela ficar parada enquanto processa._"
)


def passo_transcrever(caminho_audio: str | None):
    if not caminho_audio:
        raise gr.Error("Grave ou envie um áudio primeiro.")

    resultado = transcrever(caminho_audio)

    aviso = ""
    if resultado.idioma_detectado != "pt" or resultado.confianca_idioma < 0.6:
        aviso = (
            f"⚠️ O modelo não tem certeza de que isto é português (detectou "
            f"'{resultado.idioma_detectado}', confiança "
            f"{resultado.confianca_idioma:.0%}) — revise o texto com atenção "
            f"antes de gerar."
        )
    return resultado.texto, aviso


def passo_gerar(caminho_audio: str | None, texto: str, intensidade: str, velocidade: float):
    if not caminho_audio:
        raise gr.Error("Grave ou envie um áudio primeiro.")
    if not texto or not texto.strip():
        raise gr.Error("O texto está vazio — transcreva ou escreva algo antes de gerar.")

    texto_com_pausas = inserir_pausas(texto, intensidade=intensidade)
    caminho_saida = Path(tempfile.gettempdir()) / "voz-certa-saida.wav"
    clonar_e_sintetizar(texto_com_pausas, caminho_audio, caminho_saida, velocidade=velocidade)
    return str(caminho_saida)


with gr.Blocks(title="Voz Certa — IBSDH") as app:
    gr.Markdown("# Voz Certa")
    gr.Markdown(AVISO_CONSENTIMENTO)

    audio_entrada = gr.Audio(
        sources=["upload", "microphone"],
        type="filepath",
        label="1. Sua gravação (a indução original, com a sua voz)",
    )
    btn_transcrever = gr.Button("Transcrever")
    aviso_idioma = gr.Markdown("")
    texto_transcrito = gr.Textbox(
        label="2. Texto transcrito — revise e corrija antes de gerar",
        lines=8,
        placeholder="Aparece aqui depois de clicar em Transcrever. Pode editar à vontade.",
    )
    btn_transcrever.click(
        passo_transcrever, inputs=[audio_entrada], outputs=[texto_transcrito, aviso_idioma]
    )

    with gr.Row():
        intensidade = gr.Radio(
            choices=list(INTENSIDADES),
            value="media",
            label="3. Intensidade das pausas",
        )
        velocidade = gr.Slider(
            minimum=VELOCIDADE_MINIMA,
            maximum=VELOCIDADE_MAXIMA,
            value=0.85,
            step=0.05,
            label="Velocidade da fala (abaixo de 1.0 = mais devagar)",
        )

    btn_gerar = gr.Button("4. Gerar com a sua voz corrigida", variant="primary")
    gr.Markdown(AVISO_DEMORA)
    audio_saida = gr.Audio(label="Resultado", type="filepath")

    btn_gerar.click(
        passo_gerar,
        inputs=[audio_entrada, texto_transcrito, intensidade, velocidade],
        outputs=[audio_saida],
    )


if __name__ == "__main__":
    app.launch()

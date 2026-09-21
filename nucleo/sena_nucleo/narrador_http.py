"""
Um narrador que fala com qualquer API de chat compatível com OpenAI.

┌───────────────────────────────────────────────────────────────────────┐
│  POR QUE ESTE ARQUIVO É SEPARADO DE `narrativa.py`                    │
│                                                                       │
│  `narrativa.py` é o núcleo: sem rede, sem chave, sem fornecedor, e    │
│  testável em 3 ms. Este arquivo é o plugue. Quem só quer simular a    │
│  semana nunca importa este módulo, e nenhum teste do núcleo depende   │
│  de rede.                                                             │
│                                                                       │
│  O repositório hoje usa Groq (ver `appscript/groq-resiliente.gs`), e  │
│  a API da Groq é compatível com o formato da OpenAI. Por isso este    │
│  adaptador fala esse formato em vez de um SDK: com a URL base trocada │
│  ele serve Groq, serve um proxy local e serve o que vier depois, sem  │
│  nova dependência.                                                    │
└───────────────────────────────────────────────────────────────────────┘

## O que foi trazido do `groq-resiliente.gs`

Aquele arquivo existe porque um modelo descontinuado derrubou a IA do SENA
para todos os alunos, em silêncio. As três defesas que ele criou estão
reproduzidas aqui:

1. **Vários modelos em fila.** Se o primeiro responde 404/400 de modelo
   inexistente, tenta o seguinte.
2. **Repetição em falha transitória.** 429 e 5xx, com espera crescente.
3. **Resposta vazia é falha.** Modelo de raciocínio com orçamento apertado
   devolve conteúdo vazio com status 200; tratar isso como sucesso foi
   exatamente o que fez todo aluno ver o texto genérico da tela.

Nada aqui trata a falha final: quem chama é `narrativa.narrar`, que cai
para o narrador fixo. Este módulo só levanta a exceção.

## Configuração

Por variável de ambiente, para chave de API não encostar em código:

    SENA_IA_URL      https://api.groq.com/openai/v1/chat/completions
    SENA_IA_CHAVE    a chave
    SENA_IA_MODELOS  modelo-preferido,modelo-reserva   (separados por vírgula)
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request

#: Esperas entre tentativas, em segundos. Três tentativas no total.
#:
#: Curtas porque há um aluno olhando a tela esperando a sessão abrir. Uma
#: política de repetição generosa aqui transforma "a fala saiu genérica"
#: em "a página travou", que é pior.
ESPERAS = (0.5, 1.5)

#: Além disto, desistimos. O aluno não espera meio minuto por uma fala.
TIMEOUT_SEGUNDOS = 12


class FalhaDoNarrador(RuntimeError):
    """Não foi possível obter texto. Quem chama cai para o narrador fixo."""


def _pedir(url: str, chave: str, modelo: str, instrucoes: str) -> str:
    corpo = json.dumps(
        {
            "model": modelo,
            "messages": [{"role": "user", "content": instrucoes}],
            # Alto o bastante para o modelo não ser cortado no meio de uma
            # fala, baixo o bastante para não virar redação. Cinco falas
            # curtas cabem folgado em 400 tokens.
            "max_tokens": 400,
            # A fala de um paciente precisa variar entre sessões, senão o
            # aluno decora a abertura. Mas não tanto que o modelo comece a
            # inventar acontecimento que o motor não decidiu.
            "temperature": 0.85,
        }
    ).encode("utf-8")

    requisicao = urllib.request.Request(
        url,
        data=corpo,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {chave}",
        },
        method="POST",
    )

    with urllib.request.urlopen(requisicao, timeout=TIMEOUT_SEGUNDOS) as resposta:
        dados = json.loads(resposta.read().decode("utf-8"))

    try:
        conteudo = dados["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as erro:
        raise FalhaDoNarrador(f"resposta em formato inesperado: {erro}") from erro

    # Status 200 com conteúdo vazio é o modo de falha que derrubou a IA
    # deste sistema em silêncio. Aqui ele falha alto.
    if not conteudo or not conteudo.strip():
        raise FalhaDoNarrador(f"conteúdo vazio de {modelo}")

    return conteudo


def narrador_http(
    url: str | None = None,
    chave: str | None = None,
    modelos: tuple[str, ...] | None = None,
):
    """Monta um `Narrador` para injetar em `narrativa.narrar`.

    Devolve uma função, não um objeto, porque o protocolo `Narrador` pede
    apenas `(instrucoes) -> str` — e manter essa assinatura mínima é o que
    permite testar o núcleo com uma função de três linhas.
    """
    url = url or os.environ.get("SENA_IA_URL", "")
    chave = chave or os.environ.get("SENA_IA_CHAVE", "")
    if modelos is None:
        cru = os.environ.get("SENA_IA_MODELOS", "")
        modelos = tuple(m.strip() for m in cru.split(",") if m.strip())

    if not url or not chave or not modelos:
        raise FalhaDoNarrador(
            "narrador HTTP não configurado: defina SENA_IA_URL, SENA_IA_CHAVE "
            "e SENA_IA_MODELOS (ver o cabeçalho de narrador_http.py)"
        )

    def narrar_por_http(instrucoes: str) -> str:
        ultimo_erro: Exception | None = None

        for modelo in modelos:
            for tentativa in range(len(ESPERAS) + 1):
                try:
                    return _pedir(url, chave, modelo, instrucoes)
                except urllib.error.HTTPError as erro:
                    ultimo_erro = erro
                    if erro.code in (400, 404):
                        break  # modelo não existe: próximo da fila
                    if erro.code == 401:
                        raise FalhaDoNarrador("chave de API rejeitada") from erro
                    if erro.code != 429 and erro.code < 500:
                        break  # erro nosso: repetir não resolve
                except (urllib.error.URLError, TimeoutError, FalhaDoNarrador) as erro:
                    ultimo_erro = erro

                if tentativa < len(ESPERAS):
                    time.sleep(ESPERAS[tentativa])

        raise FalhaDoNarrador(f"nenhum modelo respondeu: {ultimo_erro}")

    return narrar_por_http

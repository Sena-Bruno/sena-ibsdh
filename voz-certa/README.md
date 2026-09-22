# Voz Certa

A ideia **#6** da lista de inovação: você grava a sua indução, o sistema
clona a sua voz e devolve **a mesma fala, com as suas palavras**, mas com
o ritmo e as pausas corrigidos para o registro de uma indução hipnótica.
Você ouve você mesmo fazendo certo.

## Por que isto é um programa local, não um site

O Paciente Vivo (etapa 4) roda de graça porque um serviço web comum
(FastAPI) cabe no plano gratuito do Render. Clonagem de voz é outra
categoria de custo: os modelos (XTTS-v2) têm vários gigabytes e
processar uma frase é lento sem placa de vídeo dedicada. Não existe
plano gratuito de hospedagem que aguente isso com qualidade e velocidade
razoáveis — hospedar custaria dinheiro de verdade (GPU alugada).

O caminho sem custo é rodar **na sua própria máquina**: você usa o poder
de processamento que já tem, sem pagar por servidor nenhum.

## Antes de tudo: consentimento

Esta ferramenta clona a voz de **quem gravou o áudio**. Use apenas a sua
própria voz, ou a de alguém que deu consentimento explícito e sabe que a
gravação será usada para isso. O aviso aparece também na tela do
programa — não é só aqui no README.

## Pré-requisitos

- **Python 3.10 ou 3.11** (a versão do TTS que usamos, `0.22.0`, costuma
  falhar para instalar em Python 3.12 ou mais novo — confira sua versão
  com `python3 --version` antes de começar).
- **ffmpeg** instalado no sistema (não é um pacote Python — é um programa
  à parte, que o Whisper e o TTS usam para ler áudio):
  - Windows: baixe em [ffmpeg.org](https://ffmpeg.org/download.html) e
    adicione a pasta `bin` ao PATH, ou instale via `choco install ffmpeg`
    se tiver o Chocolatey.
  - Mac: `brew install ffmpeg`
  - Linux: `sudo apt install ffmpeg` (ou o gerenciador de pacotes da sua
    distribuição)
- **~6 GB de espaço livre em disco** — os modelos (Whisper + XTTS-v2) são
  baixados automaticamente na primeira execução, uma vez só.
- Memória RAM: **8 GB ou mais** recomendado. Funciona com menos, mas mais
  devagar.

## Instalação

```bash
cd voz-certa
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

A instalação demora — `TTS` puxa `torch`, que é pesado. Isso é uma vez só.

## Rodando

```bash
python app.py
```

Abre um endereço tipo `http://127.0.0.1:7860` — cole no navegador (ou ele
abre sozinho). Fica só na sua máquina; nada sai para a internet, exceto o
download dos modelos na primeira vez que cada etapa rodar.

## Como usar

1. **Grave ou envie** o áudio da sua indução (direto no navegador, pelo
   microfone, ou envie um arquivo já gravado).
2. Clique em **Transcrever** — o texto aparece numa caixa editável.
   **Revise antes de continuar**: nenhuma transcrição automática é
   perfeita, e um erro aqui vira fala errada lá na frente.
3. Escolha a **intensidade das pausas** (leve / média / forte) e a
   **velocidade** da fala.
4. Clique em **Gerar com a sua voz corrigida** e espere — pode levar de
   30 segundos a alguns minutos, dependendo do seu computador. Sem placa
   de vídeo dedicada isso é normal, não é travamento.
5. Ouça o resultado direto na tela, ou baixe o arquivo.

## O que esta v1 não faz

Para não prometer mais do que a tecnologia de hoje entrega:

- **Não corrige ENTONAÇÃO/tom.** Síntese de voz por texto não dá esse
  controle fino — só controla ritmo (pausas no texto) e velocidade
  (parâmetro `speed`). Se um dia isso for viável (ex. clonando a partir de
  uma gravação de referência com a prosódia "certa", não só o timbre),
  é uma v2, não isto aqui.
- **Não decide ONDE deveria haver uma pausa que você não fez.** O módulo
  `voz_certa/prosodia.py` só ALONGA a pausa que já está na pontuação da
  sua fala transcrita — nunca inventa ênfase nova. Isto é uma escolha
  deliberada: "IA decidindo onde você deveria ter pausado" seria uma
  afirmação de autoridade sobre a sua condução que a ferramenta não tem
  base para fazer.
- **A precisão da transcrição depende do Whisper**, que erra mais com
  ruído de fundo, sotaque forte ou fala muito rápida. Por isso o passo 2
  é sempre revisável antes de gerar — a ferramenta nunca sintetiza um
  texto que você não confirmou.

## Testes

Só `voz_certa/prosodia.py` tem teste automatizado — é a única parte sem
dependência pesada (nenhum `torch`, nenhum `TTS`, nenhum
`faster-whisper`), então roda em qualquer máquina com Python puro, sem
precisar da instalação acima:

```bash
python3 -m unittest discover -s testes -t . -q
```

`transcricao.py` e `clonagem.py` são wrappers finos em cima dos modelos —
testar de verdade exigiria os pacotes pesados instalados (e um áudio de
amostra), então ficam sem teste automatizado aqui; a validação real é
usar o programa.

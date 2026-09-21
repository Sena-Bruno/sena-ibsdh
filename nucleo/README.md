# `nucleo/` — o motor Python do SENA

Primeira peça do SENA fora do Apps Script. Não substitui nada que esteja
no ar: é uma biblioteca nova, isolada, que o backend passa a chamar quando
a integração for feita.

**Rodar o motor** (zero dependência — só biblioteca padrão):

```bash
cd nucleo
python3 demo.py                              # a demonstração
python3 -m unittest discover -s testes -t .  # os testes do motor
```

**Rodar o serviço** (etapa 3 — precisa de FastAPI):

```bash
cd nucleo
pip install -r requirements-servico.txt
python3 demo_servico.py                                  # a demonstração
python3 -m unittest discover -s testes_servico -t . -q   # os testes do serviço
uvicorn sena_servico.api:app --reload                    # o servidor, com /docs
```

O motor continua zero-dependência de propósito: a primeira coisa que se
pede a alguém para instalar é a que decide se a peça vai ser usada ou
esquecida. O serviço (`sena_servico/`) é uma camada separada por cima —
quem só quer simular uma semana nunca precisa instalar FastAPI.

## O que isto resolve

Hoje o paciente virtual não tem memória. Cada sessão começa do zero, e o
que o aluno prescreveu na sessão anterior não tem consequência nenhuma. O
aluno aprende a **conduzir uma conversa** — e nunca aprende que uma
prescrição é uma aposta que dá certo ou errado na vida de alguém durante
os sete dias seguintes.

Este núcleo simula esses sete dias.

```
      sessão 1                    a semana                  sessão 2
   ┌─────────────┐   ┌──────────────────────────────┐   ┌─────────────┐
   │  o aluno    │   │  deriva do perfil            │   │  o paciente │
   │  prescreve  │──▶│  + adesão (ou falha)         │──▶│  chega      │
   │             │   │  + eventos de vida           │   │  DIFERENTE  │
   └─────────────┘   └──────────────────────────────┘   └─────────────┘
```

## A lição que o motor ensina

Uma prescrição tecnicamente correta pode ser clinicamente errada. Rode o
`demo.py`: o aluno prescreve ativação comportamental a um paciente
Depressivo — técnica **indicada**, prescrição **específica**, tudo "certo".
Só que a carga é 0,70 e o paciente tem energia 0,20.

Resultado: adesão 0/7. O paciente tenta, falha, e a falha vira prova de
incapacidade. Ele chega à sessão 2 **pior do que se nada tivesse sido
prescrito**.

A mesma semana com a dose certa ("abra a janela e sente perto dela"):
adesão 4/7, esperança e energia em alta.

Mesma técnica. Mesma clareza. A dose era a clínica.

## Os módulos

| Arquivo | O que faz |
|---|---|
| `estado.py` | As 7 dimensões internas do paciente, em [0, 1] |
| `perfis.py` | Os 8 perfis de `SimuladorView.vue`, agora com física própria |
| `prescricao.py` | O modelo de dose, ajuste ao perfil e adesão |
| `eventos.py` | O que acontece na vida do paciente sem pedir licença |
| `semana.py` | O motor dos 7 dias |
| `corpo.py` | O estado traduzido em sinais observáveis |
| `briefing.py` | A semana virando abertura de sessão e ficha de supervisor |
| `narrativa.py` | A semana decidida virando a voz do paciente (etapa 2) |
| `narrador_http.py` | O plugue para qualquer API de chat no formato OpenAI |

### A narração: o motor decide, a IA narra

`narrativa.py` entrega ao modelo de linguagem um objeto `Fatos` que **não
contém número nenhum** — nenhuma das sete dimensões, nenhuma leitura
clínica, nenhuma fração de adesão. Só o que aconteceu, o quadro do
paciente e a faixa de cumprimento em palavra ("fez_algumas_vezes").

Isso não é uma instrução no prompt, que seria promessa. É estrutura: o
narrador não pode vazar a aliança porque nunca a recebeu, e não pode
contradizer a prescrição porque não decide nada. Um prompt mal escrito
degrada o texto; não consegue vazar o que não foi entregue.

Três defesas em volta:

- **Validação por linha.** Número, jargão clínico ou redação de 400
  caracteres derrubam aquela fala, não a sessão inteira.
- **Queda automática.** Sem narrador, com narrador que explode, com
  resposta vazia ou com tudo inválido, a fala volta a ser o texto fixo de
  `eventos.py`. Uma sessão com fala menos viva é um problema; uma sessão
  que não abre é um aluno perdido.
- **Fila de modelos e repetição** em `narrador_http.py`, trazidas do
  `appscript/groq-resiliente.gs` — inclusive tratar resposta vazia com
  status 200 como falha, que é o modo em que a IA deste sistema já caiu
  em silêncio uma vez.

Para ligar o modelo de verdade:

```bash
export SENA_IA_URL=https://api.groq.com/openai/v1/chat/completions
export SENA_IA_CHAVE=...
export SENA_IA_MODELOS=modelo-preferido,modelo-reserva
```

```python
from sena_nucleo.narrativa import narrar
from sena_nucleo.narrador_http import narrador_http

falas = narrar(semana, perfil, narrador_http())
```

Nenhum teste toca a rede: o núcleo é testado com narradores de três linhas.

### Duas regras que não podem ser quebradas

**1. Determinismo por semente.** `simular_semana` recebe `semente` e nunca
toca no `random` global. Três coisas dependem disso: o teste, a Máquina do
Tempo (comparar prescrições exige rodar a *mesma* semana) e a Arena (dois
alunos recebendo o mesmo caso).

O motor consome um sorteio de adesão por dia **mesmo quando não há
prescrição**. Parece desperdício e é o contrário — é o que mantém o fluxo
alinhado entre duas simulações da mesma semente. Sem isso, os eventos de
vida caem em dias diferentes e a comparação contrafactual credita à
prescrição uma diferença que é puro acaso. Há teste de regressão para
isso em `testes/test_semana.py`.

**2. O que o aluno vê nunca contém a leitura técnica.**
`briefing.fala_de_abertura` e `corpo.descrever` devolvem o que uma pessoa
diria e o que uma câmera veria. Jamais a conclusão. No instante em que o
simulador entrega "ele está resistindo", ele para de treinar calibração e
passa a treinar leitura de legenda.

A leitura técnica existe em `ficha_do_supervisor` e em
`corpo.sinais_de_alerta`, e são para **depois** da sessão. Há testes que
falham se vocabulário técnico ou número vazar para a fala do paciente.

## O que este núcleo destrava

Ele foi desenhado como base compartilhada, não como recurso único:

| Ideia | O que reaproveita |
|---|---|
| **Paciente que vive entre sessões** | tudo — é este núcleo |
| **Paciente com corpo** | `corpo.py`, já pronto |
| **Máquina do Tempo** | `simular_alternativa`, já pronto |
| **Terapia de família** | vários `EstadoPaciente` interagindo |
| **Paciente adversarial** | o mesmo estado com política adversarial |
| **Autópsia do caso** | a verdade oculta guardada no estado |

## Calibração — leia antes de mexer nos números

As constantes deste motor são **hipóteses clínicas**, não verdades. Estão
todas nomeadas e comentadas com a razão de serem o que são, e três delas
já foram corrigidas por contradizerem a clínica:

- **A deriva é proporcional ao que resta**, não absoluta. Deriva constante
  numa escala fechada marcha para o extremo e encosta nele: o Depressivo
  zerava a esperança antes do quarto dia, e a partir dali toda condução
  dava no mesmo resultado. O perfil que mais precisa de resolução era o
  que tinha menos.

- **Os fatores de adesão orbitam 1,0**, não são todos menores que 1. Na
  primeira versão eles se empilhavam para baixo e um Depressivo chegava a
  15% ao dia mesmo com a tarefa mais leve possível — o motor concluía que
  prescrever é sempre pior que não prescrever, e teria ensinado a não
  prescrever a pacientes deprimidos.

- **A penalidade por falha escala com a carga, com piso baixo.** É o que
  faz o modelo expressar a ativação comportamental em vez de contrariá-la:
  encolher o pedido até que falhar quase não machuque é *como* a técnica
  funciona.

O caminho certo para calibrar não é ajustar até o número ficar bonito — é
o Bruno rodar casos conhecidos e dizer onde o motor discorda da clínica.
Cada discordância vira um teste em `testes/`, e a constante muda depois
disso, nunca antes.

## Etapa 3 — persistência e API (`sena_servico/`)

Onde o paciente passa a ter memória de verdade: SQLite guardando
`estado_atual` por (aluno, curso), e uma API FastAPI por cima.

| Arquivo | O que faz |
|---|---|
| `sena_servico/banco.py` | Esquema SQLite + conexão |
| `sena_servico/repositorio.py` | Ponte entre linhas de banco e objetos do motor |
| `sena_servico/narrador.py` | Monta o narrador HTTP a partir do ambiente, uma vez |
| `sena_servico/api.py` | FastAPI — as rotas |

**A decisão central desta camada**: como o motor é determinístico por
semente (invariante desde a etapa 0), o banco NUNCA guarda o dia-a-dia de
uma semana. Guarda `estado_inicial` + `prescrição` + `semente`, e
`sena_nucleo.semana.simular_semana` reproduz a semana inteira a qualquer
momento — com o código de HOJE, não o de quando a semana foi vivida. É
por isso que `repositorio.reconstruir_semana` existe: os três campos
denormalizados na tabela `semanas` (`dias_cumpridos`, `houve_sobrecarga`,
`deterioracao_clinica`) são instantâneo para listagem rápida, e ficam
desatualizados se a lógica de avaliação mudar de novo — o que já
aconteceu uma vez, na etapa 1. Código que DECIDE algo reconstrói; código
que só LISTA usa os campos denormalizados.

**Idempotência.** `criar_ou_obter_paciente` nunca duplica um caso clínico
por causa de um retry de rede: um paciente vivo por (aluno_email, curso),
sempre.

**Onde as etapas 2 e 3 se encontram.** A narração por IA não tinha onde
acontecer de verdade até existir estado persistente para narrar a
evolução de. `POST /pacientes/{id}/sessoes` é esse lugar: chama
`narrar()` com o narrador HTTP se `SENA_IA_URL`/`SENA_IA_CHAVE`/
`SENA_IA_MODELOS` estiverem configuradas, e cai para o texto fixo do
motor se não estiverem — mesma garantia estrutural da etapa 2.

**Esta API ainda não é para o aluno acessar diretamente.** As respostas
incluem `estado_atual` e `ficha_do_supervisor` — leitura interna, nunca
segura para o navegador de um aluno. Separar "o que é seguro mostrar" (a
`abertura`, sem número, sem termo técnico) de "o que é leitura de
supervisor" é trabalho da etapa 4, que decide como isto chega ao SENA de
verdade (proxy do Netlify, autenticação por token).

## Ainda não existe

- Integração com o Apps Script / backend real do SENA — isso é a etapa 4.
- Separação entre resposta segura para aluno e leitura de supervisor na
  API (ver aviso acima). A etapa 3 prova que a persistência funciona; não
  decide o contrato final com o front.
- Autenticação na API do serviço. `sena_servico/api.py` confia em quem
  chama — está correto para uma prova isolada rodando localmente, e teria
  de mudar antes de qualquer exposição pública.

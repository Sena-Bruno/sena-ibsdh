# `nucleo/` — o motor Python do SENA

Primeira peça do SENA fora do Apps Script. Não substitui nada que esteja
no ar: é uma biblioteca nova, isolada, que o backend passa a chamar quando
a integração for feita.

**Rodar:**

```bash
cd nucleo
python3 demo.py                              # a demonstração
python3 -m unittest discover -s testes -t .  # os 79 testes
```

Sem dependências. Só a biblioteca padrão do Python 3.11+. Isso é
deliberado: a primeira coisa que se pede a alguém para instalar é a que
decide se a peça vai ser usada ou esquecida.

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

## Ainda não existe

- Integração com o Apps Script / backend. A biblioteca é pura.
- Persistência. Quem guarda o estado entre sessões é a camada de cima.
- Narração por IA. A semana é simulada, não escrita — os relatos dos
  eventos são texto fixo. Ligar um modelo para narrar o que o motor
  decidiu é o passo seguinte, e nessa ordem: o motor decide, a IA narra.
  O contrário devolveria o problema de hoje, em que nada tem consequência.

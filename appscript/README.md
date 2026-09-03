# Backend — Google Apps Script

Esta pasta **não é publicada pelo Netlify** e não faz parte do build do Vue.
Ela guarda as correções feitas no backend do SENA, que roda no Google Apps
Script (a URL do web app está configurada no `netlify.toml`, no proxy `/api`).

O código completo do backend vive no editor do Apps Script
([script.google.com](https://script.google.com)), não aqui. Esta pasta contém
apenas as funções alteradas, para não haver risco de uma cópia manual
incompleta do arquivo original virar a fonte da verdade.

## Arquivos

- `funcoes-corrigidas.gs` — correções de funções que já existiam no `Codigo.gs`
  (ver "O que foi corrigido" abaixo).
- `plantao.gs` — **arquivo novo**, do Modo Plantão. Cole como um arquivo
  separado no editor (Arquivo → + → Script) e adicione os 3 casos no `switch`
  do `doPost`; as linhas prontas estão no fim do arquivo.
- `posicao-ranking.gs` — **arquivo novo**. Implementa a posição do aluno no
  ranking, que o dashboard chamava (`action: 'ranking'`) sem nunca ter existido
  no backend. Cole como arquivo separado e adicione o caso no `switch`.
- `groq-resiliente.gs` — **arquivo novo**. Substitui a `chamarGroqAPI` do
  `Codigo.gs` por uma versão que tenta vários modelos e repete em falha
  transitória. **Apague a `chamarGroqAPI` antiga ao colar**, senão ficam duas
  funções com o mesmo nome.
- `evolucao-perfis.gs` — **arquivo novo**. Desempenho do aluno por perfil
  clínico, para o card do dashboard. Cole como arquivo separado e adicione o
  caso no `switch`.
- `tentativa-anterior.gs` — **arquivo novo**. Devolve a tentativa anterior do
  aluno numa aula, com o texto da resposta, para a tela montar o contraste.
  Cole como arquivo separado e adicione o caso no `switch`.
- `diagnostico.gs` — **arquivo novo**. Chama todas as actions pelo `doPost` e
  imprime uma tabela com tempo e status. Não altera nada; só diagnostica.
- `teste-equivalencia.mjs` — testes das funções corrigidas.
- `teste-diagnostico.mjs` — testes do motor de classificação do diagnóstico.
- `teste-tentativa-anterior.mjs` — testes da tentativa anterior.
- `teste-evolucao-perfis.mjs` — testes do desempenho por perfil
  (`node appscript/teste-evolucao-perfis.mjs`).
- `teste-groq-resiliente.mjs` — testes da chamada à Groq
  (`node appscript/teste-groq-resiliente.mjs`).
- `teste-posicao-ranking.mjs` — testes da posição no ranking
  (`node appscript/teste-posicao-ranking.mjs`).

> O `plantao.gs` traz uma função `testarPlantao()`. Rode-a no editor (seletor
> de função → **Executar**) e leia o **Registro de execução**: ela dispara as
> três ações pelo `doPost` real, então mostra tanto erros internos quanto
> `Ação desconhecida` — que é o sinal de que os casos não foram adicionados ao
> `switch`. Ela grava uma linha de teste em `Plantao_Historico` com o e-mail
> `teste@ibsdh.com.br`, que pode ser apagada depois.

> O projeto no Apps Script tem mais de um arquivo: `Codigo.gs` (o grande, com
> `doGet`/`doPost` e a lógica), `Setup.gs` (utilitários que criam e formatam as
> abas) e os templates HTML `Index`, `Dashboard`, `Certificado` e `Validar`.

## Como aplicar

Abra o projeto no editor do Apps Script e:

1. **`buscarRankingPerfis`** e **`buscarRespostasParaMentor`** — substitua as
   funções inteiras pelas versões de `funcoes-corrigidas.gs`.
2. **`gerarReplayAnotado`** e **`validarDadosEntrada`** — são correções de uma
   linha cada; os trechos exatos estão comentados no fim de
   `funcoes-corrigidas.gs`.
3. Opcionalmente cole também a função `medirDesempenho()` e rode para comparar
   os tempos antes/depois (o resultado sai no Registro de execução).

> **Atenção sobre a publicação:** salvar no editor não altera o que está no ar
> se a implantação do web app estiver fixada numa versão específica. Nesse
> caso é preciso ir em **Implantar → Gerenciar implantações → editar (lápis) →
> Versão: Nova versão → Implantar**. Se a implantação estiver como "HEAD"
> (`@HEAD`), o salvar já basta.

## O que foi corrigido e por quê

### 1. `buscarRespostasParaMentor` — página do Mentor travava

A função carregava a aba `Respostas_Aluno` inteira na memória, incluindo a
coluna `resposta_texto` (até 5.000 caracteres por linha), montando um mapa com
**todas** as respostas de **todos** os alunos — para usar no máximo 5 delas.

Num teste com 2.000 respostas, isso significa **11 MB transferidos do Sheets a
cada chamada**. Era por isso que a chamada não respondia nem em 15 segundos.

Agora a função lê apenas a coluna de IDs (leve) para montar um índice
`id → linha`, e busca o texto de cada candidato individualmente — no máximo ~5
leituras de célula. **11 MB → 0,21 MB (98% menos dados).**

### 2. `buscarRankingPerfis` — página do Ranking lenta

Mesmo problema: lia a aba `Avaliacoes_SENA` completa, trazendo as quatro
colunas de texto longo geradas pela IA (`fortes`, `atencao`, `prescricao`,
`justificativa`) sem usar nenhuma delas.

Agora lê só o bloco mínimo de colunas necessário e guarda o resultado em cache
por 5 minutos (`CacheService`), já que o ranking é um agregado da turma inteira
e não muda a cada segundo. **3,18 MB → 0,10 MB (97% menos dados)**, e zero
leitura nas chamadas seguintes dentro da janela de cache.

### 3. `gerarReplayAnotado` — o replay nunca via a resposta do aluno

Dentro de um template literal (crase), estava escrito `+ resposta +` como
**texto literal** em vez de `${resposta}`. A IA recebia a string
`" + resposta + "` no lugar da resposta real, então o recurso de replay
anotado estava quebrado silenciosamente.

### 4. `validarDadosEntrada` — erro de e-mail virava mensagem confusa

Todas as validações da função usam `throw`, menos a do e-mail, que fazia
`return { erro: true, ... }`. Quem chama (`avaliarResposta`) não checava esse
retorno e seguia com `curso`/`aula` indefinidos, fazendo o aluno ver
*"Aula não encontrada na Base_Aulas: undefined / undefined"* em vez da
mensagem amigável que o código tentava dar.

### 5. `chamarGroqAPI` — um modelo descontinuado derrubava tudo

`CONFIG.MODEL_NAME` era uma string única. Quando a Groq aposentou o
`llama-3.3-70b-versatile`, **toda a avaliação por IA parou de uma vez** —
simulador, tutor, replay, desafio — e o problema só apareceu quando um aluno
tentou usar. A Groq roda modelos abertos de terceiros e aposenta versões com
frequência, então isso se repete.

`groq-resiliente.gs` tenta os modelos em ordem de preferência e classifica cada
falha para decidir o que fazer: modelo inexistente é pulado na hora (insistir
só atrasa o aluno), `429` e `5xx` são repetidos, `200` com conteúdo vazio conta
como falha (modelo de raciocínio pode gastar todo o `max_tokens` pensando), e
chave inválida aborta tudo imediatamente — mascarar isso como "modelos fora do
ar" mandaria você procurar o problema no lugar errado.

Quando um modelo cai, sai uma linha `GROQ_FALLBACK` na aba de Logs e, se a
propriedade de script `EMAIL_ADMIN` estiver definida, um e-mail — no máximo um
por dia por modelo, para não virar spam num dia de instabilidade. O aluno não
vê nada: recebe a avaliação normalmente.

Para provar que funciona, rode `testarFallbackGroq()` no editor: ela põe um
modelo inexistente na frente da lista, confirma que a avaliação sai mesmo
assim, e restaura a lista no fim.

**A primeira versão desta blindagem cobria 1 de 7 caminhos.** O projeto tem
sete lugares que chamam a Groq, cada um com sua cópia do `UrlFetchApp`, e só
`processarAvaliacaoComBaseCurricular` passava pelo `chamarGroqAPI`. Por isso o
núcleo virou `chamarGroqCore(mensagens, opcoes)`: `chamarGroqAPI` (JSON) e
`chamarGroqTexto` (prosa) delegam a ele, e as demais funções podem migrar sem
recriar a lógica. Faltam migrar `gerarBoasVindas`, `gerarRelatorioEvolucao`,
`analisarDiarioSemanal`, `gerarReplayAnotado` e `responderComoPaciente`.

### 6. `gerarBoasVindas` — mensagem de boas-vindas vazia

`max_tokens: 120`. Com um modelo de raciocínio, o raciocínio consome o
orçamento e o `content` volta vazio: a chamada gasta ~1,9s e devolve
`{"mensagem":""}`. O frontend testa `data.mensagem.length > 10` e cai no texto
padrão — ou seja, todo aluno via o texto genérico, e nada indicava falha.
Achado pelo `diagnosticarIA()`.

## Testes

`teste-equivalencia.mjs` simula a API do Sheets em Node e **prova que as
versões novas devolvem exatamente o mesmo resultado que as originais** — em
bases de 30, 400 e 2.000 linhas, para vários cursos, mentores e filtros de
aula. Também cobre o filtro de "já avaliados", o limite de 5 itens, respostas
curtas, abas vazias e parâmetros indefinidos, além de medir a redução no
volume de dados.

```bash
npm test                # tudo: frontend + appscript
npm run test:appscript  # só os harnesses desta pasta
```

Não requer dependências. As implementações originais estão embutidas no
arquivo de teste como referência de comparação.

## Está tudo funcionando? — como descobrir

Comparar nomes de action entre frontend e backend só prova que o código
existe. Foi assim que o `ranking` passou meses "construído" e quebrado: o
frontend chamava, o backend não tinha o caso, e um `catch` vazio engolia.

`diagnostico.gs` responde com evidência. Cole no editor e rode:

| função | o que faz | cuidado |
|---|---|---|
| `diagnosticarTudo()` | as actions de leitura | seguro, pode repetir |
| `diagnosticarIA()` | as que chamam a Groq | **consome cota** |
| `diagnosticarEscrita()` | as que gravam | **escreve na planilha** |

Troque `DIAG.EMAIL` por um aluno real antes — com e-mail inexistente quase
tudo responde vazio, que é correto e não prova nada.

O status separa quatro coisas que um relatório ingênuo confundiria:
**FALTA NO SWITCH** (o caso não foi colado no `doPost`), **ERRO** (a função
rodou e falhou), **VAZIO** (respondeu certo, sem dados) e **LENTO** (acima de
15s — o travamento do Mentor aparecia assim, não como erro).

### O que o diagnóstico não alcança

Ele prova que a action responde, não que a resposta faz sentido. O bug do
`gerarReplayAnotado` — `+ resposta +` como texto literal em vez de
interpolação — devolvia HTTP 200 com texto plausível e sem relação com a
resposta do aluno. Para esse tipo de coisa é preciso ler a saída: em
`diagnosticarIA()`, o caso do `replay` manda uma frase conhecida justamente
para dar para conferir se ela aparece no retorno.

### O que o inventário encontrou (03/09/2026)

Rodado com o e-mail de exemplo, então as respostas `VAZIO` não valem como
diagnóstico. O que vale:

- **Nenhum `FALTA NO SWITCH`** — todas as actions estão roteadas.
- **Nenhum `LENTO`.** `buscar_mentor` respondeu em **485ms** e
  `ranking_perfis` em **333ms**. O Mentor antes não respondia nem em 15s: é a
  confirmação, em produção, de que as correções de leitura acima estão
  aplicadas.

**`titulos` NÃO é funcionalidade escondida.** Ele devolve um mapa
aula → título (`{"Aula_1":"O CÓDIGO DA EXCELÊNCIA...","Aula_2":...}`), e o
`estrutura_curso` já entrega o mesmo título dentro de cada aula — o
`DashboardView.vue:723` monta exatamente esse mapa a partir dele. A action é
**redundante**; nenhuma tela chama porque nenhuma precisa.

Registrado aqui porque eu havia afirmado o contrário, inferindo pelo nome sem
olhar o retorno. O inventário **não** encontrou recurso pronto e invisível.

## Se quiser versionar o backend inteiro no futuro

O caminho é o [`clasp`](https://github.com/google/clasp), a ferramenta oficial
do Google (requer Node.js e habilitar a API do Apps Script em
`script.google.com/home/usersettings`):

```bash
npm install -g @google/clasp
clasp login
mkdir sena-appscript && cd sena-appscript
clasp clone SEU_SCRIPT_ID    # o ID está em ⚙️ Configurações do projeto
```

Depois é `clasp push` para enviar mudanças e `clasp pull` para baixar.

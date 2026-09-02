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
- `teste-equivalencia.mjs` — testes das funções corrigidas.

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

## Testes

`teste-equivalencia.mjs` simula a API do Sheets em Node e **prova que as
versões novas devolvem exatamente o mesmo resultado que as originais** — em
bases de 30, 400 e 2.000 linhas, para vários cursos, mentores e filtros de
aula. Também cobre o filtro de "já avaliados", o limite de 5 itens, respostas
curtas, abas vazias e parâmetros indefinidos, além de medir a redução no
volume de dados.

```bash
node appscript/teste-equivalencia.mjs
```

Não requer dependências. As implementações originais estão embutidas no
arquivo de teste como referência de comparação.

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

# De onde vem cada número

Este motor simula evolução clínica. Os números dentro dele não são neutros:
eles ensinam. Este arquivo registra, para cada constante, **se ela tem
fundamento publicado ou se é hipótese** — e quando é hipótese, diz isso com
todas as letras.

> **O instituto não tem, hoje, profissional com registro em saúde
> responsável por este conteúdo.** Enquanto isso for verdade, o SENA não
> pode fazer alegação de realismo clínico, e este arquivo é o que mantém a
> distinção visível para quem for mexer no código depois.

---

## Por que este arquivo existe

A primeira versão deste motor foi calibrada por plausibilidade — números
que *soavam* certos, escritos por um modelo de linguagem sem experiência
clínica. Quando finalmente foram conferidos contra a literatura, quatro
deles estavam **com o sinal invertido**, não apenas imprecisos:

| O que o motor dizia | O que a pesquisa mede |
|---|---|
| Paciente sem tratamento desaba | Lista de espera **melhora** (g = 0,37 pré-pós) |
| 0% remitem sozinhos | 12,5% remitem em 12 semanas |
| 85–100% das semanas pioram | 12–13% deterioram nos controles |
| Risco sobe 0,22/semana sozinho | Sem sustentação na literatura |

O motor ensinava que o tempo destrói o paciente. A pesquisa descreve o
oposto: quem procura ajuda procura no pior momento, e o que se segue é
retorno ao nível habitual.

**Isso não empobreceu o produto — melhorou.** Se o paciente melhora um
pouco sozinho, o aluno não pode mais creditar toda melhora à própria
técnica. Ele passa a ter de perguntar "fui eu ou foi o tempo?", que é das
perguntas mais difíceis da clínica. O modelo anterior tornava essa lição
impossível de ensinar.

---

## ✅ Constantes com fundamento publicado

### Curso natural sem tratamento → `PerfilClinico.equilibrio` e `taxa_de_retorno`

Grupos de lista de espera são a medição empírica de "sem intervenção".

- Pré-pós em lista de espera para depressão: **g = 0,37** — melhora, não
  piora ([Cuijpers et al., *Epidemiology and Psychiatric Sciences*, 2024](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11561681/))
- Ansiedade social: **g = 0,128** ([Steinert et al., 2016](https://pubmed.ncbi.nlm.nih.gov/27445199/))
- Sintomas caem **10–15%** sem tratamento ([Posternak & Miller, *J Affect Disord*, 2001](https://pubmed.ncbi.nlm.nih.gov/11578666/))

**No motor:** `taxa_de_retorno` entre 0,005 e 0,009 ao dia. Dez semanas
encadeadas produzem **−13,1%** de sofrimento, dentro da faixa de 10–15%.
Travado por `test_queda_de_sintoma_em_dez_semanas_bate_com_a_literatura`.

### Remissão espontânea → emerge da regressão

- **12,5%** remitem sem tratamento em 12 semanas, IC 95% [7,8; 18,0]
  ([Whiteford et al., *J Affect Disord*, 2021](https://pubmed.ncbi.nlm.nih.gov/34583099/))
- **23%** em 3 meses, **53%** em 12 meses ([Whiteford et al., *Psychol Med*, 2013](https://pubmed.ncbi.nlm.nih.gov/22883473/))

### Deterioração → `LIMIAR_DE_DETERIORACAO`

- **12–13%** deterioram em grupos de controle; **4–5%** em terapia
  ([Cuijpers et al., *Acta Psychiatr Scand*, 2021](https://onlinelibrary.wiley.com/doi/10.1111/acps.13335))
- Mediana de 4% em grupos de terapia ([Rozental et al., *J Affect Disord*, 2018](https://www.sciencedirect.com/science/article/abs/pii/S0165032717316907))

**No motor:** o motor produz **12,1%**. Travado por
`test_deterioracao_fica_na_faixa_dos_controles`.

### Adesão a tarefa de casa → `probabilidade_de_adesao`

- Adesão observada: **39–63%** ([Peris et al., 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8183976/))
- Adesão ↔ desfecho: **r = 0,26** ([Mausbach et al., *Cognit Ther Res*, 2010](https://link.springer.com/article/10.1007/s10608-010-9297-z))

### Aliança → `fator_alianca`

- Aliança ↔ desfecho: **r = 0,278** (d = 0,58), 295 estudos, +30.000
  pacientes ([Flückiger et al., *Psychotherapy*, 2018](https://pubmed.ncbi.nlm.nih.gov/29792475/))

### Ativação comportamental → `EFEITOS_DIARIOS`

- Contra controle inativo: **g = 0,83**; SMD −0,74
  ([Ekers et al., *PLOS ONE*, 2014](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0100100))
- Não difere de outras terapias ativas — o que justifica o efeito ser
  modesto e dependente de dose, não milagroso.

---

## ⚠️ Constantes SEM fundamento publicado

**Tudo abaixo é hipótese.** Foi escolhido por coerência interna, não colhido
de pesquisa. Um clínico revisando deve começar por aqui.

| Constante | O que é | Base |
|---|---|---|
| `carga_tolerada` por perfil | Teto de exigência semanal | Nenhuma. A *direção* (deprimido tolera menos) é consensual; os valores, não |
| `indicadas` / `contraindicadas` | Que técnica combina com que perfil | Conhecimento clínico geral, sem meta-análise por perfil |
| `EFEITO_DA_FALHA` e `peso_da_falha` | Custo de não cumprir a tarefa | Nenhuma. Que falha custa é consensual; quanto, não |
| `GANHO_DE_ADESAO` | Espiral positiva do cumprimento | Nenhuma |
| Os 8 `equilibrio`, dimensão a dimensão | Onde cada perfil se assenta | Só o sofrimento está ancorado; as outras seis são coerência |
| `amortecer()` | Aliança amortece evento ruim | Plausível pela pesquisa de aliança, mas o fator 0,45 é inventado |
| Pesos e efeitos dos eventos de vida | O que acontece e quanto pesa | Nenhuma. São neutros por construção, o que é escolha, não achado |
| `CHANCE_DE_EVENTO_POR_DIA` = 0,35 | ~2,45 eventos por semana | Nenhuma. Escolhido por legibilidade da tela |
| As 7 dimensões e seus limites | O espaço de estado | Nenhuma. Não corresponde a instrumento validado |
| `LIMIAR_DE_DETERIORACAO` = −0,15 | Corte de piora significativa | **Calibrado contra** os 12–13% publicados, não colhido de artigo |

### A limitação que vale dizer alto

As sete dimensões **não são um instrumento psicométrico**. Não são PHQ-9,
não são BDI, não são nada validado. São um espaço de estado inventado para
que a simulação tenha o que mover.

Isso significa que a ancoragem acima é **por analogia**: quando a
literatura diz "sintomas caem 10–15%", eu apliquei isso a `sofrimento`,
que não é uma escala de sintoma medida — é uma variável deste motor. A
direção e a ordem de grandeza se sustentam; a precisão, não.

---

## O que o produto pode e não pode dizer

**Pode:** que a evolução entre sessões segue a direção e a ordem de
grandeza que a pesquisa de desfecho descreve, com as fontes listadas aqui.

**Não pode:** que o simulador prediz o curso de um paciente real; que os
números correspondem a instrumento clínico; que o conteúdo tem respaldo
profissional — **não tem, e enquanto não tiver, esta linha fica aqui.**

---

## Para quem for calibrar isto depois

1. Comece pela tabela ⚠️ — é lá que estão os chutes.
2. Discorde com um caso, não com uma opinião: "um obsessivo com energia
   0,55 não cumpre 75% de uma tarefa de carga 0,7" é acionável.
3. Toda discordância aceita vira **teste** em `testes/`, em português,
   antes de a constante mudar. Assim a correção fica travada.
4. Rode `python3 -m unittest discover -s testes -t .` antes e depois.

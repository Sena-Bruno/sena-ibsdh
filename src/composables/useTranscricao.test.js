// Testes da junção de texto da transcrição por voz.
//
// Este arquivo existe por um motivo específico: useTranscricao.js tem duas
// regras vizinhas que PARECEM contradizer uma à outra —
//
//   1. repetição do trecho INTEIRO é descartada em qualquer tamanho,
//      inclusive uma palavra só;
//   2. sobreposição PARCIAL na fronteira exige 2 ou mais palavras.
//
// A diferença se apoia num fato sobre o motor de voz que não dá para deduzir
// lendo o código: uma repetição realmente falada ("sim sim") volta como UM
// único transcript, nunca como dois trechos separados. Logo, dois trechos
// idênticos em sequência são sempre artefato do motor — enquanto uma palavra
// solta repetida na FRONTEIRA entre dois trechos pode ser fala legítima.
//
// Um comentário guarda a intenção; estes testes guardam o comportamento. Sem
// eles, a próxima edição do arquivo traz o bug de volta em silêncio — e o
// sintoma não aparece aqui, aparece na resposta clínica de um aluno.
//
// Roda com o runner embutido do Node, sem dependência:  node --test src/

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { juntarSemDuplicar, montarTextoDaSessao } from './useTranscricao.js'

describe('juntarSemDuplicar', () => {
  test('base ou trecho vazio devolve o outro', () => {
    assert.equal(juntarSemDuplicar('', 'olá'), 'olá')
    assert.equal(juntarSemDuplicar('olá', ''), 'olá')
    assert.equal(juntarSemDuplicar('', ''), '')
    assert.equal(juntarSemDuplicar(null, undefined), '')
  })

  test('normaliza espaços em excesso e nas pontas', () => {
    assert.equal(juntarSemDuplicar('  bom   dia  ', ' tudo  bem '), 'bom dia tudo bem')
  })

  test('trechos sem relação são concatenados', () => {
    assert.equal(
      juntarSemDuplicar('o paciente chegou', 'muito ansioso'),
      'o paciente chegou muito ansioso'
    )
  })

  // ── Trechos cumulativos (padrão do Chrome no Android) ─────────────────
  describe('trecho cumulativo', () => {
    test('substitui a base quando o novo a contém e cresceu', () => {
      assert.equal(juntarSemDuplicar('estou', 'estou testando'), 'estou testando')
      assert.equal(
        juntarSemDuplicar('estou testando', 'estou testando minha voz'),
        'estou testando minha voz'
      )
    })

    test('uma sequência cumulativa inteira converge para o último trecho', () => {
      const trechos = ['bom', 'bom dia', 'bom dia doutor', 'bom dia doutor tudo bem']
      const texto = trechos.reduce((acc, t) => juntarSemDuplicar(acc, t), '')
      assert.equal(texto, 'bom dia doutor tudo bem')
    })

    test('ignora diferença de caixa ao reconhecer o prefixo', () => {
      assert.equal(juntarSemDuplicar('Bom dia', 'bom dia doutor'), 'bom dia doutor')
    })
  })

  // ── Reemissão do trecho inteiro (o bug relatado) ──────────────────────
  describe('reemissão do trecho inteiro', () => {
    test('descarta trecho idêntico ao fim do acumulado', () => {
      assert.equal(
        juntarSemDuplicar('isso é um teste', 'um teste'),
        'isso é um teste'
      )
    })

    // Este é o caso exato relatado pelo usuário: "esse esse esse aqui é um
    // teste". Uma palavra só, reemitida a cada reinício de sessão. Se alguém
    // exigir 2+ palavras aqui "por simetria" com a sobreposição parcial,
    // este teste falha — que é justamente o ponto.
    test('descarta repetição de UMA palavra só', () => {
      assert.equal(juntarSemDuplicar('esse', 'esse'), 'esse')
      assert.equal(juntarSemDuplicar('esse aqui é um teste', 'teste'), 'esse aqui é um teste')
    })

    test('a mesma palavra reemitida várias vezes não se acumula', () => {
      const trechos = ['aparentemente', 'aparentemente', 'aparentemente', 'aparentemente']
      const texto = trechos.reduce((acc, t) => juntarSemDuplicar(acc, t), '')
      assert.equal(texto, 'aparentemente')
    })

    test('reconstrói a frase do relato original sem duplicar', () => {
      const trechos = [
        'esse', 'esse', 'esse aqui é um teste', 'de correção',
        'aparentemente', 'aparentemente', 'ele está duplicando'
      ]
      const texto = trechos.reduce((acc, t) => juntarSemDuplicar(acc, t), '')
      assert.equal(texto, 'esse aqui é um teste de correção aparentemente ele está duplicando')
    })

    test('ignora diferença de caixa na reemissão', () => {
      assert.equal(juntarSemDuplicar('bom dia doutor', 'Doutor'), 'bom dia doutor')
    })
  })

  // ── Sobreposição parcial na fronteira ─────────────────────────────────
  describe('sobreposição parcial na fronteira', () => {
    test('costura o trecho novo removendo a parte repetida', () => {
      assert.equal(
        juntarSemDuplicar('o paciente relatou muita ansiedade', 'muita ansiedade e insônia'),
        'o paciente relatou muita ansiedade e insônia'
      )
    })

    test('prefere a maior sobreposição possível', () => {
      assert.equal(
        juntarSemDuplicar('vamos falar sobre isso agora', 'sobre isso agora com calma'),
        'vamos falar sobre isso agora com calma'
      )
    })

    // A REGRA OPOSTA À DE CIMA, e de propósito. Numa fala clínica, engolir um
    // "não" solto na fronteira inverte o sentido do que o paciente disse.
    // Por isso a sobreposição parcial exige 2+ palavras. Baixar esse limiar
    // para 1 faz este teste falhar.
    test('NÃO engole uma única palavra repetida na fronteira', () => {
      assert.equal(
        juntarSemDuplicar('ele disse não', 'não posso continuar'),
        'ele disse não não posso continuar'
      )
    })

    test('duas palavras na fronteira já são costuradas', () => {
      assert.equal(
        juntarSemDuplicar('ele disse que não', 'que não posso continuar'),
        'ele disse que não posso continuar'
      )
    })
  })
})

describe('montarTextoDaSessao', () => {
  // event.results é um array-like de resultados; cada um é array-like de
  // alternativas, e a primeira ([0]) é a de maior confiança.
  const res = (transcript, isFinal) => ({ 0: { transcript }, isFinal })

  test('separa final de interim', () => {
    const { final, interim } = montarTextoDaSessao([
      res('bom dia', true),
      res('doutor', true),
      res('estou fal', false)
    ])
    assert.equal(final, 'bom dia doutor')
    assert.equal(interim, 'estou fal')
  })

  test('lista vazia devolve os dois vazios', () => {
    assert.deepEqual(montarTextoDaSessao([]), { final: '', interim: '' })
  })

  test('aplica a junção sem duplicar entre os resultados finais', () => {
    const { final } = montarTextoDaSessao([
      res('esse', true),
      res('esse', true),
      res('esse aqui é um teste', true)
    ])
    assert.equal(final, 'esse aqui é um teste')
  })

  // É a propriedade que sustenta a decisão de reconstruir o texto do zero a
  // cada evento em vez de acumular com +=: não importa quantas vezes o motor
  // reemita, o resultado é sempre derivado do array autoritativo.
  test('é idempotente — mesmo array, mesmo texto', () => {
    const results = [res('bom dia', true), res('doutor tudo bem', true)]
    const a = montarTextoDaSessao(results)
    const b = montarTextoDaSessao(results)
    assert.deepEqual(a, b)
  })

  test('resultados finais chegando aos poucos convergem para o mesmo texto', () => {
    // o motor entrega o array crescendo a cada evento
    const passo1 = montarTextoDaSessao([res('bom dia', true)])
    const passo2 = montarTextoDaSessao([res('bom dia', true), res('doutor', true)])
    assert.equal(passo1.final, 'bom dia')
    assert.equal(passo2.final, 'bom dia doutor')
  })
})

// ── Ciclo de vida completo ──────────────────────────────────────────────
//
// O Chrome encerra e reinicia a sessão de voz sozinho várias vezes durante
// uma fala, mesmo com continuous=true, e às vezes reprocessa a cauda do áudio
// anterior. SimuladorView.vue lida com isso fechando o texto da sessão no
// acumulado a cada onend.
//
// Nenhum teste de unidade acima pega esse cenário: o bug relatado vivia na
// junção das duas funções ao longo de várias sessões.
describe('ciclo de vida com reinício de sessão', () => {
  // Espelha o que SimuladorView.vue faz em onresult e onend.
  function simular(sessoes) {
    let textoConsolidado = ''
    for (const results of sessoes) {
      const { final } = montarTextoDaSessao(results)          // onresult
      textoConsolidado = juntarSemDuplicar(textoConsolidado, final)  // onend
    }
    return textoConsolidado
  }

  const fin = (t) => ({ 0: { transcript: t }, isFinal: true })

  test('sessões consecutivas sem sobreposição são concatenadas', () => {
    assert.equal(
      simular([
        [fin('o paciente chegou agitado')],
        [fin('e falava muito rápido')]
      ]),
      'o paciente chegou agitado e falava muito rápido'
    )
  })

  test('cauda de áudio reprocessada na sessão seguinte não duplica', () => {
    assert.equal(
      simular([
        [fin('o paciente relatou muita ansiedade')],
        [fin('muita ansiedade e insônia há semanas')]
      ]),
      'o paciente relatou muita ansiedade e insônia há semanas'
    )
  })

  test('sessão inteira repetida é descartada', () => {
    assert.equal(
      simular([
        [fin('bom dia doutor')],
        [fin('bom dia doutor')]
      ]),
      'bom dia doutor'
    )
  })

  test('sessão vazia (silêncio) não afeta o acumulado', () => {
    assert.equal(
      simular([
        [fin('primeira parte')],
        [],
        [fin('segunda parte')]
      ]),
      'primeira parte segunda parte'
    )
  })

  test('fala longa com reinícios e reemissões resulta no texto limpo', () => {
    const texto = simular([
      // sessão 1: trechos cumulativos, como o Android entrega
      [fin('o paciente'), fin('o paciente chegou'), fin('o paciente chegou muito ansioso')],
      // sessão 2: reprocessa a cauda e continua
      [fin('muito ansioso'), fin('muito ansioso relatando insônia')],
      // sessão 3: reprocessa duas palavras da cauda antes de seguir
      [fin('relatando insônia'), fin('relatando insônia há três semanas')]
    ])
    assert.equal(texto, 'o paciente chegou muito ansioso relatando insônia há três semanas')
  })

  // CUSTO CONHECIDO E ACEITO, não um bug à espera de conserto.
  //
  // Quando a cauda reprocessada na fronteira entre sessões tem UMA palavra só,
  // ela é duplicada. É o preço da regra que exige 2+ palavras na sobreposição
  // parcial — a mesma que impede engolir o "não" de "ele disse não" seguido de
  // "não posso continuar", que inverteria o sentido de um relato clínico.
  //
  // Este teste está aqui para que a troca seja uma decisão visível: se um dia
  // alguém baixar o limiar para 1, este teste falha e obriga a reencarar a
  // pergunta em vez de descobrir o efeito colateral num texto de aluno.
  test('cauda de UMA palavra na fronteira entre sessões é duplicada (custo aceito)', () => {
    assert.equal(
      simular([
        [fin('relatando insônia')],
        [fin('insônia há três semanas')]
      ]),
      'relatando insônia insônia há três semanas'
    )
  })
})

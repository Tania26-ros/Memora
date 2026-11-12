import { describe, expect, it } from 'vitest'
import { parseWordList, phrase, sentenceOf, splitSentences, tokenize, wordsToQuestions } from './vocab'

describe('vocabulario', () => {
  const text = 'I wake up early. Then I take the bus to school!'
  const tokens = tokenize(text)
  it('separa palabras y conserva el texto', () => {
    expect(tokens.filter((t) => t.kind === 'word').length).toBe(11)
    expect(tokens.map((t) => t.value).join('')).toBe(text)
  })
  it('une una frase de varias palabras', () => {
    expect(phrase(tokens, 1, 2)).toBe('wake up')
    expect(phrase(tokens, 2, 1)).toBe('wake up')
  })
  it('encuentra la oración de contexto', () => {
    expect(sentenceOf(tokens, 1)).toBe('I wake up early.')
    expect(sentenceOf(tokens, 7)).toBe('Then I take the bus to school!')
  })
  it('lee una lista de palabras', () => {
    expect(parseWordList('apple - manzana\n2. to run: correr\nhouse\n• well-known = conocido')).toEqual([
      { term: 'apple', meaning: 'manzana' },
      { term: 'to run', meaning: 'correr' },
      { term: 'house' },
      { term: 'well-known', meaning: 'conocido' },
    ])
  })
})

describe('frases para leer en voz alta', () => {
  it('separa por puntos, signos y saltos de línea', () => {
    expect(splitSentences('Hello there. How are you?\nI am fine!  ¿Y tú…? Bien')).toEqual(['Hello there.', 'How are you?', 'I am fine!', '¿Y tú…?', 'Bien'])
  })
  it('corta las frases muy largas en las comas', () => {
    const long = 'uno dos tres, cuatro cinco seis, siete ocho nueve.'
    expect(splitSentences(long, 20)).toEqual(['uno dos tres,', 'cuatro cinco seis,', 'siete ocho nueve.'])
  })
  it('ignora el texto vacío', () => {
    expect(splitSentences('  \n\n ')).toEqual([])
  })
})

describe('competir con un vocabulario', () => {
  it('cada palabra con significado es una pregunta con alternativas de otras palabras', () => {
    const w = (term: string, meaning?: string) => ({ id: 1, topicId: 1, listId: 1, term, meaning, lang: 'en-US', createdAt: 0 })
    const qs = wordsToQuestions([w('apple', 'manzana'), w('pear', 'pera'), w('grape', 'uva'), w('plum', 'ciruela'), w('kiwi', 'kiwi'), w('nada')], 3, () => 0.3)
    expect(qs).toHaveLength(5)
    for (const q of qs) {
      expect(q.options).toHaveLength(4)
      expect(new Set(q.options).size).toBe(4)
    }
    expect(qs[0].prompt).toBe('¿Qué significa «apple»?')
    expect(qs[0].options[qs[0].correct]).toBe('manzana')
  })
})

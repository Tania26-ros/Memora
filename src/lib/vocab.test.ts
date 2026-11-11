import { describe, expect, it } from 'vitest'
import { parseWordList, phrase, sentenceOf, splitSentences, tokenize } from './vocab'

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

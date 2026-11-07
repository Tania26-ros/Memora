import { describe, expect, it } from 'vitest'
import { parseQuestionsText } from './importText'

describe('pegado inteligente', () => {
  it('reconoce opción múltiple con "Respuesta: b", explicación y pista', () => {
    const [p] = parseQuestionsText(
      `1. ¿Qué orgánulo produce energía?
a) Ribosoma
b) Mitocondria
c) Núcleo
Respuesta: b
Explicación: hace la respiración celular
Pista: empieza con M`,
      7,
    )
    expect(p.problem).toBeNull()
    expect(p.question).toMatchObject({ type: 'mcq', topicId: 7, prompt: '¿Qué orgánulo produce energía?', options: ['Ribosoma', 'Mitocondria', 'Núcleo'], correct: 1, explanation: 'hace la respiración celular', hint: 'empieza con M' })
  })

  it('separa varias preguntas y acepta la correcta marcada con *', () => {
    const ps = parseQuestionsText(
      `1) Capital del Perú
A. Cusco
B. Lima *
2) ¿Cuántos lados tiene un hexágono?
(a) 5
(b) 6
Rpta: (b)`,
      1,
    )
    expect(ps).toHaveLength(2)
    expect(ps[0].question).toMatchObject({ type: 'mcq', correct: 1 })
    expect(ps[1].question).toMatchObject({ type: 'mcq', correct: 1, options: ['5', '6'] })
  })

  it('reconoce verdadero o falso de varias formas', () => {
    const ps = parseQuestionsText(
      `1. El agua hierve a 100 °C al nivel del mar. (V)
2. El Sol gira alrededor de la Tierra.
Respuesta: Falso
3. La célula es la unidad básica de la vida.
a) Verdadero
b) Falso
Respuesta: a`,
      1,
    )
    expect(ps.map((p) => p.question.type)).toEqual(['tf', 'tf', 'tf'])
    expect(ps.map((p) => (p.question.type === 'tf' ? p.question.correct : null))).toEqual([true, false, true])
    expect(ps[0].question.type === 'tf' && ps[0].question.prompt).toBe('El agua hierve a 100 °C al nivel del mar.')
  })

  it('pregunta abierta con respuesta, y avisa si falta', () => {
    const ps = parseQuestionsText(
      `1. ¿Qué es la fotosíntesis?
Respuesta: El proceso por el que las plantas producen glucosa con luz.
2. ¿Quién escribió La ciudad y los perros?`,
      1,
    )
    expect(ps[0].question).toMatchObject({ type: 'open', answer: 'El proceso por el que las plantas producen glucosa con luz.' })
    expect(ps[0].problem).toBeNull()
    expect(ps[1].problem).toMatch(/Falta la respuesta/)
  })

  it('avisa cuando falta la alternativa correcta', () => {
    const [p] = parseQuestionsText('¿Cuánto es 2 + 2?\na) 3\nb) 4', 1)
    expect(p.question.type).toBe('mcq')
    expect(p.problem).toMatch(/correcta/)
  })

  it('sin números, separa por líneas en blanco y une alternativas de dos líneas', () => {
    const ps = parseQuestionsText('¿Primera?\na) uno\nque sigue\nb) dos\nRespuesta: a\n\n¿Segunda?\nRespuesta: algo', 1)
    expect(ps).toHaveLength(2)
    expect(ps[0].question.type === 'mcq' && ps[0].question.options[0]).toBe('uno que sigue')
  })
})

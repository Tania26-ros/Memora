import { describe, expect, it } from 'vitest'
import { advantages, ranking, scoreAnswer } from './competition'

const ok = (took: number, usedHint = false) => ({ correct: true, took, usedHint })
const bad = (took: number) => ({ correct: false, took, usedHint: false })

describe('competencias', () => {
  it('puntaje: dificultad, rapidez y pista', () => {
    expect(scoreAnswer('regular', ok(0), 20)).toBe(200)
    expect(scoreAnswer('regular', ok(10), 20)).toBe(175)
    expect(scoreAnswer('dificil', ok(5), 0)).toBe(200)
    expect(scoreAnswer('facil', ok(20), 20)).toBe(100)
    expect(scoreAnswer('regular', ok(10, true), 20)).toBe(88)
    expect(scoreAnswer('dificil', bad(1), 20)).toBe(0)
  })
  it('ranking con desempate por tiempo y empates', () => {
    const d = ['regular', 'regular'] as const
    const r = ranking(
      [
        { name: 'Ana', seconds: 0, hints: false, answers: [ok(4), bad(3)] },
        { name: 'Beto', seconds: 0, hints: false, answers: [ok(2), ok(2)] },
        { name: 'Caro', seconds: 0, hints: false, answers: [bad(1), ok(3)] },
        { name: 'Dani', seconds: 0, hints: false, answers: [ok(4), bad(3)] },
      ],
      [...d],
    )
    expect(r.map((x) => [x.player.name, x.place])).toEqual([
      ['Beto', 1],
      ['Caro', 2],
      ['Ana', 3],
      ['Dani', 3],
    ])
  })
  it('ventajas visibles solo si el moderador dio condiciones distintas', () => {
    expect(advantages([{ name: 'A', seconds: 20, hints: false }, { name: 'B', seconds: 20, hints: false }])).toEqual([])
    expect(advantages([{ name: 'A', seconds: 20, hints: false }, { name: 'B', seconds: 40, hints: true }])).toEqual(['A: 20 s por pregunta, sin pistas', 'B: 40 s por pregunta, con pistas'])
  })
})

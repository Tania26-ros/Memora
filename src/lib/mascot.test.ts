import { describe, expect, it } from 'vitest'
import { answerLine, homeLine, pick, resultsLine, type HomeState } from './mascot'

const base: HomeState = { hour: 10, notebooks: 2, questions: 20, todayAnswered: 0, dailyGoal: 10, streak: 0, due: 0 }

describe('Memo en el inicio', () => {
  it('guía a quien recién empieza', () => {
    expect(homeLine({ ...base, notebooks: 0 }).text).toMatch(/cuaderno/)
    expect(homeLine({ ...base, questions: 0 }).text).toMatch(/preguntas/)
  })
  it('recomienda repasar lo que toca, con enlace al tema', () => {
    const l = homeLine({ ...base, due: 3, dueTopic: { id: 7, name: 'Célula' } })
    expect(l.text).toMatch(/3 preguntas/)
    expect(l.link).toEqual({ to: '/tema/7/jugar', label: 'Repasar «Célula»' })
  })
  it('cuida la racha y celebra la meta', () => {
    expect(homeLine({ ...base, streak: 4 }).text).toMatch(/4 días seguidos/)
    expect(homeLine({ ...base, todayAnswered: 12, streak: 4 }).mood).toBe('celebra')
    expect(homeLine({ ...base, todayAnswered: 4 }).text).toMatch(/faltan 6 preguntas/)
  })
  it('de madrugada aconseja dormir', () => {
    expect(homeLine({ ...base, hour: 2 }).mood).toBe('duerme')
    expect(homeLine({ ...base, hour: 21 }).text).toMatch(/^¡Buenas noches/)
  })
})

describe('Memo al jugar', () => {
  it('celebra las rachas y anima al fallar', () => {
    expect(answerLine('ok', 1, () => 0).text).toBe('¡Bien!')
    expect(answerLine('ok', 3).mood).toBe('celebra')
    expect(answerLine('ok', 5).text).toMatch(/puntos extra/)
    expect(answerLine('fail', 0).mood).toBe('animo')
    expect(answerLine('timeout', 0).text).toMatch(/tiempo/)
  })
  it('resume la ronda según el resultado', () => {
    expect(resultsLine(100, 0).mood).toBe('celebra')
    expect(resultsLine(80, 1).text).toMatch(/Solo 1 pregunta/)
    expect(resultsLine(20, 8).text).toMatch(/Leer como libro/)
  })
  it('pick nunca se sale de la lista', () => {
    expect(pick(['a', 'b'], () => 0.9999)).toBe('b')
    expect(pick(['a', 'b'], () => 1)).toBe('b')
  })
})

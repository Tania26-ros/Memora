import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { MemoraDB } from './db'
import { dayKey, lastDays, levelInfo, pointsFor, recordActivity, streakInfo, totalXp, xpForLevel } from './progress'

describe('puntos', () => {
  const base = { difficulty: 'regular' as const, correct: true, retry: false, hint: false, streak: 1 }
  it('según dificultad, repetición, pista y bonificación', () => {
    expect(pointsFor(base)).toBe(15)
    expect(pointsFor({ ...base, difficulty: 'dificil' })).toBe(20)
    expect(pointsFor({ ...base, retry: true })).toBe(5)
    expect(pointsFor({ ...base, hint: true })).toBe(8)
    expect(pointsFor({ ...base, streak: 5 })).toBe(20)
    expect(pointsFor({ ...base, correct: false })).toBe(1)
  })
})

describe('niveles', () => {
  it('cada nivel pide más puntos', () => {
    expect(xpForLevel(1)).toBe(0)
    expect(xpForLevel(2)).toBe(100)
    expect(xpForLevel(3)).toBe(250)
    expect(levelInfo(0)).toMatchObject({ level: 1, name: 'Semilla', into: 0, needed: 100, pct: 0 })
    expect(levelInfo(175)).toMatchObject({ level: 2, name: 'Brote', into: 75, needed: 150, pct: 50 })
  })
})

describe('rachas', () => {
  const days = (dates: string[]) => dates.map((date) => ({ date, answered: 3 }))
  it('cuenta días seguidos hasta hoy', () => {
    expect(streakInfo(days(['2026-11-05', '2026-11-06', '2026-11-07']), '2026-11-07')).toEqual({ current: 3, best: 3, playedToday: true })
  })
  it('si hoy aún no estudias, la racha de ayer sigue viva', () => {
    expect(streakInfo(days(['2026-11-05', '2026-11-06']), '2026-11-07')).toEqual({ current: 2, best: 2, playedToday: false })
  })
  it('un día sin estudiar corta la racha, pero se recuerda la mejor (también entre meses)', () => {
    expect(streakInfo(days(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-05']), '2026-11-07')).toEqual({ current: 0, best: 3, playedToday: false })
  })
  it('últimos 7 días con ceros', () => {
    const l = lastDays([{ date: '2026-11-06', xp: 40, answered: 4, correct: 3 }], 7, '2026-11-07')
    expect(l.map((d) => d.xp)).toEqual([0, 0, 0, 0, 0, 40, 0])
    expect(l[0].date).toBe('2026-11-01')
  })
})

describe('guardar actividad', () => {
  it('suma en el día local', async () => {
    const database = new MemoraDB('prueba-progreso')
    const now = new Date(2026, 10, 7, 23, 30)
    await recordActivity(15, true, database, now)
    await recordActivity(1, false, database, now)
    expect(await database.days.get(dayKey(now))).toEqual({ date: '2026-11-07', xp: 16, answered: 2, correct: 1 })
    expect(await totalXp(database)).toBe(16)
  })
})

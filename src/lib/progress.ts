import { db, type MemoraDB } from './db'
import type { Difficulty } from './questions'

// ─────────────────────────────────────────────────────────────
// Puntos, niveles y rachas.
// Cada día que estudias se guarda una fila con lo que hiciste ese día.
// Con esas filas se calculan la racha, la meta diaria y las estadísticas.
// ─────────────────────────────────────────────────────────────

export interface DayActivity {
  /** Fecha local en formato AAAA-MM-DD (así se ordena bien como texto). */
  date: string
  xp: number
  answered: number
  correct: number
}

/** Fecha local (no UTC: a las 11 p. m. en Perú todavía es "hoy"). */
export function dayKey(d: Date | number = new Date()) {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

function addDays(key: string, n: number) {
  const [y, m, d] = key.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d + n))
}

// ── Puntos ───────────────────────────────────────────────────
const BASE: Record<Difficulty, number> = { facil: 10, regular: 15, dificil: 20 }

/**
 * Puntos por una respuesta.
 * - Acertar a la primera vale según la dificultad.
 * - Acertar una que ya habías fallado vale 5 (también es aprender).
 * - Fallar da 1 punto por el esfuerzo.
 * - Usar la pista quita la mitad.
 * - Cada 5 aciertos seguidos: +5 de bonificación.
 */
export function pointsFor(a: { difficulty: Difficulty; correct: boolean; retry: boolean; hint: boolean; streak: number }) {
  if (!a.correct) return 1
  let p = a.retry ? 5 : BASE[a.difficulty]
  if (a.hint) p = Math.ceil(p / 2)
  if (a.streak > 0 && a.streak % 5 === 0) p += 5
  return p
}

// ── Niveles ──────────────────────────────────────────────────
export const LEVEL_NAMES = ['Semilla', 'Brote', 'Explorador', 'Aprendiz', 'Estudioso', 'Experto', 'Sabio', 'Maestro', 'Leyenda']

/** Puntos totales necesarios para llegar al nivel L (cada nivel pide un poco más). */
export function xpForLevel(level: number) {
  return 25 * (level - 1) * (level + 2)
}

export function levelInfo(totalXp: number) {
  let level = 1
  while (totalXp >= xpForLevel(level + 1)) level++
  const from = xpForLevel(level)
  const to = xpForLevel(level + 1)
  return {
    level,
    name: LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)],
    into: totalXp - from,
    needed: to - from,
    pct: Math.round(((totalXp - from) / (to - from)) * 100),
  }
}

// ── Rachas ───────────────────────────────────────────────────
/**
 * Racha actual: días seguidos con estudio que terminan hoy o ayer
 * (si hoy todavía no estudias, la racha sigue viva hasta medianoche).
 */
export function streakInfo(days: Pick<DayActivity, 'date' | 'answered'>[], today = dayKey()) {
  const played = new Set(days.filter((d) => d.answered > 0).map((d) => d.date))
  const playedToday = played.has(today)
  let current = 0
  for (let k = playedToday ? today : addDays(today, -1); played.has(k); k = addDays(k, -1)) current++

  let best = 0
  let run = 0
  let prev = ''
  for (const k of [...played].sort()) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1
    best = Math.max(best, run)
    prev = k
  }
  return { current, best, playedToday }
}

/** Los últimos n días (incluido hoy), con ceros donde no hubo estudio. */
export function lastDays(days: DayActivity[], n = 7, today = dayKey()): DayActivity[] {
  const byDate = new Map(days.map((d) => [d.date, d]))
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - n + 1)
    return byDate.get(date) ?? { date, xp: 0, answered: 0, correct: 0 }
  })
}

/** Guarda una respuesta en el día de hoy. */
export async function recordActivity(xp: number, correct: boolean, database: MemoraDB = db, now = new Date()) {
  const date = dayKey(now)
  await database.transaction('rw', database.days, async () => {
    const d = (await database.days.get(date)) ?? { date, xp: 0, answered: 0, correct: 0 }
    await database.days.put({ ...d, xp: d.xp + xp, answered: d.answered + 1, correct: d.correct + (correct ? 1 : 0) })
  })
}

export async function totalXp(database: MemoraDB = db) {
  let sum = 0
  await database.days.each((d) => (sum += d.xp))
  return sum
}

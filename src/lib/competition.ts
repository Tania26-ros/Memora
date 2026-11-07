import type { Difficulty } from './questions'

// ─────────────────────────────────────────────────────────────
// Competencias: reglas de puntaje y ranking.
// Funciones puras para poder probarlas y usarlas igual en el
// modo «mismo celular» y en las competencias en línea.
// ─────────────────────────────────────────────────────────────

export interface PlayerRules {
  name: string
  /** Segundos por pregunta (0 = sin tiempo). */
  seconds: number
  hints: boolean
}

export interface AnswerRecord {
  correct: boolean
  /** Segundos que tardó en responder. */
  took: number
  usedHint: boolean
}

export interface PlayerResult extends PlayerRules {
  answers: AnswerRecord[]
}

const BASE: Record<Difficulty, number> = { facil: 100, regular: 150, dificil: 200 }

/**
 * Puntos de una respuesta en competencia:
 * base por dificultad + hasta 50 por rapidez (si hay tiempo límite);
 * con pista, la mitad. Una respuesta incorrecta vale 0.
 */
export function scoreAnswer(difficulty: Difficulty, a: AnswerRecord, seconds: number) {
  if (!a.correct) return 0
  const speed = seconds > 0 ? Math.round(50 * Math.max(0, 1 - a.took / seconds)) : 0
  const total = BASE[difficulty] + speed
  return a.usedHint ? Math.round(total / 2) : total
}

export function totals(p: PlayerResult, difficulties: Difficulty[]) {
  return {
    points: p.answers.reduce((s, a, i) => s + scoreAnswer(difficulties[i] ?? 'regular', a, p.seconds), 0),
    correct: p.answers.filter((a) => a.correct).length,
    time: Math.round(p.answers.reduce((s, a) => s + a.took, 0) * 10) / 10,
    hints: p.answers.filter((a) => a.usedHint).length,
  }
}

/** Ordena a los jugadores: más puntos primero; si empatan, gana quien tardó menos. Empate total = mismo puesto. */
export function ranking(players: PlayerResult[], difficulties: Difficulty[]) {
  const rows = players.map((p) => ({ player: p, ...totals(p, difficulties) }))
  rows.sort((a, b) => b.points - a.points || a.time - b.time)
  let place = 0
  return rows.map((r, i) => {
    if (i === 0 || r.points !== rows[i - 1].points || r.time !== rows[i - 1].time) place = i + 1
    return { ...r, place }
  })
}

/** ¿El moderador dio condiciones distintas a alguien? (para mostrarlo a todos) */
export function advantages(players: PlayerRules[]): string[] {
  if (players.length === 0) return []
  const same = players.every((p) => p.seconds === players[0].seconds && p.hints === players[0].hints)
  if (same) return []
  return players.map((p) => `${p.name}: ${p.seconds ? `${p.seconds} s por pregunta` : 'sin tiempo'}, ${p.hints ? 'con pistas' : 'sin pistas'}`)
}

export const MEDALS = ['🥇', '🥈', '🥉']

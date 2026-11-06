import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs'
import { db, type MemoraDB } from './db'
import type { Question } from './questions'

// ─────────────────────────────────────────────────────────────
// Repaso espaciado con FSRS.
// Para cada pregunta, FSRS calcula cuándo estás a punto de olvidarla
// y la programa para ese día. Si fallas, vuelve pronto; si aciertas
// varias veces, cada vez tarda más en volver (1 día, 3, 8, 20...).
// ─────────────────────────────────────────────────────────────

/** Estado de repaso de una pregunta, tal como se guarda en la base de datos. */
export interface ReviewState {
  questionId: number
  topicId: number
  /** Cuándo toca repasarla (milisegundos desde 1970, para poder ordenar). */
  due: number
  card: Card
  correct: number
  wrong: number
  lastResult: 'ok' | 'fail'
  lastReviewed: number
}

// Sin "pasos cortos": la ronda ya repite cada pregunta hasta aprenderla,
// así que el repaso espaciado empieza a contar desde el día siguiente.
const scheduler = fsrs({ enable_fuzz: true, enable_short_term: false })

/** Cómo te fue con una pregunta la primera vez que apareció en la ronda. */
export type Outcome = 'fail' | 'doubt' | 'ok' | 'easy'

const RATING: Record<Outcome, Grade> = {
  fail: Rating.Again,
  doubt: Rating.Hard,
  ok: Rating.Good,
  easy: Rating.Easy,
}

/** Calcula el siguiente estado sin guardarlo (función pura, fácil de probar). */
export function nextReview(prev: ReviewState | undefined, q: Pick<Question, 'id' | 'topicId'>, outcome: Outcome, now = new Date()): ReviewState {
  const card = prev ? reviveCard(prev.card) : createEmptyCard(now)
  const next = scheduler.next(card, now, RATING[outcome]).card
  const ok = outcome !== 'fail'
  return {
    questionId: q.id,
    topicId: q.topicId,
    due: next.due.getTime(),
    card: next,
    correct: (prev?.correct ?? 0) + (ok ? 1 : 0),
    wrong: (prev?.wrong ?? 0) + (ok ? 0 : 1),
    lastResult: ok ? 'ok' : 'fail',
    lastReviewed: now.getTime(),
  }
}

export async function recordReview(q: Pick<Question, 'id' | 'topicId'>, outcome: Outcome, database: MemoraDB = db, now = new Date()) {
  const prev = await database.reviews.get(q.id)
  await database.reviews.put(nextReview(prev, q, outcome, now))
}

/** IndexedDB devuelve las fechas tal cual, pero por si acaso las reconstruimos. */
function reviveCard(c: Card): Card {
  return { ...c, due: new Date(c.due), last_review: c.last_review ? new Date(c.last_review) : undefined }
}

/** ¿Toca repasar esta pregunta hoy? (las nuevas no cuentan: se juegan normalmente) */
export function isDue(r: ReviewState | undefined, now = Date.now()) {
  return !!r && r.due <= endOfDay(now)
}

function endOfDay(now: number) {
  const d = new Date(now)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

/** Texto amable para "vuelve en...". */
export function dueLabel(due: number, now = Date.now()): string {
  const days = Math.round((due - now) / 86_400_000)
  if (due <= endOfDay(now)) return 'hoy'
  if (days <= 1) return 'mañana'
  if (days < 30) return `en ${days} días`
  const months = Math.round(days / 30)
  return months === 1 ? 'en 1 mes' : `en ${months} meses`
}

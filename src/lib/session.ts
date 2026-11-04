import type { Outcome } from './srs'

// ─────────────────────────────────────────────────────────────
// Una ronda de juego ("dosis").
// Regla de "Repetir hasta aprender": cada pregunta debe acertarse
// N veces seguidas. Si fallas, vuelve al final de la fila; si aciertas
// pero aún te faltan aciertos, vuelve pronto (3 preguntas después).
// ─────────────────────────────────────────────────────────────

export interface SessionItem {
  qid: number
  streak: number
  attempts: number
  /** Resultado de la primera vez que apareció: es el que cuenta para el repaso espaciado. */
  first?: Outcome
}

export interface Session {
  queue: number[]
  items: Record<number, SessionItem>
  repeatUntil: number
  done: number[]
}

export function startSession(qids: number[], repeatUntil: number): Session {
  const items: Record<number, SessionItem> = {}
  for (const id of qids) items[id] = { qid: id, streak: 0, attempts: 0 }
  return { queue: [...qids], items, repeatUntil: Math.max(1, repeatUntil), done: [] }
}

export function currentQid(s: Session): number | undefined {
  return s.queue[0]
}

const SOON = 3

/** Registra la respuesta a la pregunta actual y devuelve la sesión nueva (no modifica la anterior). */
export function answer(s: Session, outcome: Outcome): Session {
  const [qid, ...rest] = s.queue
  if (qid === undefined) return s
  const prev = s.items[qid]
  const ok = outcome !== 'fail'
  const item: SessionItem = {
    ...prev,
    attempts: prev.attempts + 1,
    streak: ok ? prev.streak + 1 : 0,
    first: prev.first ?? outcome,
  }
  let queue = rest
  let done = s.done
  if (item.streak >= s.repeatUntil) {
    done = [...done, qid]
  } else if (ok) {
    queue = [...rest.slice(0, SOON), qid, ...rest.slice(SOON)]
  } else {
    queue = [...rest, qid]
  }
  return { ...s, queue, done, items: { ...s.items, [qid]: item } }
}

export function isFinished(s: Session) {
  return s.queue.length === 0
}

export function summary(s: Session) {
  const all = Object.values(s.items)
  const firstTry = all.filter((i) => i.first && i.first !== 'fail').length
  const failed = all.filter((i) => i.first === 'fail').map((i) => i.qid)
  return { total: all.length, firstTry, failed, attempts: all.reduce((n, i) => n + i.attempts, 0) }
}

/** Divide la lista en dosis del tamaño elegido. */
export function splitDoses<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

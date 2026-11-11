// Tiempos: desde 1 segundo hasta 23 h 59 min 59 s.
// Se guardan siempre en segundos; aquí se convierten para mostrarlos.

export const MAX_SECONDS = 23 * 3600 + 59 * 60 + 59

export function clampSeconds(s: number) {
  if (!Number.isFinite(s)) return 1
  return Math.min(MAX_SECONDS, Math.max(1, Math.round(s)))
}

export function splitDuration(total: number) {
  const s = Math.max(0, Math.round(total))
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 }
}

export function joinDuration(h: number, m: number, s: number) {
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0)
}

/** «45 s», «2 min», «1 h 5 min 3 s». */
export function formatDuration(total: number) {
  if (total <= 0) return 'Sin tiempo'
  const { h, m, s } = splitDuration(total)
  return [h && `${h} h`, m && `${m} min`, s && `${s} s`].filter(Boolean).join(' ')
}

/** Reloj para cuentas regresivas: «4:05» o «1:02:09». */
export function clock(total: number) {
  const { h, m, s } = splitDuration(total)
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

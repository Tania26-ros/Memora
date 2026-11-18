import { db, type MemoraDB } from './db'

// ─────────────────────────────────────────────────────────────
// Sincronización automática entre dispositivos (PC, celular…).
// Cada dispositivo guarda todo en su propia base (IndexedDB). Cuando
// entras con tu correo, Memora compara este dispositivo con la copia
// de la nube y hace lo que toca:
//   · solo cambió este dispositivo → sube la copia
//   · solo cambió la nube (otro dispositivo) → la trae
//   · cambiaron los dos → te pregunta cuál conservar
// Para saber si la nube cambió no se usan relojes (cada equipo tiene
// su hora): se recuerda la versión que la nube tenía en la última
// sincronización.
// ─────────────────────────────────────────────────────────────

const CHANGED = 'memora-cambios-sin-subir' // momento del primer cambio aún no subido ("0" = ninguno)
const CLOUD_VERSION = 'memora-version-nube' // versión de la nube vista en la última sincronización

export type SyncAction = 'nothing' | 'upload' | 'download' | 'conflict'

/** Decide qué hacer. `remote` es la versión actual de la nube (null si no hay copia). */
export function decide({ remote, known, dirty }: { remote: string | null; known: string | null; dirty: boolean }): SyncAction {
  const cloudChanged = remote !== null && remote !== known
  if (cloudChanged && dirty) return 'conflict'
  if (cloudChanged) return 'download'
  if (dirty) return 'upload'
  return 'nothing'
}

function get(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function set(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // sin almacenamiento local
  }
}

/** Marca de cambios locales sin subir: un número (0 = nada pendiente) o null si nunca se midió. */
export function pendingSince(): number | null {
  const v = get(CHANGED)
  return v === null ? null : Number(v)
}

export const knownCloudVersion = () => get(CLOUD_VERSION)

/** Se llama después de subir o traer una copia: este dispositivo y la nube quedan iguales. */
export function markInSync(version: string, changedSnapshot?: number | null) {
  set(CLOUD_VERSION, version)
  // Si hubo cambios mientras se subía la copia, siguen pendientes.
  if (changedSnapshot === undefined || pendingSince() === changedSnapshot) set(CHANGED, '0')
}

/** ¿Hay algo en este dispositivo que la nube no tiene? */
export async function hasLocalChanges(database: MemoraDB = db): Promise<boolean> {
  const since = pendingSince()
  if (since !== null) return since > 0
  // Antes de esta versión no se medían los cambios: si hay cuadernos, cuentan como cambios.
  return (await database.notebooks.count()) > 0
}

type Listener = () => void
const listeners = new Set<Listener>()
/** Avisa cada vez que algo cambia en la base local. Devuelve la función para dejar de escuchar. */
export function onLocalChange(fn: Listener) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

let paused = 0
/** Ejecuta `fn` sin contar sus cambios (por ejemplo, al restaurar una copia de la nube). */
export async function withoutTracking<T>(fn: () => Promise<T>): Promise<T> {
  paused++
  try {
    return await fn()
  } finally {
    paused--
  }
}

function touched() {
  if (paused) return
  if (!pendingSince()) set(CHANGED, String(Date.now()))
  listeners.forEach((fn) => fn())
}

/** Escucha todos los cambios (crear, editar, borrar) de todas las tablas. */
export function trackChanges(database: MemoraDB = db) {
  for (const table of database.tables) {
    table.hook('creating', touched)
    table.hook('updating', touched)
    table.hook('deleting', touched)
  }
}

trackChanges()

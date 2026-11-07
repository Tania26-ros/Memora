import type { SupabaseClient, User } from '@supabase/supabase-js'
import { checkBackup, exportAll, restoreAll, type Backup } from './backup'

// ─────────────────────────────────────────────────────────────
// Nube (Supabase): cuenta con correo y copia en línea.
// La dirección y la clave pública se ponen en Vercel como variables:
//   VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
// Sin ellas, Memora sigue funcionando igual, solo en el dispositivo.
// La librería se carga solo cuando se usa, para no hacer lenta la app.
// ─────────────────────────────────────────────────────────────

const URL_ = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const BUCKET = 'backups'
const LAST_SYNC = 'memora-ultima-sincronizacion'

export const cloudEnabled = () => !!URL_ && !!KEY

let client: Promise<SupabaseClient> | null = null
export function supabase(): Promise<SupabaseClient> {
  if (!cloudEnabled()) return Promise.reject(new Error('La nube todavía no está activada en esta versión de Memora.'))
  client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(URL_!, KEY!, { auth: { persistSession: true, detectSessionInUrl: true } }))
  return client
}

export async function currentUser(): Promise<User | null> {
  if (!cloudEnabled()) return null
  const { data } = await (await supabase()).auth.getSession()
  return data.session?.user ?? null
}

/** Envía al correo un código de 6 dígitos (y un enlace) para entrar, sin contraseña. */
export async function sendLoginCode(email: string) {
  const { error } = await (await supabase()).auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${location.origin}/cuenta` } })
  if (error) throw new Error(friendly(error.message))
}

export async function verifyLoginCode(email: string, code: string) {
  const { error } = await (await supabase()).auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
  if (error) throw new Error(friendly(error.message))
}

export async function signOut() {
  await (await supabase()).auth.signOut()
}

function friendly(msg: string) {
  if (/rate limit|too many/i.test(msg)) return 'Pediste muchos códigos seguidos. Espera un minuto e inténtalo otra vez.'
  if (/expired|invalid/i.test(msg)) return 'El código no es válido o ya venció. Pide uno nuevo.'
  if (/fetch|network/i.test(msg)) return 'No hay conexión con la nube. Revisa tu internet.'
  return msg
}

const pathFor = (u: User) => `${u.id}/memora.json`

/** Sube una copia completa de este dispositivo a la nube. */
export async function uploadBackup() {
  const sb = await supabase()
  const user = await currentUser()
  if (!user) throw new Error('Primero entra con tu correo.')
  const backup = await exportAll()
  const { error } = await sb.storage.from(BUCKET).upload(pathFor(user), new Blob([JSON.stringify(backup)], { type: 'application/json' }), { upsert: true, contentType: 'application/json' })
  if (error) throw new Error(/exceeded|too large/i.test(error.message) ? 'La copia pesa demasiado (más de 50 MB). Prueba quitando archivos grandes.' : friendly(error.message))
  markSynced(backup.exportedAt)
  return backup
}

/** Trae la copia de la nube (o null si todavía no hay ninguna). */
export async function fetchCloudBackup(): Promise<Backup | null> {
  const sb = await supabase()
  const user = await currentUser()
  if (!user) throw new Error('Primero entra con tu correo.')
  const { data, error } = await sb.storage.from(BUCKET).download(pathFor(user))
  if (error) {
    const status = (error as { statusCode?: string }).statusCode
    if (status === '404' || /not found/i.test(error.message)) return null
    throw new Error(friendly(error.message))
  }
  const parsed = JSON.parse(await data.text())
  const problem = checkBackup(parsed)
  if (problem) throw new Error(problem)
  return parsed as Backup
}

export async function restoreFromCloud(b: Backup) {
  await restoreAll(b)
  markSynced(b.exportedAt)
}

function markSynced(at: number) {
  try {
    localStorage.setItem(LAST_SYNC, String(at))
  } catch {
    // sin almacenamiento local
  }
}

export function lastSynced(): number | null {
  try {
    const v = localStorage.getItem(LAST_SYNC)
    return v ? Number(v) : null
  } catch {
    return null
  }
}

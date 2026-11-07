import { db, type MemoraDB, type Notebook, type StudyFile, type Topic, type Word } from './db'
import type { DayActivity } from './progress'
import type { Question } from './questions'
import type { ReviewState } from './srs'

// ─────────────────────────────────────────────────────────────
// Copia de seguridad: todo Memora en un solo archivo JSON.
// Sirve para guardarla en tu Drive, pasarla a otro celular
// o subirla a la nube (ver cloud.ts).
// Los archivos (PDF, fotos…) van dentro como texto base64.
// ─────────────────────────────────────────────────────────────

type StoredFile = Omit<StudyFile, 'blob' | 'thumb'> & { blob: string; thumb?: string }

export interface Backup {
  app: 'memora'
  version: 1
  exportedAt: number
  notebooks: Notebook[]
  topics: Topic[]
  files: StoredFile[]
  questions: Question[]
  reviews: ReviewState[]
  words: Word[]
  days: DayActivity[]
}

async function blobToBase64(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer())
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function base64ToBlob(data: string, type: string): Blob {
  const bin = atob(data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

export async function exportAll(options: { includeFiles?: boolean } = {}, database: MemoraDB = db, now = Date.now()): Promise<Backup> {
  const includeFiles = options.includeFiles ?? true
  const files = includeFiles ? await database.files.toArray() : []
  return {
    app: 'memora',
    version: 1,
    exportedAt: now,
    notebooks: await database.notebooks.toArray(),
    topics: await database.topics.toArray(),
    files: await Promise.all(files.map(async (f) => ({ ...f, blob: await blobToBase64(f.blob), thumb: f.thumb ? await blobToBase64(f.thumb) : undefined }))),
    questions: await database.questions.toArray(),
    reviews: await database.reviews.toArray(),
    words: await database.words.toArray(),
    days: await database.days.toArray(),
  }
}

/** Revisa que el archivo sea una copia de Memora. Devuelve el problema o null. */
export function checkBackup(data: unknown): string | null {
  const b = data as Partial<Backup>
  if (!b || typeof b !== 'object' || b.app !== 'memora') return 'Este archivo no es una copia de Memora.'
  if (b.version !== 1) return 'Esta copia es de una versión más nueva de Memora. Actualiza la app.'
  if (!Array.isArray(b.notebooks) || !Array.isArray(b.topics)) return 'La copia está incompleta o dañada.'
  return null
}

/** Reemplaza todo lo de este dispositivo por la copia. */
export async function restoreAll(b: Backup, database: MemoraDB = db) {
  const problem = checkBackup(b)
  if (problem) throw new Error(problem)
  const tables = [database.notebooks, database.topics, database.files, database.questions, database.reviews, database.words, database.days]
  await database.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()))
    await database.notebooks.bulkPut(b.notebooks)
    await database.topics.bulkPut(b.topics)
    await database.files.bulkPut(b.files.map((f) => ({ ...f, blob: base64ToBlob(f.blob, f.mimeType), thumb: f.thumb ? base64ToBlob(f.thumb, 'image/webp') : undefined })))
    await database.questions.bulkPut(b.questions ?? [])
    await database.reviews.bulkPut(b.reviews ?? [])
    await database.words.bulkPut(b.words ?? [])
    await database.days.bulkPut(b.days ?? [])
  })
}

/** Resumen corto para mostrar antes de restaurar. */
export function describeBackup(b: Backup) {
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
  return [
    n(b.notebooks.length, 'cuaderno', 'cuadernos'),
    n(b.topics.length, 'tema', 'temas'),
    n(b.questions?.length ?? 0, 'pregunta', 'preguntas'),
    n(b.words?.length ?? 0, 'palabra', 'palabras'),
  ].join(', ') + ` y ${n(b.files.length, 'archivo', 'archivos')}`
}

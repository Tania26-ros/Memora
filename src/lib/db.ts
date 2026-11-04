import Dexie, { type EntityTable } from 'dexie'

// ─────────────────────────────────────────────────────────────
// Base de datos local de Memora.
//
// Usamos IndexedDB, una base de datos que trae el navegador y que
// guarda todo en el propio celular o computadora. Así la app funciona
// sin internet y los archivos (PDF, PPT, imágenes) se quedan contigo.
// Dexie es una librería que hace IndexedDB mucho más fácil de usar.
//
// Estructura:  Cuaderno ──< Tema ──< Archivo
// ─────────────────────────────────────────────────────────────

export interface Notebook {
  id: number
  name: string
  color: string
  emoji: string
  createdAt: number
}

export interface Topic {
  id: number
  notebookId: number
  name: string
  createdAt: number
}

/** Qué es el archivo. Sirve para decidir qué hacer con él en las etapas siguientes. */
export type FileKind = 'material' | 'lectura-idioma' | 'examen' | 'cuestionario'

export interface StudyFile {
  id: number
  topicId: number
  name: string
  mimeType: string
  size: number
  kind: FileKind
  blob: Blob
  createdAt: number
}

export const FILE_KINDS: { value: FileKind; label: string; hint: string }[] = [
  { value: 'material', label: 'Material diverso', hint: 'Apuntes, diapositivas, libros' },
  { value: 'lectura-idioma', label: 'Lectura en otro idioma', hint: 'Para vocabulario y audio' },
  { value: 'examen', label: 'Examen pasado', hint: 'Se copiarán sus preguntas tal cual' },
  { value: 'cuestionario', label: 'Cuestionario resuelto', hint: 'Preguntas con sus respuestas' },
]

export const NOTEBOOK_COLORS = ['#5b4cf0', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899']
export const NOTEBOOK_EMOJIS = ['📘', '🧪', '🧮', '🌍', '🗣️', '🧠', '⚖️', '🩺', '💻', '🎨']

export class MemoraDB extends Dexie {
  notebooks!: EntityTable<Notebook, 'id'>
  topics!: EntityTable<Topic, 'id'>
  files!: EntityTable<StudyFile, 'id'>

  constructor(name = 'memora') {
    super(name)
    // Versión 1 del esquema. "++id" = número que se asigna solo.
    // Los demás campos listados son índices: permiten buscar rápido por ellos.
    // Si en el futuro cambiamos la estructura, se añade .version(2) sin borrar la 1.
    this.version(1).stores({
      notebooks: '++id, createdAt',
      topics: '++id, notebookId, createdAt',
      files: '++id, topicId, createdAt',
    })
  }
}

export const db = new MemoraDB()

// ── Operaciones ──────────────────────────────────────────────
// Las funciones reciben la base como parámetro opcional para poder
// probarlas con una base de prueba (ver db.test.ts).

export async function createNotebook(
  data: Pick<Notebook, 'name' | 'color' | 'emoji'>,
  database: MemoraDB = db,
): Promise<number> {
  return database.notebooks.add({ ...data, name: data.name.trim(), createdAt: Date.now() })
}

export async function createTopic(notebookId: number, name: string, database: MemoraDB = db) {
  return database.topics.add({ notebookId, name: name.trim(), createdAt: Date.now() })
}

export async function addFiles(
  topicId: number,
  files: File[],
  kind: FileKind,
  database: MemoraDB = db,
) {
  const now = Date.now()
  return database.files.bulkAdd(
    files.map((f, i) => ({
      topicId,
      name: f.name,
      mimeType: f.type || 'application/octet-stream',
      size: f.size,
      kind,
      blob: f,
      createdAt: now + i,
    })),
  )
}

/** Borra un tema y todos sus archivos. La "transacción" asegura que se borre todo o nada. */
export async function deleteTopic(topicId: number, database: MemoraDB = db) {
  await database.transaction('rw', database.topics, database.files, async () => {
    await database.files.where('topicId').equals(topicId).delete()
    await database.topics.delete(topicId)
  })
}

/** Borra un cuaderno con todos sus temas y archivos. */
export async function deleteNotebook(notebookId: number, database: MemoraDB = db) {
  await database.transaction('rw', database.notebooks, database.topics, database.files, async () => {
    const topicIds = await database.topics.where('notebookId').equals(notebookId).primaryKeys()
    await database.files.where('topicId').anyOf(topicIds).delete()
    await database.topics.where('notebookId').equals(notebookId).delete()
    await database.notebooks.delete(notebookId)
  })
}

/**
 * Pide al navegador que no borre nuestros datos cuando falte espacio.
 * Sin esto, algunos celulares pueden limpiar la base de datos de una web.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}

import Dexie, { type EntityTable } from 'dexie'
import type { Question } from './questions'
import type { DayActivity } from './progress'
import type { ReviewState } from './srs'
import { makeThumbnail } from './thumbnail'

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
  /** Miniatura pequeña para las imágenes (ver thumbnail.ts). */
  thumb?: Blob
  /** De dónde salió (autor, libro, canal, enlace…), para dar crédito. */
  source?: string
  createdAt: number
}

/** Un vocabulario: un tema puede tener varios (por ejemplo, uno por lectura o canción). */
export interface VocabList {
  id: number
  topicId: number
  name: string
  /** Texto, letra o transcripción para sombrear palabras y escuchar. */
  text: string
  /** Idioma del texto ('auto' = adivinarlo). */
  lang: string
  /** Frase donde se quedó la lectura en voz alta. */
  position?: number
  /** Si llegó compartido por otra persona: su nombre. */
  from?: string
  /** De dónde salió el texto (autor, libro, canal, enlace…), para dar crédito. */
  source?: string
  createdAt: number
}

/** Palabra o frase del vocabulario de un tema. */
export interface Word {
  id: number
  topicId: number
  /** A qué vocabulario del tema pertenece. */
  listId: number
  term: string
  meaning?: string
  synonyms?: string
  antonyms?: string
  /** Frase donde apareció o un ejemplo de uso. */
  example?: string
  notes?: string
  hint?: string
  /** Idioma de la palabra (para leerla y escucharla bien). */
  lang: string
  createdAt: number
}

export const FILE_KINDS: { value: FileKind; label: string; hint: string }[] = [
  { value: 'material', label: 'Material diverso', hint: 'Apuntes, diapositivas, libros' },
  { value: 'lectura-idioma', label: 'Lectura en otro idioma', hint: 'Para vocabulario y audio' },
  { value: 'examen', label: 'Examen pasado', hint: 'Se copiarán sus preguntas tal cual' },
  { value: 'cuestionario', label: 'Cuestionario resuelto', hint: 'Preguntas con sus respuestas' },
]

export const NOTEBOOK_COLORS = [
  '#5b4cf0', '#7c3aed', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#64748b',
]
/** Íconos rápidos. Con "Más íconos" se abre el selector completo de emojis. */
export const NOTEBOOK_EMOJIS = ['📘', '🧪', '🧮', '🌍', '🗣️', '🧠', '⚖️', '🩺', '💻', '🎨', '📐', '🎵']

export class MemoraDB extends Dexie {
  notebooks!: EntityTable<Notebook, 'id'>
  topics!: EntityTable<Topic, 'id'>
  files!: EntityTable<StudyFile, 'id'>
  questions!: EntityTable<Question, 'id'>
  reviews!: EntityTable<ReviewState, 'questionId'>
  days!: EntityTable<DayActivity, 'date'>
  words!: EntityTable<Word, 'id'>
  vocabLists!: EntityTable<VocabList, 'id'>

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
    // Versión 2 (etapa 2): preguntas y su estado de repaso.
    // Las bases de datos que ya existen en los celulares se actualizan solas.
    this.version(2).stores({
      questions: '++id, topicId, type, createdAt',
      reviews: 'questionId, topicId, due',
    })
    // Versión 3 (etapa 2, parte 3): lo que estudias cada día (puntos y rachas).
    this.version(3).stores({
      days: 'date',
    })
    // Versión 4 (etapa 3): vocabulario de cada tema.
    this.version(4).stores({
      words: '++id, topicId, createdAt',
    })
    // Versión 5: varios vocabularios por tema. Las palabras que ya existían
    // pasan a un vocabulario llamado «Vocabulario» (con el texto que tenían).
    this.version(5)
      .stores({
        vocabLists: '++id, topicId, createdAt',
        words: '++id, topicId, listId, createdAt',
      })
      .upgrade(async (tx) => {
        const topicIds = new Set<number>([...(await tx.table('words').toArray()).map((w: Word) => w.topicId), ...legacyTextTopics()])
        for (const topicId of topicIds) {
          const listId = await tx.table('vocabLists').add({ topicId, name: 'Vocabulario', text: legacyText(topicId), lang: 'auto', createdAt: Date.now() })
          await tx.table('words').where('topicId').equals(topicId).modify({ listId })
        }
      })
  }
}

/** Las palabras sin vocabulario (de copias antiguas) pasan a uno llamado «Vocabulario». */
export async function ensureVocabLists(database: MemoraDB = db) {
  const loose = (await database.words.toArray()).filter((w) => !w.listId)
  for (const topicId of new Set(loose.map((w) => w.topicId))) {
    const listId = await database.vocabLists.add({ topicId, name: 'Vocabulario', text: '', lang: 'auto', createdAt: Date.now() })
    await database.words.bulkUpdate(loose.filter((w) => w.topicId === topicId).map((w) => ({ key: w.id, changes: { listId } })))
  }
}

export async function createVocabList(topicId: number, name: string, database: MemoraDB = db, extra: Partial<VocabList> = {}) {
  return database.vocabLists.add({ topicId, name: name.trim() || 'Vocabulario', text: '', lang: 'auto', createdAt: Date.now(), ...extra })
}

/** Borra un vocabulario con sus palabras. */
export async function deleteVocabList(listId: number, database: MemoraDB = db) {
  await database.transaction('rw', [database.vocabLists, database.words], async () => {
    await database.words.where('listId').equals(listId).delete()
    await database.vocabLists.delete(listId)
  })
}

// Antes el texto del vocabulario se guardaba aparte (localStorage), uno por tema.
function legacyTextTopics(): number[] {
  try {
    return Object.keys(localStorage)
      .map((k) => /^memora-texto-(\d+)$/.exec(k)?.[1])
      .filter((x): x is string => !!x && !!localStorage.getItem(`memora-texto-${x}`)?.trim())
      .map(Number)
  } catch {
    return []
  }
}
function legacyText(topicId: number) {
  try {
    return localStorage.getItem(`memora-texto-${topicId}`) ?? ''
  } catch {
    return ''
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
  const thumbs = await Promise.all(files.map((f) => makeThumbnail(f)))
  return database.files.bulkAdd(
    files.map((f, i) => ({
      thumb: thumbs[i],
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

export async function updateNotebook(
  id: number,
  data: Pick<Notebook, 'name' | 'color' | 'emoji'>,
  database: MemoraDB = db,
) {
  return database.notebooks.update(id, { ...data, name: data.name.trim() })
}

// ── Borrar con opción de deshacer ────────────────────────────
// Antes de borrar guardamos una copia ("snapshot") en memoria.
// Si tocas "Deshacer", la volvemos a escribir tal cual, con los mismos ids.

export interface Snapshot {
  notebooks: Notebook[]
  topics: Topic[]
  files: StudyFile[]
  questions: Question[]
  reviews: ReviewState[]
  words: Word[]
  vocabLists?: VocabList[]
}

export async function snapshotNotebook(notebookId: number, database: MemoraDB = db): Promise<Snapshot> {
  const notebook = await database.notebooks.get(notebookId)
  const topics = await database.topics.where('notebookId').equals(notebookId).toArray()
  const ids = topics.map((t) => t.id)
  const files = await database.files.where('topicId').anyOf(ids).toArray()
  const questions = await database.questions.where('topicId').anyOf(ids).toArray()
  const reviews = await database.reviews.where('topicId').anyOf(ids).toArray()
  const words = await database.words.where('topicId').anyOf(ids).toArray()
  const vocabLists = await database.vocabLists.where('topicId').anyOf(ids).toArray()
  return { notebooks: notebook ? [notebook] : [], topics, files, questions, reviews, words, vocabLists }
}

export async function snapshotTopic(topicId: number, database: MemoraDB = db): Promise<Snapshot> {
  const topic = await database.topics.get(topicId)
  const files = await database.files.where('topicId').equals(topicId).toArray()
  const questions = await database.questions.where('topicId').equals(topicId).toArray()
  const reviews = await database.reviews.where('topicId').equals(topicId).toArray()
  const words = await database.words.where('topicId').equals(topicId).toArray()
  const vocabLists = await database.vocabLists.where('topicId').equals(topicId).toArray()
  return { notebooks: [], topics: topic ? [topic] : [], files, questions, reviews, words, vocabLists }
}

export async function restoreSnapshot(s: Snapshot, database: MemoraDB = db) {
  await database.transaction('rw', [database.notebooks, database.topics, database.files, database.questions, database.reviews, database.words, database.vocabLists], async () => {
    await database.notebooks.bulkPut(s.notebooks)
    await database.topics.bulkPut(s.topics)
    await database.files.bulkPut(s.files)
    await database.questions.bulkPut(s.questions)
    await database.reviews.bulkPut(s.reviews)
    await database.words.bulkPut(s.words ?? [])
    await database.vocabLists.bulkPut(s.vocabLists ?? [])
  })
}

/** Borra un tema y todos sus archivos. La "transacción" asegura que se borre todo o nada. */
export async function deleteTopic(topicId: number, database: MemoraDB = db) {
  await database.transaction('rw', [database.topics, database.files, database.questions, database.reviews, database.words, database.vocabLists], async () => {
    await database.files.where('topicId').equals(topicId).delete()
    await database.words.where('topicId').equals(topicId).delete()
    await database.vocabLists.where('topicId').equals(topicId).delete()
    await database.questions.where('topicId').equals(topicId).delete()
    await database.reviews.where('topicId').equals(topicId).delete()
    await database.topics.delete(topicId)
  })
}

/** Borra un cuaderno con todos sus temas y archivos. */
export async function deleteNotebook(notebookId: number, database: MemoraDB = db) {
  await database.transaction('rw', [database.notebooks, database.topics, database.files, database.questions, database.reviews, database.words, database.vocabLists], async () => {
    const topicIds = await database.topics.where('notebookId').equals(notebookId).primaryKeys()
    await database.words.where('topicId').anyOf(topicIds).delete()
    await database.vocabLists.where('topicId').anyOf(topicIds).delete()
    await database.files.where('topicId').anyOf(topicIds).delete()
    await database.questions.where('topicId').anyOf(topicIds).delete()
    await database.reviews.where('topicId').anyOf(topicIds).delete()
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

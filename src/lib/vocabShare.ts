import { db, type MemoraDB, type VocabList, type Word } from './db'
import { fileName } from './document'
import { getSettings, updateSettings } from './settings'

// ─────────────────────────────────────────────────────────────
// Compartir un vocabulario como archivo (por WhatsApp, correo, Drive…).
// Funciona sin internet ni cuentas: quien lo recibe lo abre en Memora
// con «Importar vocabulario» y le aparece en su tema.
// ─────────────────────────────────────────────────────────────

type SharedWord = Omit<Word, 'id' | 'topicId' | 'listId' | 'createdAt'>

export interface SharedVocab {
  app: 'memora-vocabulario'
  version: 1
  name: string
  from: string
  lang: string
  text: string
  words: SharedWord[]
}

export function toShared(list: VocabList, words: Word[], from: string): SharedVocab {
  return {
    app: 'memora-vocabulario',
    version: 1,
    name: list.name,
    from,
    lang: list.lang,
    text: list.text,
    words: words.map(({ term, meaning, synonyms, antonyms, example, notes, hint, lang }) => ({ term, meaning, synonyms, antonyms, example, notes, hint, lang })),
  }
}

/** Revisa el archivo recibido. Devuelve el vocabulario o lanza un error con un mensaje claro. */
export function parseShared(raw: string): SharedVocab {
  let data: Partial<SharedVocab>
  try {
    data = JSON.parse(raw.replace(/^﻿/, ''))
  } catch {
    throw new Error('Este archivo no es un vocabulario de Memora.')
  }
  if (data?.app !== 'memora-vocabulario' || !Array.isArray(data.words)) throw new Error('Este archivo no es un vocabulario de Memora.')
  if (data.version !== 1) throw new Error('Este vocabulario es de una versión más nueva de Memora. Actualiza la app.')
  const words = data.words.filter((w) => typeof w?.term === 'string' && w.term.trim()).slice(0, 5000)
  return { app: 'memora-vocabulario', version: 1, name: String(data.name || 'Vocabulario').slice(0, 80), from: String(data.from || '').slice(0, 40), lang: String(data.lang || 'auto'), text: String(data.text || '').slice(0, 500_000), words }
}

/** Guarda en el tema un vocabulario recibido. Devuelve el id del nuevo vocabulario. */
export async function importShared(v: SharedVocab, topicId: number, database: MemoraDB = db, now = Date.now()) {
  return database.transaction('rw', [database.vocabLists, database.words], async () => {
    const listId = await database.vocabLists.add({ topicId, name: v.name, text: v.text, lang: v.lang, from: v.from || undefined, createdAt: now })
    await database.words.bulkAdd(v.words.map((w, i) => ({ ...w, term: w.term.trim(), lang: w.lang || 'en-US', topicId, listId, createdAt: now + i })) as Word[])
    return listId
  })
}

/** Tu nombre, para que tus hermanas sepan de quién es el vocabulario. */
export function myName(): string | null {
  const saved = getSettings().myName
  if (saved) return saved
  const name = prompt('¿Cómo te llamas? (Se verá en los vocabularios que compartas)')?.trim().slice(0, 40)
  if (name) updateSettings({ myName: name })
  return name || null
}

/** Comparte por el menú del celular (WhatsApp…) o, si no se puede, descarga el archivo. */
export async function shareVocab(list: VocabList, words: Word[]): Promise<string> {
  const from = myName() ?? ''
  const json = JSON.stringify(toShared(list, words, from))
  const name = fileName(`${list.name} - vocabulario Memora`, 'json')
  const file = new File([json], name, { type: 'application/json' })
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: list.name, text: `Vocabulario «${list.name}» para Memora. Ábrelo en Memora → tu tema → Vocabularios → Importar.` })
      return 'Listo. Quien lo reciba lo abre en Memora con «Importar vocabulario».'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'No se compartió.'
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return `Se descargó «${name}». Envíalo por WhatsApp o correo; quien lo reciba lo abre en Memora con «Importar vocabulario».`
}

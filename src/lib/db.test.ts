import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoraDB, addFiles, createNotebook, createTopic, deleteNotebook, deleteTopic } from './db'
import { formatBytes } from './format'

// Pruebas automáticas: comprueban que borrar un cuaderno o tema
// no deje archivos "huérfanos" ocupando espacio.
let db: MemoraDB

beforeEach(() => {
  db = new MemoraDB(`test-${Math.random()}`)
})
afterEach(async () => {
  await db.delete()
})

const file = (name: string) => new File(['hola'], name, { type: 'text/plain' })

describe('base de datos', () => {
  it('crea cuaderno, tema y archivos', async () => {
    const nb = await createNotebook({ name: '  Biología ', color: '#000', emoji: '🧪' }, db)
    const tp = await createTopic(nb, 'Célula', db)
    await addFiles(tp, [file('a.txt'), file('b.txt')], 'material', db)

    expect((await db.notebooks.get(nb))?.name).toBe('Biología')
    expect(await db.files.where('topicId').equals(tp).count()).toBe(2)
  })

  it('borrar un tema borra solo sus archivos', async () => {
    const nb = await createNotebook({ name: 'X', color: '#000', emoji: '📘' }, db)
    const t1 = await createTopic(nb, 'Uno', db)
    const t2 = await createTopic(nb, 'Dos', db)
    await addFiles(t1, [file('a.txt')], 'material', db)
    await addFiles(t2, [file('b.txt')], 'examen', db)

    await deleteTopic(t1, db)

    expect(await db.topics.count()).toBe(1)
    expect(await db.files.count()).toBe(1)
    expect((await db.files.toArray())[0].kind).toBe('examen')
  })

  it('borrar un cuaderno borra sus temas y archivos', async () => {
    const keep = await createNotebook({ name: 'Queda', color: '#000', emoji: '📘' }, db)
    const gone = await createNotebook({ name: 'Se va', color: '#000', emoji: '📘' }, db)
    const tKeep = await createTopic(keep, 'A', db)
    const tGone = await createTopic(gone, 'B', db)
    await addFiles(tKeep, [file('a.txt')], 'material', db)
    await addFiles(tGone, [file('b.txt'), file('c.txt')], 'material', db)

    await deleteNotebook(gone, db)

    expect(await db.notebooks.count()).toBe(1)
    expect(await db.topics.count()).toBe(1)
    expect(await db.files.count()).toBe(1)
  })
})

describe('formatBytes', () => {
  it('formatea tamaños', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(1536)).toBe('1,5 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB')
  })
})

describe('editar y deshacer', () => {
  it('edita nombre, ícono y color', async () => {
    const { updateNotebook } = await import('./db')
    const nb = await createNotebook({ name: 'Bio', color: '#000', emoji: '📘' }, db)
    await updateNotebook(nb, { name: ' Biología celular ', color: '#ec4899', emoji: '🦠' }, db)
    expect(await db.notebooks.get(nb)).toMatchObject({ name: 'Biología celular', color: '#ec4899', emoji: '🦠' })
  })

  it('deshacer devuelve el cuaderno con sus temas y archivos', async () => {
    const { snapshotNotebook, restoreSnapshot } = await import('./db')
    const nb = await createNotebook({ name: 'Física', color: '#000', emoji: '📐' }, db)
    const tp = await createTopic(nb, 'Cinemática', db)
    await addFiles(tp, [file('a.txt'), file('b.txt')], 'examen', db)

    const snap = await snapshotNotebook(nb, db)
    await deleteNotebook(nb, db)
    expect(await db.files.count()).toBe(0)

    await restoreSnapshot(snap, db)
    expect((await db.notebooks.get(nb))?.name).toBe('Física')
    expect((await db.topics.get(tp))?.notebookId).toBe(nb)
    expect(await db.files.where('topicId').equals(tp).count()).toBe(2)
  })

  it('deshacer un tema lo devuelve con sus archivos', async () => {
    const { snapshotTopic, restoreSnapshot } = await import('./db')
    const nb = await createNotebook({ name: 'X', color: '#000', emoji: '📘' }, db)
    const tp = await createTopic(nb, 'Uno', db)
    await addFiles(tp, [file('a.txt')], 'material', db)
    const snap = await snapshotTopic(tp, db)
    await deleteTopic(tp, db)
    await restoreSnapshot(snap, db)
    expect(await db.files.where('topicId').equals(tp).count()).toBe(1)
  })
})

describe('varios vocabularios por tema', () => {
  it('pasa las palabras antiguas a un vocabulario «Vocabulario»', async () => {
    const { default: Dexie } = await import('dexie')
    const name = `migra-${Math.random()}`
    const old = new Dexie(name)
    old.version(4).stores({ notebooks: '++id, createdAt', topics: '++id, notebookId, createdAt', files: '++id, topicId, createdAt', questions: '++id, topicId, type, createdAt', reviews: 'questionId, topicId, due', days: 'date', words: '++id, topicId, createdAt' })
    await old.table('words').bulkAdd([
      { topicId: 1, term: 'apple', lang: 'en-US', createdAt: 1 },
      { topicId: 1, term: 'pear', lang: 'en-US', createdAt: 2 },
      { topicId: 2, term: 'chat', lang: 'fr-FR', createdAt: 3 },
    ])
    old.close()
    const nuevo = new MemoraDB(name)
    const lists = await nuevo.vocabLists.toArray()
    expect(lists.map((l) => [l.topicId, l.name])).toEqual([
      [1, 'Vocabulario'],
      [2, 'Vocabulario'],
    ])
    const words = await nuevo.words.toArray()
    expect(words.every((w) => lists.find((l) => l.id === w.listId)?.topicId === w.topicId)).toBe(true)
    await nuevo.delete()
  })

  it('borrar un tema borra también sus vocabularios', async () => {
    const nb = await createNotebook({ name: 'Inglés', color: '#000', emoji: '🗣️' }, db)
    const t = await createTopic(nb, 'Canciones', db)
    const { createVocabList } = await import('./db')
    const l = await createVocabList(t, 'Imagine', db)
    await db.words.add({ topicId: t, listId: l, term: 'dream', lang: 'en-US', createdAt: 1 } as never)
    await deleteTopic(t, db)
    expect(await db.vocabLists.count()).toBe(0)
    expect(await db.words.count()).toBe(0)
  })
})

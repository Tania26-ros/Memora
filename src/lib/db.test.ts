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

import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { checkBackup, exportAll, restoreAll } from './backup'
import { MemoraDB, createNotebook, createTopic } from './db'

describe('copia de seguridad', () => {
  it('exporta y restaura todo, incluidos los archivos', async () => {
    const a = new MemoraDB('copia-a')
    const nb = await createNotebook({ name: 'Inglés', color: '#5b4cf0', emoji: '🗣️' }, a)
    const tp = await createTopic(nb, 'Rutina', a)
    await a.files.add({ topicId: tp, name: 'nota.txt', mimeType: 'text/plain', size: 4, kind: 'material', blob: new Blob(['hola'], { type: 'text/plain' }), createdAt: 1 } as never)
    await a.words.add({ topicId: tp, term: 'wake up', meaning: 'despertarse', lang: 'en-US', createdAt: 1 } as never)
    await a.days.put({ date: '2026-11-07', xp: 30, answered: 3, correct: 2 })

    const backup = JSON.parse(JSON.stringify(await exportAll({}, a)))
    expect(checkBackup(backup)).toBeNull()

    const b = new MemoraDB('copia-b')
    await createNotebook({ name: 'Viejo', color: '#000', emoji: '📘' }, b)
    await restoreAll(backup, b)
    expect((await b.notebooks.toArray()).map((n) => n.name)).toEqual(['Inglés'])
    expect((await b.words.toArray())[0].term).toBe('wake up')
    expect(await (await b.files.toArray())[0].blob.text()).toBe('hola')
    expect((await b.days.get('2026-11-07'))?.xp).toBe(30)
  })
  it('rechaza archivos que no son de Memora', () => {
    expect(checkBackup({ foo: 1 })).toMatch(/no es una copia/)
    expect(checkBackup({ app: 'memora', version: 2 })).toMatch(/más nueva/)
  })
})

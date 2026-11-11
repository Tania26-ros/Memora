import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { MemoraDB, type VocabList, type Word } from './db'
import { importShared, parseShared, toShared } from './vocabShare'

const list: VocabList = { id: 9, topicId: 1, name: 'Imagine', text: 'Imagine all the people', lang: 'en-US', createdAt: 1 }
const words = [
  { id: 1, topicId: 1, listId: 9, term: 'people', meaning: 'gente', lang: 'en-US', createdAt: 1 },
  { id: 2, topicId: 1, listId: 9, term: 'imagine', meaning: 'imaginar', notes: 'verbo', lang: 'en-US', createdAt: 2 },
] as Word[]

it('un vocabulario compartido viaja sin ids y llega completo al tema de otra persona', async () => {
  const file = JSON.stringify(toShared(list, words, 'Ganio'))
  expect(file).not.toContain('"listId"')
  const db = new MemoraDB(`comparte-${Math.random()}`)
  const id = await importShared(parseShared(file), 5, db, 100)
  const got = await db.vocabLists.get(id)
  expect(got).toMatchObject({ topicId: 5, name: 'Imagine', from: 'Ganio', text: 'Imagine all the people' })
  const ws = await db.words.where('listId').equals(id).toArray()
  expect(ws.map((w) => [w.term, w.meaning, w.topicId])).toEqual([
    ['people', 'gente', 5],
    ['imagine', 'imaginar', 5],
  ])
  await db.delete()
})

it('rechaza archivos que no son vocabularios de Memora', () => {
  expect(() => parseShared('hola')).toThrow(/no es un vocabulario/)
  expect(() => parseShared('{"app":"memora","version":1}')).toThrow(/no es un vocabulario/)
  expect(() => parseShared('{"app":"memora-vocabulario","version":2,"words":[]}')).toThrow(/versión más nueva/)
})

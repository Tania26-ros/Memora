import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { MemoraDB, createNotebook, createTopic } from './db'
import { homeState } from './guide'

it('Memo encuentra el tema con más repasos pendientes y la racha', async () => {
  const db = new MemoraDB(`guia-${Math.random()}`)
  const now = new Date(2026, 10, 11, 9)
  const nb = await createNotebook({ name: 'Bio', color: '#000', emoji: '🧪' }, db)
  const a = await createTopic(nb, 'Célula', db)
  const b = await createTopic(nb, 'Tejidos', db)
  const past = now.getTime() - 1000
  const r = (questionId: number, topicId: number, due: number) => ({ questionId, topicId, due, card: {} as never, correct: 0, wrong: 0, lastResult: 'ok' as const, lastReviewed: 0 })
  await db.reviews.bulkAdd([r(1, a, past), r(2, b, past), r(3, b, past), r(4, b, now.getTime() + 86400000)])
  await db.days.bulkAdd([
    { date: '2026-11-10', xp: 40, answered: 4, correct: 3 },
    { date: '2026-11-11', xp: 25, answered: 2, correct: 2 },
  ])
  const s = await homeState(60, db, now)
  expect(s).toMatchObject({ hour: 9, notebooks: 1, due: 3, dueTopic: { id: b, name: 'Tejidos' }, todayAnswered: 2, streak: 2 })
  await db.delete()
})

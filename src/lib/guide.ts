import { db, type MemoraDB } from './db'
import type { HomeState } from './mascot'
import { dayKey, streakInfo } from './progress'

/** Reúne lo que Memo necesita saber para aconsejar en el inicio. */
export async function homeState(dailyGoal: number, database: MemoraDB = db, now = new Date()): Promise<HomeState> {
  const [notebooks, questions, days, due] = await Promise.all([
    database.notebooks.count(),
    database.questions.count(),
    database.days.toArray(),
    database.reviews.where('due').belowOrEqual(now.getTime()).toArray(),
  ])
  const today = dayKey(now)
  const perTopic = new Map<number, number>()
  for (const r of due) perTopic.set(r.topicId, (perTopic.get(r.topicId) ?? 0) + 1)
  const [topId] = [...perTopic.entries()].sort((a, b) => b[1] - a[1])[0] ?? []
  const topic = topId !== undefined ? await database.topics.get(topId) : undefined
  return {
    hour: now.getHours(),
    notebooks,
    questions,
    todayAnswered: days.find((d) => d.date === today)?.answered ?? 0,
    dailyGoal,
    streak: streakInfo(days, today).current,
    due: due.length,
    dueTopic: topic ? { id: topic.id, name: topic.name } : undefined,
  }
}

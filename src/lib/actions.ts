import { db, deleteNotebook, deleteTopic, restoreSnapshot, snapshotNotebook, snapshotTopic, type Notebook, type Topic } from './db'
import type { Question } from './questions'
import { showUndo } from './undo'

// Borrar en un toque, con "Deshacer" durante unos segundos.
export async function deleteNotebookWithUndo(nb: Pick<Notebook, 'id'>) {
  const snap = await snapshotNotebook(nb.id)
  await deleteNotebook(nb.id)
  showUndo('Cuaderno borrado', () => restoreSnapshot(snap))
}

export async function deleteTopicWithUndo(topic: Pick<Topic, 'id'>) {
  const snap = await snapshotTopic(topic.id)
  await deleteTopic(topic.id)
  showUndo('Tema borrado', () => restoreSnapshot(snap))
}

export async function deleteQuestionWithUndo(q: Question) {
  const review = await db.reviews.get(q.id)
  await db.transaction('rw', db.questions, db.reviews, async () => {
    await db.questions.delete(q.id)
    await db.reviews.delete(q.id)
  })
  showUndo('Pregunta borrada', async () => {
    await db.questions.put(q)
    if (review) await db.reviews.put(review)
  })
}

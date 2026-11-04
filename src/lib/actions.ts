import { deleteNotebook, deleteTopic, restoreSnapshot, snapshotNotebook, snapshotTopic, type Notebook, type Topic } from './db'
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

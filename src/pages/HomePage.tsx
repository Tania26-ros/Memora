import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import EditNotebookDialog from '../components/EditNotebookDialog'
import NotebookForm from '../components/NotebookForm'
import { deleteNotebookWithUndo } from '../lib/actions'
import { createNotebook, db, type Notebook } from '../lib/db'

// Página de inicio: tus cuadernos.
// useLiveQuery vuelve a leer la base de datos cada vez que algo cambia,
// así la lista se actualiza sola al crear, editar o borrar.
export default function HomePage() {
  const notebooks = useLiveQuery(() => db.notebooks.orderBy('createdAt').toArray(), [])
  const topicCounts = useLiveQuery(async () => {
    const counts = new Map<number, number>()
    const keys = await db.topics.orderBy('notebookId').keys()
    for (const k of keys) counts.set(k as number, (counts.get(k as number) ?? 0) + 1)
    return counts
  }, [])
  // null = ventana cerrada; 'nuevo' = crear; un cuaderno = editarlo.
  const [dialog, setDialog] = useState<Notebook | 'nuevo' | null>(null)

  if (!notebooks) return null

  return (
    <section>
      <div className="page-head">
        <h1 className="page-title">Mis cuadernos</h1>
        {notebooks.length > 0 && (
          <button className="btn" onClick={() => setDialog('nuevo')}>
            + Nuevo cuaderno
          </button>
        )}
      </div>
      <p className="lead">Un cuaderno por curso. Dentro, un tema por cada unidad o capítulo.</p>

      {notebooks.length === 0 ? (
        // La primera vez mostramos el formulario directamente.
        <div className="card create-card">
          <h2>Crea tu primer cuaderno</h2>
          <NotebookForm idPrefix="first" submitLabel="Crear cuaderno" onSubmit={(v) => createNotebook(v)} />
        </div>
      ) : (
        <ul className="grid">
          {notebooks.map((nb) => {
            const n = topicCounts?.get(nb.id) ?? 0
            return (
              <li key={nb.id} className="notebook-item" style={{ '--nb': nb.color } as React.CSSProperties}>
                <Link to={`/cuaderno/${nb.id}`} className="notebook-card">
                  <span className="notebook-emoji" aria-hidden>
                    {nb.emoji}
                  </span>
                  <span className="notebook-name">{nb.name}</span>
                  <span className="muted">
                    {n} {n === 1 ? 'tema' : 'temas'}
                  </span>
                </Link>
                <div className="card-actions">
                  <button className="btn btn-small btn-ghost" aria-label={`Editar ${nb.name}`} onClick={() => setDialog(nb)}>
                    Editar
                  </button>
                  <button className="btn btn-small btn-ghost" aria-label={`Borrar ${nb.name}`} onClick={() => deleteNotebookWithUndo(nb)}>
                    Borrar
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {dialog && (
        <EditNotebookDialog
          key={dialog === 'nuevo' ? 'nuevo' : dialog.id}
          notebook={dialog === 'nuevo' ? undefined : dialog}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  )
}

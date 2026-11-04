import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import EditNotebookDialog from '../components/EditNotebookDialog'
import { deleteNotebookWithUndo } from '../lib/actions'
import { createTopic, db } from '../lib/db'

// Página de un cuaderno: sus temas.
export default function NotebookPage() {
  const notebookId = Number(useParams().notebookId)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [editing, setEditing] = useState(false)

  // "null" significa que ya buscamos y no existe; "undefined", que aún está cargando.
  const notebook = useLiveQuery(async () => (await db.notebooks.get(notebookId)) ?? null, [notebookId])
  const topics = useLiveQuery(() => db.topics.where('notebookId').equals(notebookId).sortBy('createdAt'), [notebookId])
  const fileCounts = useLiveQuery(async () => {
    const ids = (topics ?? []).map((t) => t.id)
    const counts = new Map<number, number>()
    // .keys() lee solo el índice (el topicId de cada archivo), sin cargar los archivos.
    const keys = await db.files.where('topicId').anyOf(ids).keys()
    for (const k of keys) counts.set(k as number, (counts.get(k as number) ?? 0) + 1)
    return counts
  }, [topics])

  if (notebook === undefined || !topics) return null
  if (notebook === null)
    return (
      <p className="empty">
        Este cuaderno ya no existe. <Link to="/">Volver</Link>
      </p>
    )

  return (
    <section>
      <nav className="crumbs">
        <Link to="/">Cuadernos</Link>
      </nav>
      <div className="page-head" style={{ '--nb': notebook.color } as React.CSSProperties}>
        <span className="notebook-emoji" aria-hidden>
          {notebook.emoji}
        </span>
        <h1 className="page-title">{notebook.name}</h1>
        <div className="head-actions">
          <button className="btn btn-small btn-ghost" onClick={() => setEditing(true)}>
            Editar
          </button>
          <button
            className="btn btn-small btn-ghost"
            onClick={async () => {
              navigate('/')
              await deleteNotebookWithUndo(notebook)
            }}
          >
            Borrar
          </button>
        </div>
      </div>

      <form
        className="card inline-form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          await createTopic(notebookId, name)
          setName('')
        }}
      >
        <input className="input" placeholder="Nuevo tema, ej.: La célula" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre del tema" />
        <button className="btn" disabled={!name.trim()}>
          Añadir tema
        </button>
      </form>

      {topics.length === 0 ? (
        <p className="empty">Este cuaderno no tiene temas todavía.</p>
      ) : (
        <ol className="list">
          {topics.map((t, i) => {
            const n = fileCounts?.get(t.id) ?? 0
            return (
              <li key={t.id}>
                <Link to={`/tema/${t.id}`} className="list-item">
                  <span className="list-num">{i + 1}</span>
                  <span className="list-name">{t.name}</span>
                  <span className="muted">
                    {n} {n === 1 ? 'archivo' : 'archivos'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
      {editing && <EditNotebookDialog notebook={notebook} onClose={() => setEditing(false)} />}
    </section>
  )
}

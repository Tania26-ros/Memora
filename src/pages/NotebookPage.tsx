import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ConfirmButton from '../components/ConfirmButton'
import EditableTitle from '../components/EditableTitle'
import { createTopic, db, deleteNotebook } from '../lib/db'

// Página de un cuaderno: sus temas.
export default function NotebookPage() {
  const notebookId = Number(useParams().notebookId)
  const navigate = useNavigate()
  const [name, setName] = useState('')

  // "null" significa que ya buscamos y no existe; "undefined", que aún está cargando.
  const notebook = useLiveQuery(async () => (await db.notebooks.get(notebookId)) ?? null, [notebookId])
  const topics = useLiveQuery(() => db.topics.where('notebookId').equals(notebookId).sortBy('createdAt'), [notebookId])
  const fileCounts = useLiveQuery(async () => {
    const ids = (topics ?? []).map((t) => t.id)
    const counts = new Map<number, number>()
    await db.files.where('topicId').anyOf(ids).each((f) => counts.set(f.topicId, (counts.get(f.topicId) ?? 0) + 1))
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
        <EditableTitle value={notebook.name} onSave={(v) => db.notebooks.update(notebookId, { name: v })} />
        <ConfirmButton
          label="Borrar cuaderno"
          confirmText="¿Borrar con todos sus temas?"
          onConfirm={async () => {
            await deleteNotebook(notebookId)
            navigate('/')
          }}
        >
          Borrar
        </ConfirmButton>
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
    </section>
  )
}

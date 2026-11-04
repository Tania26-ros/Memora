import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import EditableTitle from '../components/EditableTitle'
import FileList from '../components/FileList'
import FileUploader from '../components/FileUploader'
import StudyPanel from '../components/StudyPanel'
import { deleteTopicWithUndo } from '../lib/actions'
import { db } from '../lib/db'

// Página de un tema: subir archivos, verlos y (pronto) estudiar con ellos.
export default function TopicPage() {
  const topicId = Number(useParams().topicId)
  const navigate = useNavigate()

  const topic = useLiveQuery(async () => (await db.topics.get(topicId)) ?? null, [topicId])
  const notebook = useLiveQuery(async () => (topic ? ((await db.notebooks.get(topic.notebookId)) ?? null) : null), [topic])
  const files = useLiveQuery(async () => (await db.files.where('topicId').equals(topicId).sortBy('createdAt')).reverse(), [topicId])

  if (topic === undefined || !files) return null
  if (topic === null)
    return (
      <p className="empty">
        Este tema ya no existe. <Link to="/">Volver</Link>
      </p>
    )

  return (
    <section>
      <nav className="crumbs">
        <Link to="/">Cuadernos</Link>
        {notebook && (
          <>
            <span aria-hidden> / </span>
            <Link to={`/cuaderno/${notebook.id}`}>
              {notebook.emoji} {notebook.name}
            </Link>
          </>
        )}
      </nav>
      <div className="page-head">
        <EditableTitle value={topic.name} onSave={(v) => db.topics.update(topicId, { name: v })} />
        <button
          className="btn btn-small btn-ghost"
          onClick={async () => {
            navigate(`/cuaderno/${topic.notebookId}`)
            await deleteTopicWithUndo(topic)
          }}
        >
          Borrar
        </button>
      </div>

      <div className="topic-layout">
        <div className="topic-main">
          <FileUploader topicId={topicId} />
          <h2>
            Materiales <span className="muted">({files.length})</span>
          </h2>
          <FileList files={files} />
        </div>
        <StudyPanel />
      </div>
    </section>
  )
}

import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import { isDue } from '../lib/srs'

// Tarjeta del tema con sus preguntas: cuántas hay, cuántas tocan hoy y botones para jugar.
export default function QuestionsCard({ topicId }: { topicId: number }) {
  const total = useLiveQuery(() => db.questions.where('topicId').equals(topicId).count(), [topicId])
  const due = useLiveQuery(async () => (await db.reviews.where('topicId').equals(topicId).toArray()).filter((r) => isDue(r)).length, [topicId])
  if (total === undefined) return null

  return (
    <div className="card q-summary">
      <div>
        <h2>Preguntas y juegos</h2>
        <p className="muted">
          {total === 0 ? 'Escribe preguntas para empezar a jugar.' : `${total} ${total === 1 ? 'pregunta' : 'preguntas'}`}
          {!!due && ` · ${due} para repasar hoy`}
        </p>
      </div>
      <div className="q-summary-actions">
        {!!due && (
          <Link className="btn" to={`/tema/${topicId}/jugar?modo=repaso`}>
            Repasar hoy ({due})
          </Link>
        )}
        {total > 0 && (
          <Link className={`btn ${due ? 'btn-ghost' : ''}`} to={`/tema/${topicId}/jugar`}>
            Jugar
          </Link>
        )}
        <Link className="btn btn-ghost" to={`/tema/${topicId}/preguntas`}>
          {total === 0 ? 'Escribir preguntas' : 'Ver y editar preguntas'}
        </Link>
      </div>
    </div>
  )
}

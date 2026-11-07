import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../lib/db'

// Tarjeta del tema con su vocabulario.
export default function VocabCard({ topicId }: { topicId: number }) {
  const count = useLiveQuery(() => db.words.where('topicId').equals(topicId).count(), [topicId])
  if (count === undefined) return null
  return (
    <div className="card q-summary">
      <div>
        <h2>Vocabulario</h2>
        <p className="muted">{count === 0 ? 'Sombrea palabras de un texto, canción o video para aprenderlas.' : `${count} ${count === 1 ? 'palabra' : 'palabras'}`}</p>
      </div>
      <div className="q-summary-actions">
        {count >= 2 && (
          <Link className="btn" to={`/tema/${topicId}/vocabulario/practicar`}>
            Practicar
          </Link>
        )}
        <Link className="btn btn-ghost" to={`/tema/${topicId}/vocabulario`}>
          {count === 0 ? 'Crear vocabulario' : 'Ver vocabulario'}
        </Link>
      </div>
    </div>
  )
}

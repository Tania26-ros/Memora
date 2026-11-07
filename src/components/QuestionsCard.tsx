import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import { isDue } from '../lib/srs'

// Tarjeta del tema con sus preguntas: cuántas hay, cuántas tocan hoy y botones para jugar.
// Mientras el tema es nuevo, muestra la guía «paso a paso» con el siguiente paso resaltado.
export default function QuestionsCard({ topicId }: { topicId: number }) {
  const data = useLiveQuery(async () => {
    const [total, files, reviews] = await Promise.all([
      db.questions.where('topicId').equals(topicId).count(),
      db.files.where('topicId').equals(topicId).count(),
      db.reviews.where('topicId').equals(topicId).toArray(),
    ])
    return { total, files, played: reviews.length, due: reviews.filter((r) => isDue(r)).length }
  }, [topicId])
  if (!data) return null
  const { total, files, played, due } = data

  // Pasos de la guía. El primero sin hacer es el «siguiente paso».
  const steps = [
    { label: 'Sube tus materiales (apuntes, PDF, fotos)', done: files > 0, optional: true },
    { label: 'Crea al menos 5 preguntas: escríbelas o pega un cuestionario', done: total >= 5 },
    { label: 'Estudia las respuestas y juega tu primera ronda', done: played > 0 },
    { label: 'Vuelve cuando Memora te avise para repasar', done: false },
  ]
  const now = steps.findIndex((s) => !s.done && !s.optional)
  const showGuide = total < 5 || played === 0

  return (
    <div className="card q-summary">
      <div>
        <h2>Preguntas y juegos</h2>
        <p className="muted">
          {total === 0 ? 'Todavía no hay preguntas.' : `${total} ${total === 1 ? 'pregunta' : 'preguntas'}`}
          {!!due && ` · ${due} para repasar hoy`}
        </p>
        {showGuide && (
          <ol className="steps" aria-label="Paso a paso">
            {steps.map((s, i) => (
              <li key={i} className={s.done ? 'step-done' : i === now ? 'step-now' : ''} aria-current={i === now ? 'step' : undefined}>
                <span className="step-dot">{s.done ? '✓' : i + 1}</span>
                <span>
                  {i === now && 'Siguiente: '}
                  {s.label}
                  {s.optional && !s.done && <span className="muted"> (opcional)</span>}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div className="q-summary-actions">
        {!!due && (
          <Link className="btn" to={`/tema/${topicId}/jugar?modo=repaso`}>
            Repasar hoy ({due})
          </Link>
        )}
        {total > 0 && (
          <Link className={`btn ${due || now === 1 ? 'btn-ghost' : ''}`} to={`/tema/${topicId}/jugar`}>
            Jugar
          </Link>
        )}
        <Link className={`btn ${now === 1 && total === 0 ? '' : 'btn-ghost'}`} to={`/tema/${topicId}/preguntas`}>
          {total === 0 ? 'Escribir preguntas' : 'Ver y editar preguntas'}
        </Link>
        <Link className={`btn ${now === 1 && total > 0 ? '' : 'btn-ghost'}`} to={`/tema/${topicId}/pegar`}>
          📋 Pegar preguntas
        </Link>
      </div>
    </div>
  )
}

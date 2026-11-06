import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QuestionEditor from '../components/QuestionEditor'
import { deleteQuestionWithUndo } from '../lib/actions'
import { db } from '../lib/db'
import { DIFFICULTIES, QUESTION_TYPES, correctAnswerText, type Question } from '../lib/questions'
import { dueLabel } from '../lib/srs'

// Lista de preguntas de un tema: añadir, editar, marcar con estrella y borrar.
export default function QuestionsPage() {
  const topicId = Number(useParams().topicId)
  const topic = useLiveQuery(() => db.topics.get(topicId), [topicId])
  const questions = useLiveQuery(() => db.questions.where('topicId').equals(topicId).sortBy('createdAt'), [topicId])
  const reviews = useLiveQuery(async () => new Map((await db.reviews.where('topicId').equals(topicId).toArray()).map((r) => [r.questionId, r])), [topicId])
  const [editing, setEditing] = useState<Question | 'nueva' | null>(null)

  if (!questions || !topic) return null

  return (
    <section>
      <nav className="crumbs">
        <Link to={`/tema/${topicId}`}>← {topic.name}</Link>
      </nav>
      <div className="page-head">
        <h1 className="page-title">Preguntas</h1>
        <div className="card-actions">
          <Link className="btn btn-ghost" to={`/tema/${topicId}/pegar`}>
            📋 Pegar preguntas
          </Link>
          <button className="btn" onClick={() => setEditing('nueva')}>
            + Nueva pregunta
          </button>
        </div>
      </div>
      <p className="lead">
        {questions.length} {questions.length === 1 ? 'pregunta' : 'preguntas'}. Escríbelas una por una o pega un cuestionario completo. (Con Memora Premium, más adelante, también se podrán crear solas.)
      </p>

      {questions.length === 0 ? (
        <p className="empty">Escribe tu primera pregunta con «+ Nueva pregunta», o usa «Pegar preguntas» si ya tienes un examen o cuestionario.</p>
      ) : (
        <ol className="q-list">
          {questions.map((q, i) => {
            const r = reviews?.get(q.id)
            return (
              <li key={q.id} className="q-item">
                <div className="q-item-head">
                  <span className="list-num">{i + 1}</span>
                  <span className="badge">{QUESTION_TYPES.find((t) => t.value === q.type)?.label}</span>
                  <span className={`badge diff-badge diff-${q.difficulty}`}>{DIFFICULTIES.find((d) => d.value === q.difficulty)?.label}</span>
                  {r && <span className={`badge ${r.lastResult === 'fail' ? 'badge-fail' : 'badge-ok'}`}>Repaso {dueLabel(r.due)}</span>}
                </div>
                <p className="q-item-prompt">{q.type === 'cloze' ? q.text.replace(/\[\[\d+\]\]/g, '____') : q.prompt}</p>
                <p className="muted">Respuesta: {correctAnswerText(q)}</p>
                <div className="card-actions">
                  <button className="btn btn-small btn-ghost" aria-pressed={!!q.starred} aria-label={q.starred ? 'Quitar estrella' : 'Marcar con estrella'} onClick={() => db.questions.update(q.id, { starred: !q.starred })}>
                    {q.starred ? '★' : '☆'}
                  </button>
                  <button className="btn btn-small btn-ghost" onClick={() => setEditing(q)}>
                    Editar
                  </button>
                  <button className="btn btn-small btn-ghost" onClick={() => deleteQuestionWithUndo(q)}>
                    Borrar
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {editing && <QuestionEditor key={editing === 'nueva' ? 'nueva' : editing.id} topicId={topicId} question={editing === 'nueva' ? undefined : editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

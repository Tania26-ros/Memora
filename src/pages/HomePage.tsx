import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { NOTEBOOK_COLORS, NOTEBOOK_EMOJIS, createNotebook, db } from '../lib/db'

// Página de inicio: tus cuadernos.
// useLiveQuery vuelve a leer la base de datos cada vez que algo cambia,
// así la lista se actualiza sola al crear o borrar.
export default function HomePage() {
  const notebooks = useLiveQuery(() => db.notebooks.orderBy('createdAt').toArray(), [])
  const topicCounts = useLiveQuery(async () => {
    const counts = new Map<number, number>()
    await db.topics.each((t) => counts.set(t.notebookId, (counts.get(t.notebookId) ?? 0) + 1))
    return counts
  }, [])

  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(NOTEBOOK_EMOJIS[0])
  const [color, setColor] = useState(NOTEBOOK_COLORS[0])

  if (!notebooks) return null

  return (
    <section>
      <h1>Mis cuadernos</h1>
      <p className="lead">Un cuaderno por curso. Dentro, un tema por cada unidad o capítulo.</p>

      <form
        className="card create-form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          await createNotebook({ name, emoji, color })
          setName('')
        }}
      >
        <label className="field">
          <span>Nuevo cuaderno</span>
          <input className="input" placeholder="Ej.: Biología, Inglés B2, Derecho civil" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="picker" role="radiogroup" aria-label="Ícono">
          {NOTEBOOK_EMOJIS.map((em) => (
            <button type="button" key={em} role="radio" aria-checked={em === emoji} className={`chip ${em === emoji ? 'chip-on' : ''}`} onClick={() => setEmoji(em)}>
              {em}
            </button>
          ))}
        </div>
        <div className="picker" role="radiogroup" aria-label="Color">
          {NOTEBOOK_COLORS.map((c) => (
            <button type="button" key={c} role="radio" aria-checked={c === color} aria-label={`Color ${c}`} className={`swatch ${c === color ? 'swatch-on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
        <button className="btn" disabled={!name.trim()}>
          Crear cuaderno
        </button>
      </form>

      {notebooks.length === 0 ? (
        <p className="empty">Aún no tienes cuadernos. Crea el primero arriba.</p>
      ) : (
        <ul className="grid">
          {notebooks.map((nb) => {
            const n = topicCounts?.get(nb.id) ?? 0
            return (
              <li key={nb.id}>
                <Link to={`/cuaderno/${nb.id}`} className="notebook-card" style={{ '--nb': nb.color } as React.CSSProperties}>
                  <span className="notebook-emoji" aria-hidden>
                    {nb.emoji}
                  </span>
                  <span className="notebook-name">{nb.name}</span>
                  <span className="muted">
                    {n} {n === 1 ? 'tema' : 'temas'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

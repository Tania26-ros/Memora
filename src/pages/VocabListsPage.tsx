import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createVocabList, db } from '../lib/db'
import { importShared, parseShared } from '../lib/vocabShare'

// Los vocabularios de un tema: puedes tener varios (uno por lectura,
// canción o video) y recibir los que te compartan tus hermanas o amigos.
export default function VocabListsPage() {
  const topicId = Number(useParams().topicId)
  const navigate = useNavigate()
  const topic = useLiveQuery(() => db.topics.get(topicId), [topicId])
  const lists = useLiveQuery(() => db.vocabLists.where('topicId').equals(topicId).sortBy('createdAt'), [topicId])
  const counts = useLiveQuery(async () => {
    const m = new Map<number, number>()
    for (const w of await db.words.where('topicId').equals(topicId).toArray()) m.set(w.listId, (m.get(w.listId) ?? 0) + 1)
    return m
  }, [topicId])
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!topic || !lists) return null

  const create = async () => {
    const id = await createVocabList(topicId, name || `Vocabulario ${lists.length + 1}`)
    navigate(`/tema/${topicId}/vocabulario/${id}`)
  }
  const importFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      const id = await importShared(parseShared(await file.text()), topicId)
      navigate(`/tema/${topicId}/vocabulario/${id}?ver=palabras`)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  const total = [...(counts?.values() ?? [])].reduce((a, b) => a + b, 0)

  return (
    <section>
      <nav className="crumbs">
        <Link to={`/tema/${topicId}`}>← {topic.name}</Link>
      </nav>
      <div className="page-head">
        <h1 className="page-title">Vocabularios</h1>
        {total >= 2 && (
          <Link className="btn" to={`/tema/${topicId}/vocabulario/practicar`}>
            Practicar todos
          </Link>
        )}
      </div>
      <p className="lead">Crea un vocabulario por cada lectura, canción o video. También puedes recibir los de otras personas y competir con ellos.</p>

      {lists.length > 0 && (
        <ul className="grid">
          {lists.map((l) => {
            const n = counts?.get(l.id) ?? 0
            return (
              <li key={l.id}>
                <Link to={`/tema/${topicId}/vocabulario/${l.id}`} className="card vocab-list-card">
                  <strong>{l.name}</strong>
                  <span className="muted">
                    {n} {n === 1 ? 'palabra' : 'palabras'}
                    {l.from ? ` · de ${l.from}` : ''}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          void create()
        }}
      >
        <h2>Nuevo vocabulario</h2>
        <label className="field" htmlFor="vl-name">
          <span>Nombre</span>
          <input id="vl-name" className="input" value={name} maxLength={80} placeholder={`Ej.: Canción «Imagine», Lectura 3…`} onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="btn btn-block">Crear vocabulario</button>
      </form>

      <div className="card">
        <h2>Importar un vocabulario compartido</h2>
        <p className="muted">Si alguien te mandó un vocabulario de Memora por WhatsApp o correo, descarga el archivo y elígelo aquí.</p>
        <label className="btn btn-ghost file-btn">
          📥 Elegir archivo
          <input type="file" accept=".json,application/json" hidden onChange={(e) => void importFile(e.target.files?.[0])} />
        </label>
        {error && (
          <p className="import-problem" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}

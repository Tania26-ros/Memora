import { useEffect, useRef, useState } from 'react'
import { db, type Word } from '../lib/db'
import { LANGUAGES } from '../lib/speech'
import { nowMs } from '../lib/questions'

export type WordDraft = Partial<Omit<Word, 'id' | 'topicId' | 'listId' | 'createdAt'>> & { id?: number }

const FIELDS: { key: 'meaning' | 'synonyms' | 'antonyms' | 'example' | 'notes' | 'hint'; label: string; placeholder: string }[] = [
  { key: 'meaning', label: 'Significado', placeholder: 'Ej.: levantarse, despertarse' },
  { key: 'synonyms', label: 'Sinónimos', placeholder: 'Separados por comas' },
  { key: 'antonyms', label: 'Antónimos', placeholder: 'Separados por comas' },
  { key: 'example', label: 'Contexto o ejemplo', placeholder: 'La frase donde aparece' },
  { key: 'notes', label: 'Notas', placeholder: 'Lo que quieras recordar' },
  { key: 'hint', label: 'Pista', placeholder: 'Una ayuda para cuando practiques' },
]

// Ventana para añadir o editar una palabra del vocabulario.
export default function WordEditor({ topicId, listId, draft, onClose }: { topicId: number; listId: number; draft: WordDraft; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal()
  }, [])
  const [w, setW] = useState<WordDraft>({ lang: 'en-US', ...draft })
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    const term = w.term?.trim()
    if (!term) return setError('Escribe la palabra o frase.')
    const clean = Object.fromEntries(FIELDS.map((f) => [f.key, w[f.key]?.trim() || undefined]))
    const data = { ...clean, term, lang: w.lang ?? 'en-US', topicId, listId }
    if (w.id) await db.words.update(w.id, data)
    else await db.words.add({ ...data, createdAt: nowMs() } as Word)
    ref.current?.close()
  }

  return (
    <dialog ref={ref} className="dialog dialog-wide" onClose={onClose} aria-labelledby="word-title">
      <h2 id="word-title">{w.id ? 'Editar palabra' : 'Nueva palabra'}</h2>
      <form
        className="q-form"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <div className="setup-grid">
          <label className="field" htmlFor="w-term">
            <span>Palabra o frase</span>
            <input id="w-term" className="input" value={w.term ?? ''} onChange={(e) => setW({ ...w, term: e.target.value })} />
          </label>
          <label className="field" htmlFor="w-lang">
            <span>Idioma</span>
            <select id="w-lang" className="input" value={w.lang} onChange={(e) => setW({ ...w, lang: e.target.value })}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {FIELDS.map((f) => (
          <label key={f.key} className="field" htmlFor={`w-${f.key}`}>
            <span>{f.label} (opcional)</span>
            <input id={`w-${f.key}`} className="input" value={w[f.key] ?? ''} placeholder={f.placeholder} onChange={(e) => setW({ ...w, [f.key]: e.target.value })} />
          </label>
        ))}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>
            Cancelar
          </button>
          <button className="btn">Guardar palabra</button>
        </div>
      </form>
    </dialog>
  )
}

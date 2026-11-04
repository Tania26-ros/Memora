import { useState } from 'react'

// Título que se puede renombrar: toca "Renombrar", escribe y pulsa Enter.
export default function EditableTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (!editing) {
    return (
      <div className="title-row">
        <h1>{value}</h1>
        <button
          className="btn btn-small btn-ghost"
          onClick={() => {
            setDraft(value)
            setEditing(true)
          }}
        >
          Renombrar
        </button>
      </div>
    )
  }

  const save = () => {
    const v = draft.trim()
    if (v) onSave(v)
    setEditing(false)
  }

  return (
    <form
      className="title-row"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <input className="input input-title" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={save} aria-label="Nuevo nombre" />
    </form>
  )
}

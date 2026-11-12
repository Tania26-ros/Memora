import { Fragment, useState } from 'react'

// Fuente de un material: de dónde salió (autor, libro, canal, enlace…),
// para dar crédito a quien lo creó. Si no hay fuente no ocupa espacio:
// solo aparece el botón «Agregar fuente».
const URL_RE = /(https?:\/\/[^\s<>"']+)/g

function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_RE).map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noreferrer noopener">
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}

export default function SourceCredit({ source, onSave, compact = false }: { source?: string; onSave: (source: string | undefined) => void; compact?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null)

  if (draft !== null) {
    return (
      <form
        className="source-form"
        onSubmit={(e) => {
          e.preventDefault()
          onSave(draft.trim().slice(0, 500) || undefined)
          setDraft(null)
        }}
      >
        <label className="field">
          <span>Fuente</span>
          <textarea
            className="input"
            rows={2}
            maxLength={500}
            autoFocus
            value={draft}
            placeholder="Ej.: Canción «Imagine», John Lennon (1971) · youtube.com/…"
            onChange={(e) => setDraft(e.target.value)}
          />
        </label>
        <p className="muted">Escribe de dónde sacaste este material: autor, libro, página, canal o enlace.</p>
        <div className="chips">
          <button className="btn btn-small">Guardar fuente</button>
          <button type="button" className="btn btn-small btn-ghost" onClick={() => setDraft(null)}>
            Cancelar
          </button>
          {source && (
            <button
              type="button"
              className="btn btn-small btn-ghost"
              onClick={() => {
                onSave(undefined)
                setDraft(null)
              }}
            >
              Quitar fuente
            </button>
          )}
        </div>
      </form>
    )
  }

  if (!source) {
    return (
      <button type="button" className={`btn btn-small btn-ghost add-source ${compact ? 'add-source-compact' : ''}`} onClick={() => setDraft('')}>
        ＋ Agregar fuente
      </button>
    )
  }

  return (
    <figure className={`source-credit ${compact ? 'source-compact' : ''}`}>
      <figcaption>
        <strong>📚 Fuente:</strong> <Linkified text={source} />
      </figcaption>
      <button type="button" className="btn-link source-edit" aria-label="Editar fuente" onClick={() => setDraft(source)}>
        Editar
      </button>
    </figure>
  )
}

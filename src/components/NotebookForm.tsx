import { useState } from 'react'
import { NOTEBOOK_COLORS, NOTEBOOK_EMOJIS, type Notebook } from '../lib/db'
import EmojiPicker from './EmojiPicker'

type Values = Pick<Notebook, 'name' | 'emoji' | 'color'>

// Formulario de cuaderno: nombre, ícono y color.
// Se usa igual para crear uno nuevo y para editar uno existente.
export default function NotebookForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  idPrefix,
}: {
  initial?: Values
  submitLabel: string
  onSubmit: (v: Values) => Promise<unknown> | void
  onCancel?: () => void
  idPrefix: string
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? NOTEBOOK_EMOJIS[0])
  const [color, setColor] = useState(initial?.color ?? NOTEBOOK_COLORS[0])
  const [showAll, setShowAll] = useState(false)

  // Si el ícono elegido no está entre los rápidos, lo mostramos primero.
  const quick = NOTEBOOK_EMOJIS.includes(emoji) ? NOTEBOOK_EMOJIS : [emoji, ...NOTEBOOK_EMOJIS.slice(0, -1)]
  const customColor = !NOTEBOOK_COLORS.includes(color)

  return (
    <form
      className="notebook-form"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        await onSubmit({ name, emoji, color })
        if (!initial) setName('')
        setShowAll(false)
      }}
    >
      <div className="preview" style={{ '--nb': color } as React.CSSProperties} aria-hidden>
        <span className="notebook-emoji">{emoji}</span>
        <span className="notebook-name">{name.trim() || 'Nombre del cuaderno'}</span>
      </div>

      <label className="field" htmlFor={`${idPrefix}-name`}>
        <span>Nombre</span>
        <input
          id={`${idPrefix}-name`}
          className="input"
          placeholder="Ej.: Biología, Inglés B2, Derecho civil"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <div className="field">
        <span>Ícono</span>
        <div className="picker" role="radiogroup" aria-label="Ícono">
          {quick.map((em) => (
            <button type="button" key={em} role="radio" aria-checked={em === emoji} className={`chip ${em === emoji ? 'chip-on' : ''}`} onClick={() => setEmoji(em)}>
              {em}
            </button>
          ))}
          <button type="button" className="btn btn-small btn-ghost" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Cerrar' : 'Más íconos'}
          </button>
        </div>
        {showAll && (
          <EmojiPicker
            onPick={(em) => {
              setEmoji(em)
              setShowAll(false)
            }}
          />
        )}
      </div>

      <div className="field">
        <span>Color</span>
        <div className="picker" role="radiogroup" aria-label="Color">
          {NOTEBOOK_COLORS.map((c) => (
            <button type="button" key={c} role="radio" aria-checked={c === color} aria-label={`Color ${c}`} className={`swatch ${c === color ? 'swatch-on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
          <label className={`swatch swatch-custom ${customColor ? 'swatch-on' : ''}`} style={customColor ? { background: color } : undefined} title="Otro color">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Elegir otro color" />
            {!customColor && <span aria-hidden>+</span>}
          </label>
        </div>
      </div>

      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button className="btn" disabled={!name.trim()}>
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

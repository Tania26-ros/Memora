import { MAX_SECONDS, formatDuration, joinDuration, splitDuration } from '../lib/duration'

// Elegir un tiempo exacto: horas, minutos y segundos (de 1 s a 23 h 59 min 59 s).
// value = 0 significa «sin tiempo» (solo si allowNone).
const QUICK = [10, 30, 60, 300, 1800, 3600]

export default function DurationPicker({
  id,
  label,
  value,
  onChange,
  allowNone = true,
  quick = QUICK,
}: {
  id: string
  label: string
  value: number
  onChange: (seconds: number) => void
  allowNone?: boolean
  quick?: number[]
}) {
  const off = allowNone && value <= 0
  const { h, m, s } = splitDuration(off ? 0 : value)
  const set = (part: 'h' | 'm' | 's', raw: string) => {
    const max = part === 'h' ? 23 : 59
    const n = Math.min(max, Math.max(0, Math.floor(Number(raw) || 0)))
    const next = { h, m, s, [part]: n }
    const total = Math.min(MAX_SECONDS, joinDuration(next.h, next.m, next.s))
    onChange(total > 0 ? total : allowNone ? 0 : 1)
  }
  return (
    <fieldset className="duration" id={id}>
      <legend>
        {label}: <strong>{formatDuration(value)}</strong>
      </legend>
      {allowNone && (
        <label className="check">
          <input type="checkbox" checked={!off} onChange={(e) => onChange(e.target.checked ? 30 : 0)} />
          Con tiempo
        </label>
      )}
      {!off && (
        <>
          <div className="duration-fields">
            {(
              [
                ['h', h, 'h', 23],
                ['m', m, 'min', 59],
                ['s', s, 's', 59],
              ] as const
            ).map(([part, v, unit, max]) => (
              <label key={part} className="duration-field">
                <input className="input" type="number" inputMode="numeric" min={0} max={max} value={v} aria-label={`${label}: ${unit === 'h' ? 'horas' : unit === 'min' ? 'minutos' : 'segundos'}`} onChange={(e) => set(part, e.target.value)} onFocus={(e) => e.target.select()} />
                <span>{unit}</span>
              </label>
            ))}
          </div>
          <div className="chips">
            {quick.map((q) => (
              <button key={q} type="button" className="btn btn-small btn-ghost" aria-pressed={value === q} onClick={() => onChange(q)}>
                {formatDuration(q)}
              </button>
            ))}
          </div>
        </>
      )}
    </fieldset>
  )
}

import { useMemo, useState } from 'react'
import {
  LETTERS, checkCloze, checkMatch, clozeSegments, shuffle,
  type ClozeQuestion, type MatchQuestion, type McqQuestion, type OpenQuestion, type Question, type TfQuestion,
} from '../../lib/questions'

// Un componente por tipo de pregunta. Todos reciben lo mismo:
//  - q: la pregunta
//  - answered: si ya se respondió (o se acabó el tiempo): entonces se muestra la solución
//  - onAnswer(correcta): avisa al juego del resultado
interface Props<Q> {
  q: Q
  answered: boolean
  mix: boolean
  onAnswer: (correct: boolean) => void
}

export default function Player({ q, ...rest }: Omit<Props<Question>, 'q'> & { q: Question }) {
  switch (q.type) {
    case 'mcq':
      return <McqPlayer q={q} {...rest} />
    case 'tf':
      return <TfPlayer q={q} {...rest} />
    case 'match':
      return <MatchPlayer q={q} {...rest} />
    case 'cloze':
      return <ClozePlayer q={q} {...rest} />
    case 'open':
      return <OpenPlayer q={q} {...rest} />
  }
}

function McqPlayer({ q, answered, mix, onAnswer }: Props<McqQuestion>) {
  // Orden de las alternativas: como en el archivo, o mezcladas si así se eligió.
  const order = useMemo(() => (mix ? shuffle(q.options.map((_, i) => i)) : q.options.map((_, i) => i)), [q, mix])
  const [picked, setPicked] = useState<number | null>(null)
  const [struck, setStruck] = useState<Set<number>>(new Set())

  return (
    <div className="options" role="group" aria-label="Alternativas">
      {order.map((optIndex, pos) => {
        const isCorrect = optIndex === q.correct
        const state = answered ? (isCorrect ? 'opt-correct' : picked === optIndex ? 'opt-wrong' : 'opt-dim') : ''
        const isStruck = struck.has(optIndex) && !answered
        return (
          <div key={optIndex} className={`opt ${state} ${isStruck ? 'opt-struck' : ''}`}>
            <button
              className="opt-main"
              disabled={answered}
              onClick={() => {
                setPicked(optIndex)
                onAnswer(isCorrect)
              }}
            >
              <span className="letter">{LETTERS[pos]}</span>
              <span className="opt-text">{q.options[optIndex]}</span>
            </button>
            {!answered && (
              // Descartar: tacha la alternativa que crees incorrecta, como en un examen en papel.
              <button
                className="opt-strike"
                aria-label={isStruck ? `Recuperar alternativa ${LETTERS[pos]}` : `Descartar alternativa ${LETTERS[pos]}`}
                aria-pressed={isStruck}
                onClick={() => setStruck((s) => new Set(s.has(optIndex) ? [...s].filter((x) => x !== optIndex) : [...s, optIndex]))}
              >
                ✕
              </button>
            )}
          </div>
        )
      })}
      {!answered && <p className="muted hint">Toca ✕ para descartar las alternativas que sabes que no son.</p>}
    </div>
  )
}

function TfPlayer({ q, answered, onAnswer }: Props<TfQuestion>) {
  const [picked, setPicked] = useState<boolean | null>(null)
  return (
    <div className="tf-row">
      {[true, false].map((v) => {
        const state = answered ? (v === q.correct ? 'opt-correct' : picked === v ? 'opt-wrong' : 'opt-dim') : ''
        return (
          <button
            key={String(v)}
            className={`opt opt-main tf-btn ${state}`}
            disabled={answered}
            onClick={() => {
              setPicked(v)
              onAnswer(v === q.correct)
            }}
          >
            {v ? 'Verdadero' : 'Falso'}
          </button>
        )
      })}
    </div>
  )
}

function MatchPlayer({ q, answered, onAnswer }: Props<MatchQuestion>) {
  // La columna derecha siempre se mezcla (si no, la respuesta sería obvia).
  const rightOrder = useMemo(() => {
    let o = shuffle(q.pairs.map((_, i) => i))
    if (o.every((v, i) => v === i) && o.length > 1) o = [...o.slice(1), o[0]]
    return o
  }, [q])
  const [selLeft, setSelLeft] = useState<number | null>(null)
  const [links, setLinks] = useState<(number | null)[]>(() => q.pairs.map(() => null))

  const link = (right: number) => {
    if (selLeft === null || answered) return
    const next = links.map((r) => (r === right ? null : r))
    next[selLeft] = right
    setLinks(next)
    setSelLeft(next.findIndex((r) => r === null) === -1 ? null : next.findIndex((r) => r === null))
    if (next.every((r) => r !== null)) onAnswer(checkMatch(q, next as number[]))
  }

  const colorOf = (left: number) => `hsl(${(left * 67) % 360} 70% 55%)`

  return (
    <div>
      <p className="muted hint">Toca un concepto de la izquierda y luego su pareja de la derecha.</p>
      <div className="match">
        <div className="match-col">
          {q.pairs.map((p, i) => {
            const state = answered ? (links[i] === i ? 'opt-correct' : 'opt-wrong') : ''
            return (
              <button key={i} className={`opt opt-main match-item ${selLeft === i ? 'match-sel' : ''} ${state}`} disabled={answered} onClick={() => setSelLeft(i)} style={links[i] !== null && !answered ? { borderColor: colorOf(i) } : undefined}>
                {p.left}
              </button>
            )
          })}
        </div>
        <div className="match-col">
          {rightOrder.map((r) => {
            const owner = links.indexOf(r)
            return (
              <button key={r} className="opt opt-main match-item" disabled={answered} onClick={() => link(r)} style={owner !== -1 && !answered ? { borderColor: colorOf(owner) } : undefined}>
                {q.pairs[r].right}
              </button>
            )
          })}
        </div>
      </div>
      {answered && (
        <ul className="match-solution">
          {q.pairs.map((p, i) => (
            <li key={i}>
              {p.left} → <strong>{p.right}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ClozePlayer({ q, answered, onAnswer }: Props<ClozeQuestion>) {
  const options = useMemo(() => q.blanks.map((b) => shuffle([b.answer, ...b.distractors])), [q])
  const [picked, setPicked] = useState<(string | null)[]>(() => q.blanks.map(() => null))
  const [active, setActive] = useState(0)

  const choose = (word: string) => {
    if (answered) return
    const next = [...picked]
    next[active] = word
    setPicked(next)
    const empty = next.findIndex((p) => p === null)
    if (empty === -1) onAnswer(checkCloze(q, next as string[]))
    else setActive(empty)
  }

  return (
    <div>
      <p className="cloze-text">
        {clozeSegments(q.text).map((s, i) =>
          s.kind === 'text' ? (
            <span key={i}>{s.value}</span>
          ) : (
            <button
              key={i}
              className={`blank ${active === s.index && !answered ? 'blank-active' : ''} ${answered ? (picked[s.index] && picked[s.index]!.toLowerCase() === q.blanks[s.index].answer.toLowerCase() ? 'blank-ok' : 'blank-bad') : ''}`}
              disabled={answered}
              onClick={() => setActive(s.index)}
              aria-label={`Espacio ${s.index + 1}`}
            >
              {answered ? q.blanks[s.index].answer : (picked[s.index] ?? `(${s.index + 1})`)}
            </button>
          ),
        )}
      </p>
      {!answered && (
        <div className="options" role="group" aria-label={`Alternativas para el espacio ${active + 1}`}>
          <p className="muted hint">Espacio {active + 1} de {q.blanks.length}:</p>
          {options[active].map((w, i) => (
            <button key={w} className="opt opt-main" onClick={() => choose(w)}>
              <span className="letter">{LETTERS[i]}</span>
              <span className="opt-text">{w}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function OpenPlayer({ q, answered, onAnswer }: Props<OpenQuestion>) {
  const [draft, setDraft] = useState('')
  const [revealed, setRevealed] = useState(false)
  const show = revealed || answered
  return (
    <div className="open">
      <textarea className="input textarea" rows={3} placeholder="Escribe tu respuesta (opcional) y luego compárala" value={draft} onChange={(e) => setDraft(e.target.value)} disabled={answered} aria-label="Tu respuesta" />
      {!show ? (
        <button className="btn" onClick={() => setRevealed(true)}>
          Ver respuesta
        </button>
      ) : (
        <>
          <div className="open-answer">
            <span className="muted">Respuesta:</span> {q.answer}
          </div>
          {!answered && (
            <div className="tf-row">
              <button className="opt opt-main tf-btn" onClick={() => onAnswer(true)}>
                La sabía
              </button>
              <button className="opt opt-main tf-btn" onClick={() => onAnswer(false)}>
                No la sabía
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { db } from '../lib/db'
import {
  DIFFICULTIES, LETTERS, QUESTION_TYPES, clozeToDraft, nowMs, parseClozeDraft, validateQuestion,
  type Difficulty, type NewQuestion, type Question, type QuestionType,
} from '../lib/questions'

// Ventana para escribir o editar una pregunta a mano.
// Cada tipo de pregunta tiene sus propios campos.
export default function QuestionEditor({ topicId, question, onClose }: { topicId: number; question?: Question; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal()
  }, [])

  const [type, setType] = useState<QuestionType>(question?.type ?? 'mcq')
  const [prompt, setPrompt] = useState(question && 'prompt' in question ? question.prompt : '')
  const [difficulty, setDifficulty] = useState<Difficulty>(question?.difficulty ?? 'regular')
  const [explanation, setExplanation] = useState(question?.explanation ?? '')
  // Campos de cada tipo
  const [options, setOptions] = useState<string[]>(question?.type === 'mcq' ? question.options : ['', '', '', ''])
  const [correct, setCorrect] = useState(question?.type === 'mcq' ? question.correct : 0)
  const [tf, setTf] = useState(question?.type === 'tf' ? question.correct : true)
  const [pairs, setPairs] = useState(question?.type === 'match' ? question.pairs : [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }])
  const [answer, setAnswer] = useState(question?.type === 'open' ? question.answer : '')
  const [clozeDraft, setClozeDraft] = useState(question?.type === 'cloze' ? clozeToDraft(question) : '')
  const [distractors, setDistractors] = useState<string[]>(question?.type === 'cloze' ? question.blanks.map((b) => b.distractors.join(', ')) : [])
  const [error, setError] = useState<string | null>(null)

  const cloze = parseClozeDraft(clozeDraft)

  const build = (): NewQuestion => {
    const common = { topicId, difficulty, explanation: explanation.trim() || undefined, starred: question?.starred, createdAt: question?.createdAt ?? 0 }
    switch (type) {
      case 'mcq': {
        // Quitamos alternativas vacías y ajustamos la posición de la correcta.
        const kept = options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o)
        return { ...common, type, prompt: prompt.trim(), options: kept.map((x) => x.o), correct: Math.max(0, kept.findIndex((x) => x.i === correct)) }
      }
      case 'tf':
        return { ...common, type, prompt: prompt.trim(), correct: tf }
      case 'match':
        return { ...common, type, prompt: prompt.trim() || 'Une cada concepto con su pareja', pairs: pairs.map((p) => ({ left: p.left.trim(), right: p.right.trim() })).filter((p) => p.left && p.right) }
      case 'open':
        return { ...common, type, prompt: prompt.trim(), answer: answer.trim() }
      case 'cloze':
        return {
          ...common,
          type,
          prompt: prompt.trim() || 'Completa los espacios',
          text: cloze.text,
          blanks: cloze.answers.map((a, i) => ({ answer: a, distractors: (distractors[i] ?? '').split(',').map((d) => d.trim()).filter(Boolean) })),
        }
    }
  }

  const save = async () => {
    const q = build()
    if (!question) q.createdAt = nowMs()
    const problem = validateQuestion(q)
    if (problem) return setError(problem)
    if (question) await db.questions.put({ ...q, id: question.id } as Question)
    else await db.questions.add(q as Question)
    ref.current?.close()
  }

  return (
    <dialog ref={ref} className="dialog dialog-wide" onClose={onClose} aria-labelledby="q-editor-title">
      <h2 id="q-editor-title">{question ? 'Editar pregunta' : 'Nueva pregunta'}</h2>
      <form
        className="q-form"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        {!question && (
          <div className="field">
            <span>Tipo</span>
            <div className="seg" role="radiogroup" aria-label="Tipo de pregunta">
              {QUESTION_TYPES.map((t) => (
                <button type="button" key={t.value} role="radio" aria-checked={type === t.value} className={`seg-btn ${type === t.value ? 'seg-on' : ''}`} onClick={() => setType(t.value)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {type !== 'cloze' && (
          <label className="field" htmlFor="q-prompt">
            <span>{type === 'tf' ? 'Afirmación' : type === 'match' ? 'Instrucción (opcional)' : 'Pregunta'}</span>
            <textarea id="q-prompt" className="input textarea" rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={type === 'tf' ? 'Ej.: La mitocondria produce ATP.' : 'Ej.: ¿Qué orgánulo produce energía?'} />
          </label>
        )}

        {type === 'mcq' && (
          <fieldset className="field plain">
            <legend>Alternativas (toca la letra de la correcta)</legend>
            {options.map((o, i) => (
              <div key={i} className="opt-row">
                <button type="button" className={`letter ${correct === i ? 'letter-on' : ''}`} aria-label={`Marcar ${LETTERS[i]} como correcta`} aria-pressed={correct === i} onClick={() => setCorrect(i)}>
                  {LETTERS[i]}
                </button>
                <input className="input" value={o} placeholder={`Alternativa ${LETTERS[i]}`} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Alternativa ${LETTERS[i]}`} />
              </div>
            ))}
            {options.length < 6 && (
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setOptions([...options, ''])}>
                + Alternativa
              </button>
            )}
          </fieldset>
        )}

        {type === 'tf' && (
          <div className="field">
            <span>Respuesta correcta</span>
            <div className="seg" role="radiogroup">
              {[true, false].map((v) => (
                <button type="button" key={String(v)} role="radio" aria-checked={tf === v} className={`seg-btn ${tf === v ? 'seg-on' : ''}`} onClick={() => setTf(v)}>
                  {v ? 'Verdadero' : 'Falso'}
                </button>
              ))}
            </div>
          </div>
        )}

        {type === 'match' && (
          <fieldset className="field plain">
            <legend>Parejas</legend>
            {pairs.map((p, i) => (
              <div key={i} className="pair-row">
                <input className="input" value={p.left} placeholder="Concepto" aria-label={`Concepto ${i + 1}`} onChange={(e) => setPairs(pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)))} />
                <span aria-hidden>↔</span>
                <input className="input" value={p.right} placeholder="Pareja" aria-label={`Pareja ${i + 1}`} onChange={(e) => setPairs(pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)))} />
              </div>
            ))}
            {pairs.length < 8 && (
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setPairs([...pairs, { left: '', right: '' }])}>
                + Pareja
              </button>
            )}
          </fieldset>
        )}

        {type === 'open' && (
          <label className="field" htmlFor="q-answer">
            <span>Respuesta esperada</span>
            <textarea id="q-answer" className="input textarea" rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} />
          </label>
        )}

        {type === 'cloze' && (
          <>
            <label className="field" htmlFor="q-cloze">
              <span>Párrafo: pon entre [corchetes] las palabras que serán espacios (de 1 a 3)</span>
              <textarea id="q-cloze" className="input textarea" rows={4} value={clozeDraft} onChange={(e) => setClozeDraft(e.target.value)} placeholder="La [mitocondria] es el orgánulo que produce [ATP] mediante la respiración celular." />
            </label>
            {cloze.answers.map((a, i) => (
              <label key={i} className="field" htmlFor={`q-dist-${i}`}>
                <span>
                  Espacio {i + 1}: «{a}». Alternativas incorrectas, separadas por comas
                </span>
                <input id={`q-dist-${i}`} className="input" value={distractors[i] ?? ''} placeholder="Ej.: ribosoma, núcleo, lisosoma" onChange={(e) => setDistractors(Object.assign([...distractors], { [i]: e.target.value }))} />
              </label>
            ))}
          </>
        )}

        <div className="field">
          <span>Dificultad</span>
          <div className="seg" role="radiogroup">
            {DIFFICULTIES.map((d) => (
              <button type="button" key={d.value} role="radio" aria-checked={difficulty === d.value} className={`seg-btn diff-${d.value} ${difficulty === d.value ? 'seg-on' : ''}`} onClick={() => setDifficulty(d.value)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <label className="field" htmlFor="q-expl">
          <span>Explicación (opcional): por qué es la correcta y por qué las otras no</span>
          <textarea id="q-expl" className="input textarea" rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>
            Cancelar
          </button>
          <button className="btn">{question ? 'Guardar' : 'Añadir pregunta'}</button>
        </div>
      </form>
    </dialog>
  )
}

import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { db } from '../lib/db'
import { parseQuestionsText } from '../lib/importText'
import { DIFFICULTIES, QUESTION_TYPES, correctAnswerText, nowMs, type Difficulty, type Question } from '../lib/questions'

const EXAMPLE = `1. ¿Qué orgánulo produce energía?
a) Ribosoma
b) Mitocondria
c) Núcleo
Respuesta: b
Explicación: La mitocondria hace la respiración celular.
Pista: Es la «central de energía».

2. Las células vegetales tienen pared celular. (V)

3. ¿Qué es la célula?
Respuesta: La unidad básica de la vida.`

// Pegado inteligente: el estudiante pega un cuestionario copiado de un PDF,
// Word o página web y Memora lo convierte en preguntas, sin IA.
export default function ImportPage() {
  const topicId = Number(useParams().topicId)
  const topic = useLiveQuery(() => db.topics.get(topicId), [topicId])
  // Archivos de texto del tema: se pueden usar directamente sin copiar y pegar.
  const textFiles = useLiveQuery(async () => (await db.files.where('topicId').equals(topicId).toArray()).filter((f) => f.mimeType.startsWith('text/') || /\.(txt|md)$/i.test(f.name)), [topicId])

  const [text, setText] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('regular')
  // Índices que el estudiante cambió respecto a la marca por defecto.
  const [toggled, setToggled] = useState<Set<number>>(new Set())
  const [notice, setNotice] = useState<string | null>(null)
  const [saved, setSaved] = useState<number | null>(null)

  const parsed = useMemo(() => parseQuestionsText(text, topicId, difficulty), [text, topicId, difficulty])
  const isIncluded = (i: number) => (parsed[i].problem === null) !== toggled.has(i)
  const chosen = parsed.filter((_, i) => isIncluded(i))
  const problems = parsed.filter((p) => p.problem).length

  const changeText = (v: string) => {
    setText(v)
    setToggled(new Set())
    setSaved(null)
  }

  const pasteFromClipboard = async () => {
    try {
      const v = await navigator.clipboard.readText()
      if (!v.trim()) return setNotice('El portapapeles está vacío. Copia primero el texto del examen o cuestionario.')
      changeText(v)
      setNotice(null)
    } catch {
      // Algunos navegadores no dejan leer el portapapeles: la alternativa siempre funciona.
      setNotice('Tu navegador no deja leer el portapapeles. Mantén pulsado el cuadro de abajo y elige «Pegar».')
    }
  }

  const save = async () => {
    const t = nowMs()
    await db.questions.bulkAdd(chosen.map((p, i) => ({ ...p.question, createdAt: t + i }) as Question))
    setSaved(chosen.length)
    setText('')
    setToggled(new Set())
  }

  if (!topic) return null

  return (
    <section>
      <nav className="crumbs">
        <Link to={`/tema/${topicId}`}>← {topic.name}</Link>
      </nav>
      <h1 className="page-title">Pegar preguntas</h1>
      <p className="lead">Copia un examen, práctica o cuestionario (de un PDF, Word, web o tus apuntes) y pégalo aquí. Memora reconoce las preguntas, alternativas y respuestas.</p>

      {saved !== null && (
        <div className="card form-ok-card" role="status">
          <p className="form-ok">✓ Se guardaron {saved} {saved === 1 ? 'pregunta' : 'preguntas'}.</p>
          <div className="card-actions">
            <Link className="btn" to={`/tema/${topicId}/jugar`}>
              Jugar ahora
            </Link>
            <Link className="btn btn-ghost" to={`/tema/${topicId}/preguntas`}>
              Ver y editar preguntas
            </Link>
          </div>
        </div>
      )}

      <details className="tip">
        <summary>¿Cómo debe verse el texto?</summary>
        <p>Numera cada pregunta. Las alternativas con letra: a), b)… Indica la correcta con «Respuesta: b», con un * al final de la alternativa o con (V)/(F) en las de verdadero o falso. «Explicación:» y «Pista:» son opcionales.</p>
        <pre>{EXAMPLE}</pre>
        <button className="btn btn-small btn-ghost" onClick={() => changeText(EXAMPLE)}>
          Probar con este ejemplo
        </button>
      </details>
      <details className="tip">
        <summary>¿Cómo copio el texto de un PDF o una foto?</summary>
        <ul>
          <li>PDF en el celular: ábrelo, mantén pulsado sobre el texto, elige «Seleccionar todo» y «Copiar».</li>
          <li>Foto o PDF escaneado: en Android usa Google Lens («Texto» → «Copiar»); en iPhone mantén pulsado el texto de la foto («Texto en vivo»).</li>
          <li>Si el PDF no deja copiar, está protegido o es una imagen: usa el truco de la foto.</li>
        </ul>
      </details>

      <div className="card import-box">
        <div className="card-actions">
          <button className="btn btn-small" onClick={() => void pasteFromClipboard()}>
            📋 Pegar lo copiado
          </button>
          {textFiles?.map((f) => (
            <button key={f.id} className="btn btn-small btn-ghost" onClick={async () => changeText(await f.blob.text())}>
              Usar «{f.name}»
            </button>
          ))}
          {text && (
            <button className="btn btn-small btn-ghost" onClick={() => changeText('')}>
              Borrar texto
            </button>
          )}
        </div>
        {notice && <p className="import-problem">{notice}</p>}
        <label className="field" htmlFor="import-text">
          <span>Texto con preguntas</span>
          <textarea id="import-text" className="input textarea" rows={8} value={text} onChange={(e) => changeText(e.target.value)} placeholder={'1. ¿Pregunta?\na) …\nb) …\nRespuesta: a'} />
        </label>
        <div className="field">
          <span>Dificultad de estas preguntas</span>
          <div className="seg" role="radiogroup" aria-label="Dificultad">
            {DIFFICULTIES.map((d) => (
              <button type="button" key={d.value} role="radio" aria-checked={difficulty === d.value} className={`seg-btn diff-${d.value} ${difficulty === d.value ? 'seg-on' : ''}`} onClick={() => setDifficulty(d.value)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {text.trim() && (
        <>
          <h2>
            Vista previa <span className="muted">({parsed.length})</span>
          </h2>
          {parsed.length === 0 ? (
            <p className="empty">No encontré preguntas. Revisa que cada una empiece con un número («1.», «2)»…) o deja una línea en blanco entre ellas.</p>
          ) : (
            <>
              {problems > 0 && <p className="muted">{problems === 1 ? '1 pregunta necesita' : `${problems} preguntas necesitan`} revisión: corrige el texto de arriba y la vista previa se actualiza sola, o márcalas igual si quieres.</p>}
              <ol className="import-preview">
                {parsed.map((p, i) => (
                  <li key={i} className={`import-item ${p.problem ? 'has-problem' : ''}`}>
                    <input type="checkbox" checked={isIncluded(i)} aria-label={`Incluir pregunta ${i + 1}`} onChange={() => setToggled((s) => new Set(s.has(i) ? [...s].filter((x) => x !== i) : [...s, i]))} />
                    <div>
                      <span className="badge">{QUESTION_TYPES.find((t) => t.value === p.question.type)?.label}</span>
                      <p>
                        <strong>{i + 1}.</strong> {'prompt' in p.question ? p.question.prompt : ''}
                      </p>
                      {p.problem ? <p className="import-problem">⚠ {p.problem}</p> : <p className="muted">Respuesta: {correctAnswerText({ ...p.question, id: 0 } as Question)}</p>}
                      {p.question.hint && <p className="muted">💡 {p.question.hint}</p>}
                    </div>
                  </li>
                ))}
              </ol>
              <button className="btn btn-block" disabled={chosen.length === 0} onClick={() => void save()}>
                Guardar {chosen.length} {chosen.length === 1 ? 'pregunta' : 'preguntas'}
              </button>
            </>
          )}
        </>
      )}
    </section>
  )
}

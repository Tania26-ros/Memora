import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BookContent, { type BookMode } from '../components/BookContent'
import DurationPicker from '../components/DurationPicker'
import { db } from '../lib/db'
import { clock } from '../lib/duration'
import { downloadFile, fileName, wordDocument } from '../lib/document'
import { PAPERS, updateSettings, useSettings } from '../lib/settings'


// Lector tipo libro: todo el tema para leer cómodo (letra grande, color de papel),
// con tiempo de estudio opcional, y para descargar en Word o PDF.
export default function ReaderPage() {
  const topicId = Number(useParams().topicId)
  const s = useSettings()
  const topic = useLiveQuery(() => db.topics.get(topicId), [topicId])
  const notebook = useLiveQuery(async () => (topic ? db.notebooks.get(topic.notebookId) : undefined), [topic])
  const questions = useLiveQuery(() => db.questions.where('topicId').equals(topicId).sortBy('createdAt'), [topicId])
  const words = useLiveQuery(() => db.words.where('topicId').equals(topicId).sortBy('createdAt'), [topicId])
  const files = useLiveQuery(async () => (await db.files.where('topicId').equals(topicId).toArray()).filter((f) => f.mimeType.startsWith('text/') || /\.(txt|md)$/i.test(f.name)), [topicId])
  const [texts, setTexts] = useState<{ name: string; text: string }[]>([])
  const [mode, setMode] = useState<BookMode>('respuestas')
  const [include, setInclude] = useState({ questions: true, words: true, texts: true })
  const book = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!files) return
    let alive = true
    void Promise.all(files.map(async (f) => ({ name: f.name.replace(/\.(txt|md)$/i, ''), text: await f.blob.text() }))).then((t) => alive && setTexts(t))
    return () => {
      alive = false
    }
  }, [files])

  if (!topic || !questions || !words) return null
  const paper = PAPERS.find((p) => p.id === s.paper) ?? PAPERS[0]
  const title = topic.name
  const subtitle = [notebook && `${notebook.emoji} ${notebook.name}`, mode === 'examen' ? 'Modo examen' : 'Con respuestas', 'Hecho con Memora'].filter(Boolean).join(' · ')

  const downloadWord = () => {
    if (!book.current) return
    downloadFile(wordDocument(title, book.current.innerHTML), fileName(`${title}${mode === 'examen' ? ' - examen' : ''}`, 'doc'), 'application/msword')
  }

  const empty = questions.length + words.length + texts.length === 0

  return (
    <section className="reader">
      <nav className="crumbs no-print">
        <Link to={`/tema/${topicId}`}>← {topic.name}</Link>
      </nav>

      <div className="card reader-toolbar no-print">
        <div className="reader-row">
          <div className="seg" role="group" aria-label="Tamaño de letra">
            <button className="seg-btn" aria-label="Letra más pequeña" onClick={() => updateSettings({ readerScale: Math.max(0.9, +(s.readerScale - 0.1).toFixed(2)) })}>
              A−
            </button>
            <button className="seg-btn" aria-label="Letra más grande" onClick={() => updateSettings({ readerScale: Math.min(2, +(s.readerScale + 0.1).toFixed(2)) })}>
              A+
            </button>
          </div>
          <div className="seg" role="radiogroup" aria-label="Color del papel">
            {PAPERS.map((p) => (
              <button key={p.id} role="radio" aria-checked={s.paper === p.id} aria-label={`Papel ${p.label}`} title={p.label} className={`paper-dot ${s.paper === p.id ? 'seg-on' : ''}`} style={{ background: p.bg, color: p.fg }} onClick={() => updateSettings({ paper: p.id })}>
                Aa
              </button>
            ))}
          </div>
          <button className="seg-btn" aria-pressed={s.readerSpacing > 1.7} onClick={() => updateSettings({ readerSpacing: s.readerSpacing > 1.7 ? 1.7 : 2.1 })}>
            ↕ Interlineado
          </button>
        </div>
        <div className="reader-row">
          <div className="seg" role="radiogroup" aria-label="Qué mostrar">
            {(
              [
                ['respuestas', 'Con respuestas'],
                ['examen', 'Modo examen'],
              ] as const
            ).map(([v, l]) => (
              <button key={v} role="radio" aria-checked={mode === v} className={`seg-btn ${mode === v ? 'seg-on' : ''}`} onClick={() => setMode(v)}>
                {l}
              </button>
            ))}
          </div>
          <StudyTimer topicId={topicId} />
        </div>
        <div className="chips">
          {(
            [
              ['questions', `Preguntas (${questions.length})`],
              ['words', `Vocabulario (${words.length})`],
              ['texts', `Textos (${texts.length})`],
            ] as const
          ).map(([k, l]) => (
            <label key={k} className="check">
              <input type="checkbox" checked={include[k]} onChange={(e) => setInclude({ ...include, [k]: e.target.checked })} />
              {l}
            </label>
          ))}
        </div>
        <div className="card-actions">
          <button className="btn btn-small" disabled={empty} onClick={downloadWord}>
            ⬇ Descargar Word
          </button>
          <button className="btn btn-small btn-ghost" disabled={empty} onClick={() => window.print()}>
            🖨 Guardar PDF
          </button>
        </div>
        <p className="muted">Para el PDF, en la ventana de imprimir elige «Guardar como PDF».</p>
      </div>

      {empty ? (
        <p className="empty">
          Este tema aún no tiene nada para leer. Añade <Link to={`/tema/${topicId}/pegar`}>preguntas</Link>, <Link to={`/tema/${topicId}/vocabulario`}>vocabulario</Link> o un archivo de texto.
        </p>
      ) : (
        <article ref={book} className="book" style={{ background: paper.bg, color: paper.fg, fontSize: `${s.readerScale}rem`, lineHeight: s.readerSpacing }}>
          <BookContent title={title} subtitle={subtitle} questions={include.questions ? questions : []} words={include.words ? words : []} texts={include.texts ? texts : []} mode={mode} />
        </article>
      )}
    </section>
  )
}

// Tiempo de estudio: cuenta regresiva y aviso al terminar.
function StudyTimer({ topicId }: { topicId: number }) {
  const [open, setOpen] = useState(false)
  const [seconds, setSeconds] = useState(20 * 60)
  const [endAt, setEndAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!endAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [endAt])

  const left = endAt ? Math.max(0, Math.ceil((endAt - now) / 1000)) : 0
  const over = !!endAt && left === 0

  return (
    <div className="study-timer">
      {!endAt ? (
        open ? (
          <div className="card study-timer-setup">
            <DurationPicker id="study-time" label="Tiempo de estudio" value={seconds} onChange={setSeconds} allowNone={false} quick={[300, 600, 1200, 1800, 3600, 7200]} />
            <div className="card-actions">
              <button
                className="btn btn-small"
                onClick={() => {
                  setNow(Date.now())
                  setEndAt(Date.now() + seconds * 1000)
                  setOpen(false)
                }}
              >
                Empezar
              </button>
              <button className="btn btn-small btn-ghost" onClick={() => setOpen(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-small btn-ghost" onClick={() => setOpen(true)}>
            ⏱ Tiempo de estudio
          </button>
        )
      ) : (
        <span className={`timer-pill ${left <= 30 ? 'timer-warn' : ''}`} role="timer" aria-live={left <= 30 ? 'polite' : 'off'}>
          ⏱ {clock(left)}
          <button className="btn btn-small btn-ghost" onClick={() => setEndAt(null)}>
            Quitar
          </button>
        </span>
      )}
      {over && (
        <div className="feedback feedback-ok" role="alert">
          <strong>⏰ Se acabó el tiempo de estudio</strong>
          <p>¡Ahora ponte a prueba con lo que leíste!</p>
          <Link className="btn btn-block" to={`/tema/${topicId}/jugar`}>
            Ir a jugar
          </Link>
          <button className="btn btn-block btn-ghost" onClick={() => setEndAt(null)}>
            Seguir leyendo
          </button>
        </div>
      )}
    </div>
  )
}

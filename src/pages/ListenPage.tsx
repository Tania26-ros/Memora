import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { db } from '../lib/db'
import { correctAnswerText } from '../lib/questions'
import { VOICE_RATES, updateSettings, useSettings } from '../lib/settings'
import { canSpeak, stopSpeaking } from '../lib/speech'
import { questionSpeech, say } from '../lib/voice'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
type Stage = 'pregunta' | 'pensar' | 'respuesta'

// Modo escuchar: Memora lee cada pregunta, te da unos segundos para pensar
// y luego lee la respuesta. Ideal para repasar en el carro o caminando.
export default function ListenPage() {
  const topicId = Number(useParams().topicId)
  const s = useSettings()
  const topic = useLiveQuery(() => db.topics.get(topicId), [topicId])
  const questions = useLiveQuery(() => db.questions.where('topicId').equals(topicId).sortBy('createdAt'), [topicId])
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [stage, setStage] = useState<Stage>('pregunta')
  const [think, setThink] = useState(4)
  const [loop, setLoop] = useState(false)

  const q = questions?.[idx]
  const n = questions?.length ?? 0

  useEffect(() => {
    if (!playing || !q) return
    let cancelled = false
    const run = async () => {
      await wait(0)
      if (cancelled) return
      setStage('pregunta')
      await say(`Pregunta ${idx + 1}. ${questionSpeech(q)}`)
      if (cancelled) return
      setStage('pensar')
      await wait(think * 1000)
      if (cancelled) return
      setStage('respuesta')
      await say(`Respuesta: ${correctAnswerText(q)}. ${q.explanation ?? ''}`)
      await wait(1200)
      if (cancelled) return
      if (idx + 1 < n) setIdx(idx + 1)
      else if (loop) setIdx(0)
      else setPlaying(false)
    }
    void run()
    return () => {
      cancelled = true
      stopSpeaking()
    }
  }, [playing, idx, q, n, think, loop])

  if (!topic || !questions) return null

  const go = (i: number) => {
    stopSpeaking()
    setStage('pregunta')
    setIdx(Math.max(0, Math.min(n - 1, i)))
  }

  return (
    <section>
      <nav className="crumbs">
        <Link to={`/tema/${topicId}`}>← {topic.name}</Link>
      </nav>
      <h1 className="page-title">🎧 Modo escuchar</h1>
      <p className="lead">Memora lee cada pregunta, te deja pensar y luego dice la respuesta. Úsalo con audífonos en el carro, el bus o caminando.</p>

      {!canSpeak() ? (
        <p className="empty">Este navegador no puede leer en voz alta. Abre Memora en Chrome (Android) o Safari (iPhone).</p>
      ) : n === 0 ? (
        <p className="empty">
          Este tema todavía no tiene preguntas. <Link to={`/tema/${topicId}/pegar`}>Pega o escribe algunas</Link> y vuelve.
        </p>
      ) : (
        <>
          <div className="card listen-card" aria-live="polite">
            <span className="listen-stage">
              {idx + 1} de {n} · {stage === 'pregunta' ? 'Pregunta' : stage === 'pensar' ? 'Piensa tu respuesta…' : 'Respuesta'}
            </span>
            <p className="listen-text">{q && (q.type === 'cloze' ? q.text.replace(/\[\[\d+\]\]/g, '____') : q.prompt)}</p>
            {stage === 'respuesta' && q && <p className="listen-answer">{correctAnswerText(q)}</p>}
            <div className="listen-controls">
              <button className="btn btn-ghost" aria-label="Anterior" onClick={() => go(idx - 1)} disabled={idx === 0}>
                ⏮
              </button>
              <button className="btn" aria-label={playing ? 'Pausar' : 'Reproducir'} onClick={() => setPlaying(!playing)}>
                {playing ? '⏸' : '▶'}
              </button>
              <button className="btn btn-ghost" aria-label="Siguiente" onClick={() => go(idx + 1)} disabled={idx >= n - 1}>
                ⏭
              </button>
            </div>
          </div>

          <div className="card setup-block">
            <div className="setup-grid">
              <label className="field" htmlFor="think">
                <span>Tiempo para pensar</span>
                <select id="think" className="input" value={think} onChange={(e) => setThink(Number(e.target.value))}>
                  {[2, 4, 6, 10, 15].map((t) => (
                    <option key={t} value={t}>
                      {t} segundos
                    </option>
                  ))}
                </select>
              </label>
              <div className="field">
                <span>Velocidad</span>
                <div className="seg" role="radiogroup" aria-label="Velocidad">
                  {VOICE_RATES.map((r) => (
                    <button key={r.value} type="button" role="radio" aria-checked={s.voiceRate === r.value} className={`seg-btn ${s.voiceRate === r.value ? 'seg-on' : ''}`} onClick={() => updateSettings({ voiceRate: r.value })}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <label className="check">
              <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
              Repetir todo al terminar
            </label>
            <p className="muted">Consejo: deja la pantalla encendida. Algunos celulares detienen la voz cuando se bloquean. El idioma de la voz se cambia en <Link to="/ajustes">Ajustes</Link>.</p>
          </div>
        </>
      )}
    </section>
  )
}

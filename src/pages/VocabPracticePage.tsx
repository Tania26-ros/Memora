import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MicButton, SpeakButton } from '../components/Voice'
import { db, type Word } from '../lib/db'
import { confetti, playCorrect, playWrong, vibrate } from '../lib/effects'
import { recordActivity } from '../lib/progress'
import { LETTERS, shuffle } from '../lib/questions'
import { canListen, canSpeak, gradeAnswer, speak, stopSpeaking, type Grade } from '../lib/speech'
import { say } from '../lib/voice'

type Mode = 'significado' | 'escribir' | 'escuchar' | 'hablar'
const MODES: { value: Mode; label: string; hint: string; needsMeaning?: boolean; available: () => boolean }[] = [
  { value: 'significado', label: '📖 Significado', hint: 'Ves la palabra y eliges qué significa', needsMeaning: true, available: () => true },
  { value: 'escribir', label: '✍️ Escribir', hint: 'Ves el significado y escribes la palabra', needsMeaning: true, available: () => true },
  { value: 'escuchar', label: '👂 Escuchar', hint: 'Oyes la palabra y la escribes', available: canSpeak },
  { value: 'hablar', label: '🗣️ Hablar', hint: 'Lees la palabra y la pronuncias', available: canListen },
]
const POINTS: Record<Grade, number> = { correcto: 10, casi: 5, incorrecto: 1 }
const GRADE_TEXT: Record<Grade, string> = { correcto: '¡Correcto!', casi: '¡Casi! Revisa los detalles', incorrecto: 'Incorrecto' }

// Practicar el vocabulario de un tema de cuatro formas.
export default function VocabPracticePage() {
  const topicId = Number(useParams().topicId)
  const listId = Number(useParams().listId) || null // sin listId: todos los vocabularios del tema
  const topic = useLiveQuery(() => db.topics.get(topicId), [topicId])
  const list = useLiveQuery(async () => (listId ? db.vocabLists.get(listId) : null), [listId])
  const words = useLiveQuery(() => (listId ? db.words.where('listId').equals(listId).toArray() : db.words.where('topicId').equals(topicId).toArray()), [topicId, listId])
  const [mode, setMode] = useState<Mode | null>(null)
  const [round, setRound] = useState<Word[]>([])
  const [i, setI] = useState(0)
  const [grades, setGrades] = useState<Grade[]>([])

  if (!topic || !words) return null

  const usable = (m: Mode) => (MODES.find((x) => x.value === m)?.needsMeaning ? words.filter((w) => w.meaning) : words)
  const start = (m: Mode) => {
    setMode(m)
    setRound(shuffle(usable(m)).slice(0, 10))
    setI(0)
    setGrades([])
  }
  const done = mode && i >= round.length

  return (
    <section className="practice">
      <nav className="crumbs">
        <Link to={listId ? `/tema/${topicId}/vocabulario/${listId}` : `/tema/${topicId}/vocabulario`}>← {list?.name ?? 'Vocabularios'}</Link>
      </nav>
      {!mode && (
        <>
          <h1 className="page-title">Practicar vocabulario</h1>
          <p className="lead">{words.length} palabras. Elige cómo practicar: cada ronda tiene hasta 10.</p>
          <div className="theme-grid">
            {MODES.map((m) => {
              const n = usable(m.value).length
              const ok = m.available() && n >= (m.value === 'significado' ? 2 : 1)
              return (
                <button key={m.value} className="theme-card" disabled={!ok} onClick={() => start(m.value)}>
                  <strong>{m.label}</strong>
                  <small>{m.hint}</small>
                  {!m.available() && <small className="import-problem">Tu navegador no lo permite. Prueba con Chrome o Safari.</small>}
                  {m.available() && !ok && <small className="import-problem">Añade el significado a tus palabras para usar este modo.</small>}
                </button>
              )
            })}
          </div>
        </>
      )}
      {mode && !done && (
        <Exercise
          key={i}
          mode={mode}
          word={round[i]}
          all={words}
          pos={i}
          total={round.length}
          onDone={(g) => {
            setGrades([...grades, g])
            setI(i + 1)
          }}
        />
      )}
      {done && (
        <div className="card results-card">
          <p className="results-big">{Math.round((grades.filter((g) => g === 'correcto').length / grades.length) * 100)}%</p>
          <p>
            ✓ {grades.filter((g) => g === 'correcto').length} correctas · ≈ {grades.filter((g) => g === 'casi').length} casi · ✗ {grades.filter((g) => g === 'incorrecto').length} incorrectas
          </p>
          <p className="results-xp">+{grades.reduce((s, g) => s + POINTS[g], 0)} puntos</p>
          <div className="results-actions">
            <button className="btn btn-block" onClick={() => start(mode)}>
              Otra ronda
            </button>
            <button className="btn btn-block btn-ghost" onClick={() => setMode(null)}>
              Cambiar de modo
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function Exercise({ mode, word, all, pos, total, onDone }: { mode: Mode; word: Word; all: Word[]; pos: number; total: number; onDone: (g: Grade) => void }) {
  const [grade, setGrade] = useState<Grade | null>(null)
  const [typed, setTyped] = useState('')
  const [heard, setHeard] = useState<string | null>(null)
  const choices = useMemo(() => {
    const others = shuffle(all.filter((w) => w.id !== word.id && w.meaning && w.meaning !== word.meaning)).slice(0, 3)
    return shuffle([word, ...others])
  }, [all, word])

  useEffect(() => {
    if (mode === 'escuchar') void say(word.term, word.lang)
    return stopSpeaking
  }, [mode, word])

  const finish = (g: Grade) => {
    setGrade(g)
    void recordActivity(POINTS[g], g !== 'incorrecto')
    if (g === 'incorrecto') {
      playWrong()
      vibrate([40, 60, 40])
    } else {
      playCorrect()
      if (g === 'correcto') confetti(false)
      vibrate(30)
    }
  }

  return (
    <div className="game">
      <div className="game-head">
        <span>
          {pos + 1} de {total}
        </span>
      </div>
      <div className="progress" aria-hidden>
        <div className="progress-fill" style={{ width: `${(pos / total) * 100}%` }} />
      </div>
      <article className="card q-card">
        {mode === 'significado' && (
          <>
            <p className="muted">¿Qué significa?</p>
            <p className="vocab-big" lang={word.lang}>
              {word.term} <SpeakButton text={word.term} lang={word.lang} />
            </p>
            <div className="options">
              {choices.map((c, k) => (
                <button key={c.id} className={`opt opt-main ${grade ? (c.id === word.id ? 'opt-correct' : 'opt-dim') : ''}`} disabled={!!grade} onClick={() => finish(c.id === word.id ? 'correcto' : 'incorrecto')}>
                  <span className="letter">{LETTERS[k]}</span>
                  <span className="opt-text">{c.meaning}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {(mode === 'escribir' || mode === 'escuchar') && (
          <>
            {mode === 'escribir' ? (
              <>
                <p className="muted">Escribe la palabra que significa:</p>
                <p className="vocab-big">{word.meaning}</p>
                {word.hint && <p className="hint-box">💡 {word.hint}</p>}
              </>
            ) : (
              <>
                <p className="muted">Escucha y escribe lo que oyes</p>
                <div className="listen-controls">
                  <button className="btn" onClick={() => void say(word.term, word.lang)}>
                    🔊 Escuchar
                  </button>
                  <button className="btn btn-ghost" onClick={() => (stopSpeaking(), void speak(word.term, word.lang, 0.6))}>
                    🐢 Más lento
                  </button>
                </div>
              </>
            )}
            <form
              className="q-form"
              onSubmit={(e) => {
                e.preventDefault()
                if (!grade && typed.trim()) finish(gradeAnswer(typed, word.term))
              }}
            >
              <input className="input" lang={word.lang} value={typed} onChange={(e) => setTyped(e.target.value)} disabled={!!grade} autoFocus autoCapitalize="off" autoComplete="off" spellCheck={false} aria-label="Tu respuesta" />
              {!grade && <button className="btn btn-block">Comprobar</button>}
            </form>
          </>
        )}
        {mode === 'hablar' && (
          <>
            <p className="muted">Pronuncia esta palabra</p>
            <p className="vocab-big" lang={word.lang}>
              {word.term} <SpeakButton text={word.term} lang={word.lang} label="Escuchar cómo se dice" />
            </p>
            {word.meaning && <p className="muted" style={{ textAlign: 'center' }}>{word.meaning}</p>}
            {!grade && (
              <div className="listen-controls">
                <MicButton
                  lang={word.lang}
                  label="Decirla"
                  onResult={(alts) => {
                    setHeard(alts[0])
                    finish(gradeAnswer(alts, word.term))
                  }}
                />
                <button className="btn btn-small btn-ghost" onClick={() => finish('incorrecto')}>
                  Saltar
                </button>
              </div>
            )}
          </>
        )}
      </article>
      {grade && (
        <div className={`feedback feedback-${grade === 'incorrecto' ? 'fail' : 'ok'}`} role="status">
          <p className={`grade grade-${grade}`}>
            {GRADE_TEXT[grade]} <span className="pts">+{POINTS[grade]}</span>
          </p>
          {heard !== null && <p>Te entendí: «{heard}»</p>}
          {mode !== 'significado' && typed && grade !== 'correcto' && <p>Escribiste: «{typed}»</p>}
          <p>
            <strong lang={word.lang}>{word.term}</strong>
            {word.meaning && ` · ${word.meaning}`}
          </p>
          {word.example && <p className="muted">«{word.example}»</p>}
          <button className="btn btn-block" autoFocus onClick={() => onDone(grade)}>
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}

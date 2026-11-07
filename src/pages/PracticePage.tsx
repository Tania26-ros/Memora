import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Player from '../components/game/Players'
import TimerBar from '../components/game/TimerBar'
import { confetti, playCorrect, playWrong, rain, vibrate } from '../lib/effects'
import { db } from '../lib/db'
import { DIFFICULTIES, QUESTION_TYPES, correctAnswerText, shuffle, type Difficulty, type Question, type QuestionType } from '../lib/questions'
import { answer, currentQid, isFinished, splitDoses, startSession, summary, type Session } from '../lib/session'
import { TIMER_OPTIONS, timerLabel, updateSettings, useSettings } from '../lib/settings'
import { isDue, recordReview, type ReviewState } from '../lib/srs'
import { levelInfo, pointsFor, recordActivity, totalXp } from '../lib/progress'

type Filter = 'todas' | 'nuevas' | 'falladas' | 'estrella' | 'repaso'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'repaso', label: 'Para repasar hoy' },
  { value: 'nuevas', label: 'Nuevas' },
  { value: 'falladas', label: 'Las que fallé' },
  { value: 'estrella', label: 'Con estrella' },
]

function matchesFilter(f: Filter, q: Question, r: ReviewState | undefined) {
  switch (f) {
    case 'todas':
      return true
    case 'nuevas':
      return !r
    case 'falladas':
      return r?.lastResult === 'fail'
    case 'estrella':
      return !!q.starred
    case 'repaso':
      return isDue(r)
  }
}

type Phase = { name: 'setup' } | { name: 'study'; doses: number[][]; dose: number } | { name: 'play'; doses: number[][]; dose: number } | { name: 'results'; doses: number[][]; dose: number; session: Session; xp: number }

// Página de juego: elegir preguntas → (estudiar primero) → jugar por dosis → resultados.
export default function PracticePage() {
  const topicId = Number(useParams().topicId)
  const [params] = useSearchParams()
  const topic = useLiveQuery(() => db.topics.get(topicId), [topicId])
  const questions = useLiveQuery(() => db.questions.where('topicId').equals(topicId).sortBy('createdAt'), [topicId])
  const reviews = useLiveQuery(async () => new Map((await db.reviews.where('topicId').equals(topicId).toArray()).map((r) => [r.questionId, r])), [topicId])
  const [phase, setPhase] = useState<Phase>({ name: 'setup' })

  if (!topic || !questions || !reviews) return null
  const byId = new Map(questions.map((q) => [q.id, q]))

  return (
    <section className="practice">
      <nav className="crumbs">
        <Link to={`/tema/${topicId}`}>← {topic.name}</Link>
      </nav>
      {phase.name === 'setup' && (
        <Setup
          questions={questions}
          reviews={reviews}
          initialFilter={params.get('modo') === 'repaso' ? 'repaso' : 'todas'}
          onStart={(ids, size, studyFirst) => {
            const doses = splitDoses(ids, size)
            setPhase(studyFirst ? { name: 'study', doses, dose: 0 } : { name: 'play', doses, dose: 0 })
          }}
        />
      )}
      {phase.name === 'study' && <Study questions={phase.doses[phase.dose].map((id) => byId.get(id)!).filter(Boolean)} dose={phase.dose} total={phase.doses.length} onPlay={() => setPhase({ ...phase, name: 'play' })} />}
      {phase.name === 'play' && (
        <Game
          key={`${phase.dose}-${phase.doses[phase.dose].join(',')}`}
          ids={phase.doses[phase.dose]}
          byId={byId}
          dose={phase.dose}
          total={phase.doses.length}
          onFinish={(session, xp) => setPhase({ ...phase, name: 'results', session, xp })}
        />
      )}
      {phase.name === 'results' && (
        <Results
          session={phase.session}
          xp={phase.xp}
          byId={byId}
          dose={phase.dose}
          total={phase.doses.length}
          topicId={topicId}
          onNext={() => setPhase({ name: 'study', doses: phase.doses, dose: phase.dose + 1 })}
          onRepeat={(ids) => setPhase({ name: 'play', doses: Object.assign([...phase.doses], { [phase.dose]: ids }), dose: phase.dose })}
          onSetup={() => setPhase({ name: 'setup' })}
        />
      )}
    </section>
  )
}

// ── 1. Elegir qué practicar ──────────────────────────────────
function Setup({
  questions,
  reviews,
  initialFilter,
  onStart,
}: {
  questions: Question[]
  reviews: Map<number, ReviewState>
  initialFilter: Filter
  onStart: (ids: number[], doseSize: number, studyFirst: boolean) => void
}) {
  const s = useSettings()
  const [filter, setFilter] = useState<Filter>(initialFilter)
  const [diffs, setDiffs] = useState<Set<Difficulty>>(new Set(['facil', 'regular', 'dificil']))
  const [types, setTypes] = useState<Set<QuestionType>>(new Set(QUESTION_TYPES.map((t) => t.value)))
  const [manual, setManual] = useState(false)
  const [excluded, setExcluded] = useState<Set<number>>(new Set())

  const filtered = questions.filter((q) => matchesFilter(filter, q, reviews.get(q.id)) && diffs.has(q.difficulty) && types.has(q.type))
  const selected = filtered.filter((q) => !excluded.has(q.id))
  const doseSize = s.doseSize || selected.length || 1
  const doses = Math.ceil(selected.length / doseSize)
  const counts = Object.fromEntries(FILTERS.map((f) => [f.value, questions.filter((q) => matchesFilter(f.value, q, reviews.get(q.id))).length]))

  const toggle = <T,>(set: Set<T>, v: T) => {
    const n = new Set(set)
    if (n.has(v)) n.delete(v)
    else n.add(v)
    return n
  }

  if (questions.length === 0)
    return (
      <div className="empty">
        <p>Este tema todavía no tiene preguntas.</p>
        <Link className="btn" to="../preguntas" relative="path">
          Escribir preguntas
        </Link>
      </div>
    )

  const start = (studyFirst: boolean) => {
    const ids = (s.shuffle ? shuffle(selected) : selected).map((q) => q.id)
    onStart(ids, doseSize, studyFirst)
  }

  return (
    <div className="setup">
      <h1>Jugar</h1>

      <fieldset className="card setup-block">
        <legend>¿Qué preguntas?</legend>
        <div className="chips">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" className={`pill ${filter === f.value ? 'pill-on' : ''}`} aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label} <span className="pill-count">{counts[f.value]}</span>
            </button>
          ))}
        </div>
        <div className="setup-row">
          <span className="setup-label">Dificultad</span>
          <div className="chips">
            {DIFFICULTIES.map((d) => (
              <label key={d.value} className={`check diff-${d.value}`}>
                <input type="checkbox" checked={diffs.has(d.value)} onChange={() => setDiffs(toggle(diffs, d.value))} />
                {d.label}
              </label>
            ))}
          </div>
        </div>
        <div className="setup-row">
          <span className="setup-label">Tipos</span>
          <div className="chips">
            {QUESTION_TYPES.map((t) => (
              <label key={t.value} className="check">
                <input type="checkbox" checked={types.has(t.value)} onChange={() => setTypes(toggle(types, t.value))} />
                {t.label}
              </label>
            ))}
          </div>
        </div>
        <button type="button" className="btn btn-small btn-ghost" aria-expanded={manual} onClick={() => setManual(!manual)}>
          {manual ? 'Ocultar lista' : 'Elegir preguntas a mano'}
        </button>
        {manual && (
          <div className="manual-list">
            <div className="chips">
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setExcluded(new Set())}>
                Marcar todas
              </button>
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setExcluded(new Set(filtered.map((q) => q.id)))}>
                Desmarcar todas
              </button>
            </div>
            {filtered.map((q) => (
              <label key={q.id} className="check check-block">
                <input type="checkbox" checked={!excluded.has(q.id)} onChange={() => setExcluded(toggle(excluded, q.id))} />
                <span>{q.type === 'cloze' ? q.text.replace(/\[\[\d+\]\]/g, '____') : q.prompt}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <fieldset className="card setup-block">
        <legend>¿Cómo jugar?</legend>
        <div className="setup-grid">
          <label className="field" htmlFor="dose">
            <span>Preguntas por dosis</span>
            <select id="dose" className="input" value={s.doseSize} onChange={(e) => updateSettings({ doseSize: Number(e.target.value) })}>
              {[5, 10, 15, 20].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value={0}>Todas juntas</option>
            </select>
          </label>
          <label className="field" htmlFor="repeat">
            <span>Repetir hasta acertar</span>
            <select id="repeat" className="input" value={s.repeatUntil} onChange={(e) => updateSettings({ repeatUntil: Number(e.target.value) })}>
              <option value={1}>1 vez</option>
              <option value={2}>2 veces seguidas</option>
              <option value={3}>3 veces seguidas</option>
            </select>
          </label>
          <label className="field" htmlFor="timer">
            <span>Tiempo por pregunta</span>
            <select id="timer" className="input" value={s.timerOn ? s.timerSeconds : 0} onChange={(e) => (Number(e.target.value) ? updateSettings({ timerOn: true, timerSeconds: Number(e.target.value) }) : updateSettings({ timerOn: false }))}>
              <option value={0}>Sin tiempo</option>
              {TIMER_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {timerLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="field" htmlFor="order">
            <span>Orden</span>
            <select id="order" className="input" value={s.shuffle ? 'mix' : 'file'} onChange={(e) => updateSettings({ shuffle: e.target.value === 'mix' })}>
              <option value="file">Como las escribí</option>
              <option value="mix">Mezclar</option>
            </select>
          </label>
        </div>
        <div className="chips">
          <label className="check">
            <input type="checkbox" checked={s.sound} onChange={(e) => updateSettings({ sound: e.target.checked })} />
            Sonido
          </label>
          <label className="check">
            <input type="checkbox" checked={s.animations} onChange={(e) => updateSettings({ animations: e.target.checked })} />
            Animaciones
          </label>
          <label className="check">
            <input type="checkbox" checked={s.vibration} onChange={(e) => updateSettings({ vibration: e.target.checked })} />
            Vibración
          </label>
          <label className="check">
            <input type="checkbox" checked={s.hints} onChange={(e) => updateSettings({ hints: e.target.checked })} />
            Pistas
          </label>
        </div>
      </fieldset>

      <div className="setup-footer">
        <p>
          <strong>{selected.length}</strong> {selected.length === 1 ? 'pregunta' : 'preguntas'}
          {selected.length > 0 && ` en ${doses} ${doses === 1 ? 'dosis' : 'dosis'}`}
        </p>
        {selected.length === 0 && <p className="muted">Ninguna pregunta cumple los filtros. Prueba con «Todas» o marca más dificultades.</p>}
        <div className="form-actions">
          <button className="btn btn-ghost" disabled={!selected.length} onClick={() => start(true)}>
            Estudiar primero
          </button>
          <button className="btn" disabled={!selected.length} onClick={() => start(false)}>
            Empezar a jugar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 2. Estudiar primero ──────────────────────────────────────
function Study({ questions, dose, total, onPlay }: { questions: Question[]; dose: number; total: number; onPlay: () => void }) {
  return (
    <div>
      <h1>Estudiar primero</h1>
      <p className="lead">
        {total > 1 && `Dosis ${dose + 1} de ${total}. `}Lee cada pregunta con su respuesta. Cuando estés listo, juega.
      </p>
      <ol className="q-list">
        {questions.map((q) => (
          <li key={q.id} className="q-item">
            <p className="q-item-prompt">{q.type === 'cloze' ? q.text.replace(/\[\[(\d+)\]\]/g, (_, i) => `«${q.blanks[Number(i)].answer}»`) : q.prompt}</p>
            <p className="study-answer">✔ {correctAnswerText(q)}</p>
            {q.explanation && <p className="muted">{q.explanation}</p>}
          </li>
        ))}
      </ol>
      <div className="sticky-actions">
        <button className="btn btn-block" onClick={onPlay}>
          Empezar a jugar
        </button>
      </div>
    </div>
  )
}

// ── 3. Jugar ─────────────────────────────────────────────────
function Game({ ids, byId, dose, total, onFinish }: { ids: number[]; byId: Map<number, Question>; dose: number; total: number; onFinish: (s: Session, xp: number) => void }) {
  const s = useSettings()
  const [session, setSession] = useState(() => startSession(ids, s.repeatUntil))
  const [result, setResult] = useState<null | 'ok' | 'fail' | 'timeout'>(null)
  const [round, setRound] = useState(0) // cambia en cada pregunta mostrada, para reiniciar el temporizador
  const [streak, setStreak] = useState(0)
  const [hintRound, setHintRound] = useState(-1) // en qué ronda se pidió la pista
  const [xp, setXp] = useState(0) // puntos ganados en esta dosis
  const [lastPts, setLastPts] = useState(0)

  const qid = currentQid(session)
  const q = qid !== undefined ? byId.get(qid) : undefined
  const learned = session.done.length
  const seenBefore = qid !== undefined && session.items[qid].attempts > 0
  const mix = useMemo(() => s.shuffle, [s.shuffle])

  if (!q) return null

  const respond = (correct: boolean, timeout = false) => {
    if (result) return
    setResult(correct ? 'ok' : timeout ? 'timeout' : 'fail')
    const pts = pointsFor({ difficulty: q.difficulty, correct, retry: seenBefore, hint: hintRound === round, streak: correct ? streak + 1 : 0 })
    setXp(xp + pts)
    setLastPts(pts)
    void recordActivity(pts, correct)
    if (correct) {
      const n = streak + 1
      setStreak(n)
      playCorrect()
      confetti(n >= 5 && n % 5 === 0)
      vibrate(30)
    } else {
      setStreak(0)
      playWrong()
      rain()
      vibrate([40, 60, 40])
    }
    // La primera vez que aparece, el resultado cuenta para el repaso espaciado.
    if (!seenBefore) void recordReview(q, correct ? 'ok' : 'fail')
  }

  const next = () => {
    const ns = answer(session, result === 'ok' ? 'ok' : 'fail')
    setResult(null)
    setRound(round + 1)
    if (isFinished(ns)) onFinish(ns, xp)
    else setSession(ns)
  }

  return (
    <div className="game">
      <div className="game-head">
        <span>{total > 1 ? `Dosis ${dose + 1} de ${total}` : 'Ronda'}</span>
        <span>
          Aprendidas {learned} de {ids.length}
        </span>
        <span className="pts">⭐ {xp}</span>
        {streak >= 2 && <span className="streak">🔥 {streak}</span>}
      </div>
      <div className="progress" aria-hidden>
        <div className="progress-fill" style={{ width: `${(learned / ids.length) * 100}%` }} />
      </div>

      <article className="card q-card">
        <div className="q-item-head">
          <span className={`badge diff-badge diff-${q.difficulty}`}>{DIFFICULTIES.find((d) => d.value === q.difficulty)?.label}</span>
          <span className="badge">{QUESTION_TYPES.find((t) => t.value === q.type)?.label}</span>
          {seenBefore && <span className="badge">Otra vez</span>}
        </div>
        <h2 className="q-prompt">{q.prompt}</h2>
        {s.hints && q.hint && !result && (
          hintRound === round ? (
            <p className="hint-box">💡 {q.hint}</p>
          ) : (
            <button className="btn btn-small btn-ghost hint-btn" onClick={() => setHintRound(round)}>
              💡 Ver pista
            </button>
          )
        )}
        {s.timerOn && <TimerBar key={round} seconds={s.timerSeconds} running={!result} onExpire={() => respond(false, true)} />}
        <Player key={round} q={q} answered={!!result} mix={mix} onAnswer={(ok) => respond(ok)} />
      </article>

      {result && (
        <div className={`feedback feedback-${result === 'ok' ? 'ok' : 'fail'}`} role="status">
          <strong>
            {result === 'ok' ? '¡Correcto!' : result === 'timeout' ? 'Se acabó el tiempo' : 'Incorrecto'} <span className="pts">+{lastPts} {lastPts === 1 ? 'punto' : 'puntos'}</span>
          </strong>
          {result !== 'ok' && <p>Respuesta correcta: {correctAnswerText(q)}</p>}
          {q.explanation && <p>{q.explanation}</p>}
          {result !== 'ok' && <p className="muted">Esta pregunta volverá al final de la ronda.</p>}
          <button className="btn btn-block" autoFocus onClick={next}>
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}

// ── 4. Resultados ────────────────────────────────────────────
function Results({
  session, xp, byId, dose, total, topicId, onNext, onRepeat, onSetup,
}: {
  session: Session
  xp: number
  byId: Map<number, Question>
  dose: number
  total: number
  topicId: number
  onNext: () => void
  onRepeat: (ids: number[]) => void
  onSetup: () => void
}) {
  const r = summary(session)
  const pct = Math.round((r.firstTry / r.total) * 100)
  const all = useLiveQuery(() => totalXp(), [])
  const now = all !== undefined ? levelInfo(all) : null
  const before = all !== undefined ? levelInfo(Math.max(0, all - xp)) : null
  return (
    <div className="results">
      <div className="card results-card">
        <p className="results-big">{pct}%</p>
        <h1>{pct === 100 ? '¡Perfecto!' : pct >= 70 ? '¡Muy bien!' : 'Sigue practicando'}</h1>
        <p className="results-xp">+{xp} puntos</p>
        {now && before && now.level > before.level && (
          <p className="level-up" role="status">
            🎉 ¡Subiste al nivel {now.level}: {now.name}!
          </p>
        )}
        {now && (
          <Link to="/progreso" className="level-mini" aria-label={`Nivel ${now.level}, ${now.pct}% hacia el siguiente`}>
            <span>
              Nivel {now.level} · {now.name}
            </span>
            <span className="xp-bar">
              <span style={{ width: `${now.pct}%` }} />
            </span>
          </Link>
        )}
        <p>
          Acertaste {r.firstTry} de {r.total} a la primera. Todas quedaron aprendidas en esta ronda.
        </p>
        {r.failed.length > 0 && (
          <>
            <p className="muted">Las que fallaste volverán antes en el repaso espaciado:</p>
            <ul className="failed-list">
              {r.failed.map((id) => {
                const q = byId.get(id)
                return q ? <li key={id}>{q.type === 'cloze' ? q.text.replace(/\[\[\d+\]\]/g, '____') : q.prompt}</li> : null
              })}
            </ul>
          </>
        )}
      </div>
      <div className="results-actions">
        {dose + 1 < total && (
          <button className="btn btn-block" onClick={onNext}>
            Siguiente dosis ({dose + 2} de {total})
          </button>
        )}
        {r.failed.length > 0 && (
          <button className="btn btn-block btn-ghost" onClick={() => onRepeat(r.failed)}>
            Repetir solo las que fallé
          </button>
        )}
        <button className="btn btn-block btn-ghost" onClick={() => onRepeat(Object.keys(session.items).map(Number))}>
          Repetir esta dosis
        </button>
        <button className="btn btn-block btn-ghost" onClick={onSetup}>
          Elegir otras preguntas
        </button>
        <Link className="btn btn-block btn-ghost" to={`/tema/${topicId}`}>
          Volver al tema
        </Link>
      </div>
    </div>
  )
}

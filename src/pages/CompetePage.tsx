import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import BookContent from '../components/BookContent'
import Player from '../components/game/Players'
import TimerBar from '../components/game/TimerBar'
import { db } from '../lib/db'
import { confetti, playCorrect, playWrong, vibrate } from '../lib/effects'
import { MEDALS, advantages, ranking, type AnswerRecord, type PlayerResult, type PlayerRules } from '../lib/competition'
import { correctAnswerText, shuffle, type Question } from '../lib/questions'
import { PAPERS, TIMER_OPTIONS, timerLabel, useSettings } from '../lib/settings'
import { langFor } from '../lib/voice'

type Phase =
  | { name: 'setup' }
  | { name: 'study'; endAt: number }
  | { name: 'handoff'; turn: number }
  | { name: 'play'; turn: number }
  | { name: 'results' }

const STUDY = [0, 1, 2, 3, 5, 10, 15]
const COUNTS = [5, 10, 15, 20, 30, 50, 100]

// Competencia en el mismo celular: varios jugadores, las mismas preguntas,
// cada uno en su turno. Opcional: estudiar antes (mismo tiempo para todos)
// y modo moderador (tiempo y pistas por jugador, visibles para todos).
export default function CompetePage() {
  const topicId = Number(useParams().topicId)
  const topic = useLiveQuery(() => db.topics.get(topicId), [topicId])
  const all = useLiveQuery(() => db.questions.where('topicId').equals(topicId).sortBy('createdAt'), [topicId])
  const [phase, setPhase] = useState<Phase>({ name: 'setup' })
  const [players, setPlayers] = useState<PlayerRules[]>([
    { name: '', seconds: 20, hints: false },
    { name: '', seconds: 20, hints: false },
  ])
  const [moderated, setModerated] = useState(false)
  const [count, setCount] = useState(10)
  const [studyMin, setStudyMin] = useState(2)
  const [questions, setQuestions] = useState<Question[]>([])
  const [results, setResults] = useState<PlayerResult[]>([])

  if (!topic || !all) return null

  const named = players.map((p, i) => ({ ...p, name: p.name.trim() || `Jugador ${i + 1}` }))
  const start = () => {
    const qs = shuffle(all).slice(0, count)
    setQuestions(qs)
    setResults(named.map((p) => ({ ...p, answers: [] })))
    setPhase(studyMin ? { name: 'study', endAt: Date.now() + studyMin * 60_000 } : { name: 'handoff', turn: 0 })
  }
  const setAll = (patch: Partial<PlayerRules>) => setPlayers(players.map((p) => ({ ...p, ...patch })))

  return (
    <section className="practice">
      <nav className="crumbs">
        <Link to={`/tema/${topicId}`}>← {topic.name}</Link>
      </nav>

      {phase.name === 'setup' && (
        <div className="setup">
          <h1 className="page-title">🏆 Competir</h1>
          <p className="lead">Juega con amigos en este celular: todos responden las mismas preguntas, cada uno en su turno. Gana quien suma más puntos; si empatan, quien fue más rápido.</p>
          {all.length < 3 ? (
            <p className="empty">
              Necesitas al menos 3 preguntas en este tema. <Link to={`/tema/${topicId}/pegar`}>Añadir preguntas</Link>
            </p>
          ) : (
            <>
              <fieldset className="card setup-block">
                <legend>Jugadores</legend>
                {players.map((p, i) => (
                  <div key={i} className="player-row">
                    <input className="input" value={p.name} placeholder={`Jugador ${i + 1}`} aria-label={`Nombre del jugador ${i + 1}`} onChange={(e) => setPlayers(players.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    {moderated && (
                      <>
                        <select className="input input-small" aria-label={`Tiempo de ${named[i].name}`} value={p.seconds} onChange={(e) => setPlayers(players.map((x, j) => (j === i ? { ...x, seconds: Number(e.target.value) } : x)))}>
                          <option value={0}>Sin tiempo</option>
                          {TIMER_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {timerLabel(t)}
                            </option>
                          ))}
                        </select>
                        <label className="check">
                          <input type="checkbox" checked={p.hints} onChange={(e) => setPlayers(players.map((x, j) => (j === i ? { ...x, hints: e.target.checked } : x)))} />
                          Pistas
                        </label>
                      </>
                    )}
                    {players.length > 2 && (
                      <button className="btn btn-small btn-ghost" aria-label={`Quitar a ${named[i].name}`} onClick={() => setPlayers(players.filter((_, j) => j !== i))}>
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {players.length < 8 && (
                  <button className="btn btn-small btn-ghost" onClick={() => setPlayers([...players, { ...players[players.length - 1], name: '' }])}>
                    + Jugador
                  </button>
                )}
              </fieldset>

              <fieldset className="card setup-block">
                <legend>Reglas</legend>
                <div className="seg" role="radiogroup" aria-label="Tipo de competencia">
                  <button role="radio" aria-checked={!moderated} className={`seg-btn ${!moderated ? 'seg-on' : ''}`} onClick={() => (setModerated(false), setAll({ seconds: players[0].seconds, hints: players[0].hints }))}>
                    Iguales para todos
                  </button>
                  <button role="radio" aria-checked={moderated} className={`seg-btn ${moderated ? 'seg-on' : ''}`} onClick={() => setModerated(true)}>
                    Con moderador
                  </button>
                </div>
                <p className="muted">{moderated ? 'El moderador puede dar más tiempo o pistas a alguien (por ejemplo, a quien recién empieza). Todos verán esas ventajas en los resultados.' : 'Todos juegan con el mismo tiempo y las mismas ayudas.'}</p>
                <div className="setup-grid">
                  <label className="field" htmlFor="c-count">
                    <span>Preguntas</span>
                    <select id="c-count" className="input" value={Math.min(count, all.length)} onChange={(e) => setCount(Number(e.target.value))}>
                      {COUNTS.filter((n) => n < all.length).map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                      <option value={all.length}>Todas ({all.length})</option>
                    </select>
                  </label>
                  <label className="field" htmlFor="c-study">
                    <span>Estudiar antes</span>
                    <select id="c-study" className="input" value={studyMin} onChange={(e) => setStudyMin(Number(e.target.value))}>
                      {STUDY.map((m) => (
                        <option key={m} value={m}>
                          {m ? `${m} min para todos` : 'Sin estudiar'}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!moderated && (
                    <>
                      <label className="field" htmlFor="c-time">
                        <span>Tiempo por pregunta</span>
                        <select id="c-time" className="input" value={players[0].seconds} onChange={(e) => setAll({ seconds: Number(e.target.value) })}>
                          <option value={0}>Sin tiempo</option>
                          {TIMER_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {timerLabel(t)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="check">
                        <input type="checkbox" checked={players[0].hints} onChange={(e) => setAll({ hints: e.target.checked })} />
                        Permitir pistas
                      </label>
                    </>
                  )}
                </div>
              </fieldset>
              <button className="btn btn-block" onClick={start}>
                Empezar competencia
              </button>
            </>
          )}
        </div>
      )}

      {phase.name === 'study' && <StudyTogether title={topic.name} questions={questions} endAt={phase.endAt} onDone={() => setPhase({ name: 'handoff', turn: 0 })} />}

      {phase.name === 'handoff' && (
        <div className="card handoff">
          <p className="muted">
            Turno {phase.turn + 1} de {results.length}
          </p>
          <h1>Pásale el celular a</h1>
          <p className="handoff-name">{results[phase.turn].name}</p>
          <p className="muted">
            {questions.length} preguntas · {results[phase.turn].seconds ? `${results[phase.turn].seconds} s por pregunta` : 'sin tiempo'} · {results[phase.turn].hints ? 'con pistas' : 'sin pistas'}
          </p>
          <p className="muted">Los demás, no miren 👀. Las respuestas correctas se verán al final.</p>
          <button className="btn btn-block" onClick={() => setPhase({ name: 'play', turn: phase.turn })}>
            Estoy listo, empezar
          </button>
        </div>
      )}

      {phase.name === 'play' && (
        <Turn
          key={phase.turn}
          player={results[phase.turn]}
          questions={questions}
          onDone={(answers) => {
            const next = results.map((r, i) => (i === phase.turn ? { ...r, answers } : r))
            setResults(next)
            setPhase(phase.turn + 1 < next.length ? { name: 'handoff', turn: phase.turn + 1 } : { name: 'results' })
          }}
        />
      )}

      {phase.name === 'results' && <Podium results={results} questions={questions} onRematch={start} onSetup={() => setPhase({ name: 'setup' })} />}
    </section>
  )
}

function StudyTogether({ title, questions, endAt, onDone }: { title: string; questions: Question[]; endAt: number; onDone: () => void }) {
  const s = useSettings()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])
  const left = Math.max(0, Math.ceil((endAt - now) / 1000))
  useEffect(() => {
    if (left === 0) onDone()
  }, [left, onDone])
  const paper = PAPERS.find((p) => p.id === s.paper) ?? PAPERS[0]
  return (
    <div>
      <div className={`card study-bar ${left <= 10 ? 'timer-warn' : ''}`} role="timer">
        <strong>
          📖 Estudien juntos · ⏱ {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
        </strong>
        <button className="btn btn-small" onClick={onDone}>
          Todos listos
        </button>
      </div>
      <article className="book" style={{ background: paper.bg, color: paper.fg, fontSize: `${s.readerScale}rem`, lineHeight: s.readerSpacing }}>
        <BookContent title={title} subtitle="Mismo tiempo para todos" questions={questions} words={[]} texts={[]} mode="respuestas" />
      </article>
    </div>
  )
}

function Turn({ player, questions, onDone }: { player: PlayerResult; questions: Question[]; onDone: (a: AnswerRecord[]) => void }) {
  const [i, setI] = useState(0)
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const [startedAt, setStartedAt] = useState(() => performance.now())
  const [result, setResult] = useState<null | boolean>(null)
  const [hint, setHint] = useState(false)
  const q = questions[i]

  const answer = (correct: boolean, timeout = false) => {
    if (result !== null) return
    const took = timeout ? player.seconds : Math.round((performance.now() - startedAt) / 100) / 10
    setAnswers([...answers, { correct, took, usedHint: hint }])
    setResult(correct)
    if (correct) {
      playCorrect()
      vibrate(30)
    } else {
      playWrong()
      vibrate([40, 60, 40])
    }
  }
  const next = () => {
    if (i + 1 >= questions.length) return onDone(answers)
    setI(i + 1)
    setResult(null)
    setHint(false)
    setStartedAt(performance.now())
  }

  return (
    <div className="game">
      <div className="game-head">
        <span>{player.name}</span>
        <span>
          {i + 1} de {questions.length}
        </span>
        <span className="pts">✓ {answers.filter((a) => a.correct).length}</span>
      </div>
      <div className="progress" aria-hidden>
        <div className="progress-fill" style={{ width: `${(i / questions.length) * 100}%` }} />
      </div>
      <article className="card q-card">
        <h2 className="q-prompt">{q.prompt}</h2>
        {player.hints && q.hint && result === null && (hint ? <p className="hint-box">💡 {q.hint}</p> : <button className="btn btn-small btn-ghost hint-btn" onClick={() => setHint(true)}>💡 Ver pista (vale la mitad)</button>)}
        {player.seconds > 0 && <TimerBar key={i} seconds={player.seconds} running={result === null} onExpire={() => answer(false, true)} />}
        <Player key={i} q={q} answered={result !== null} mix lang={langFor(q.prompt)} onAnswer={(ok) => answer(ok)} />
      </article>
      {result !== null && (
        <div className={`feedback feedback-${result ? 'ok' : 'fail'}`} role="status">
          <strong>{result ? '¡Correcto!' : 'Incorrecto'}</strong>
          <button className="btn btn-block" autoFocus onClick={next}>
            {i + 1 >= questions.length ? 'Terminar mi turno' : 'Siguiente'}
          </button>
        </div>
      )}
    </div>
  )
}

function Podium({ results, questions, onRematch, onSetup }: { results: PlayerResult[]; questions: Question[]; onRematch: () => void; onSetup: () => void }) {
  const rows = ranking(results, questions.map((q) => q.difficulty))
  const extra = advantages(results)
  useEffect(() => {
    confetti(true)
  }, [])
  return (
    <div className="results">
      <div className="card results-card">
        <h1>🏆 Resultados</h1>
        <ol className="podium">
          {rows.slice(0, 3).map((r, k) => (
            <li key={k} className={`podium-${r.place}`}>
              <span className="podium-medal">{MEDALS[r.place - 1] ?? r.place}</span>
              <strong>{r.player.name}</strong>
              <span className="pts">{r.points} pts</span>
            </li>
          ))}
        </ol>
        <table className="rank-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Jugador</th>
              <th>Puntos</th>
              <th>Aciertos</th>
              <th>Tiempo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, k) => (
              <tr key={k}>
                <td>{MEDALS[r.place - 1] ?? r.place}</td>
                <td>
                  {r.player.name}
                  {r.hints > 0 && ` · 💡${r.hints}`}
                </td>
                <td>{r.points}</td>
                <td>
                  {r.correct}/{questions.length}
                </td>
                <td>{r.time} s</td>
              </tr>
            ))}
          </tbody>
        </table>
        {extra.length > 0 && (
          <div className="confirm-box">
            <p>
              <strong>⚖️ Condiciones dadas por el moderador</strong>
            </p>
            <ul>
              {extra.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <details className="tip">
        <summary>Ver las respuestas correctas</summary>
        <ol>
          {questions.map((q) => (
            <li key={q.id}>
              {q.prompt} → <strong>{correctAnswerText(q)}</strong>
            </li>
          ))}
        </ol>
      </details>
      <div className="results-actions">
        <button className="btn btn-block" onClick={onRematch}>
          Revancha (otras preguntas)
        </button>
        <button className="btn btn-block btn-ghost" onClick={onSetup}>
          Cambiar jugadores o reglas
        </button>
      </div>
    </div>
  )
}

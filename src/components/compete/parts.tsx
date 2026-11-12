import { useEffect, useState } from 'react'
import BookContent from '../BookContent'
import Player from '../game/Players'
import TimerBar from '../game/TimerBar'
import { confetti, playCorrect, playWrong, vibrate } from '../../lib/effects'
import { MEDALS, advantages, ranking, type AnswerRecord, type PlayerResult, type PlayerRules } from '../../lib/competition'
import type { Word } from '../../lib/db'
import { clock } from '../../lib/duration'
import { correctAnswerText, type Question } from '../../lib/questions'
import { PAPERS, useSettings } from '../../lib/settings'
import { langFor } from '../../lib/voice'

// Piezas de las competencias, usadas en el mismo celular y en línea.

export function StudyTogether({ title, questions, words = [], endAt, onDone }: { title: string; questions: Question[]; words?: Word[]; endAt: number; onDone: () => void }) {
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
          📖 Estudien juntos · ⏱ {clock(left)}
        </strong>
        <button className="btn btn-small" onClick={onDone}>
          Todos listos
        </button>
      </div>
      <article className="book" style={{ background: paper.bg, color: paper.fg, fontSize: `${s.readerScale}rem`, lineHeight: s.readerSpacing }}>
        <BookContent title={title} subtitle="Mismo tiempo para todos" questions={questions} words={words} texts={[]} mode="respuestas" />
      </article>
    </div>
  )
}

export function Turn({ player, questions, onDone }: { player: PlayerRules; questions: Question[]; onDone: (a: AnswerRecord[]) => void }) {
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

export function Podium({ results, questions, onRematch, onSetup }: { results: PlayerResult[]; questions: Question[]; onRematch: () => void; onSetup: () => void }) {
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

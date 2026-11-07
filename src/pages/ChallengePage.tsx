import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { StudyTogether, Turn } from '../components/compete/parts'
import { currentUser } from '../lib/cloud'
import { challengeDetail, closeChallenge, playable, setPlayerRules, submitResult, type ChallengePlayer } from '../lib/community'
import { MEDALS, totals } from '../lib/competition'
import { TIMER_OPTIONS, timerLabel } from '../lib/settings'

type Detail = Awaited<ReturnType<typeof challengeDetail>>

// Una competencia en línea: reglas, participantes (con sus condiciones, a la vista de todos),
// jugar mi turno y, al final, el podio con los premios.
export default function ChallengePage() {
  const id = useParams().challengeId!
  const [d, setD] = useState<Detail | null>(null)
  const [me, setMe] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'info' | 'study' | 'play'>('info')
  const [studyEnd, setStudyEnd] = useState(0)
  const [n, setN] = useState(0)
  const [now] = useState(() => Date.now())
  const reload = () => setN(n + 1)

  useEffect(() => {
    let alive = true
    Promise.all([challengeDetail(id), currentUser()]).then(
      ([detail, u]) => {
        if (!alive) return
        setD(detail)
        setMe(u?.id ?? null)
      },
      (e: Error) => alive && setError(e.message),
    )
    return () => {
      alive = false
    }
  }, [id, n])

  const crumbs = (
    <nav className="crumbs">
      <Link to="/comunidad?pestana=competir">← Competencias</Link>
    </nav>
  )
  if (error)
    return (
      <section>
        {crumbs}
        <p className="form-error">{error}</p>
      </section>
    )
  if (!d) return <section>{crumbs}</section>

  const { challenge: c, players, game } = d
  const questions = playable(game)
  const mine = players.find((p) => p.user_id === me)
  const isHost = c.host === me
  const over = c.closed || new Date(c.closes_at).getTime() < now
  const sorted = [...players].sort((a, b) => (b.points ?? -1) - (a.points ?? -1) || (a.time_spent ?? 1e9) - (b.time_spent ?? 1e9))
  const varied = players.some((p) => p.seconds !== c.seconds || p.hints !== c.hints)

  if (phase === 'study') return <StudyTogether title={c.title} questions={questions} endAt={studyEnd} onDone={() => setPhase('play')} />
  if (phase === 'play' && mine)
    return (
      <section className="practice">
        <Turn
          player={{ name: mine.display_name, seconds: mine.seconds, hints: mine.hints }}
          questions={questions}
          onDone={(answers) => {
            const t = totals({ name: mine.display_name, seconds: mine.seconds, hints: mine.hints, answers }, questions.map((q) => q.difficulty))
            submitResult(c.id, { points: t.points, correct: t.correct, time: t.time, hints: t.hints }).then(
              () => (setPhase('info'), reload()),
              (e: Error) => (setPhase('info'), setError(e.message)),
            )
          }}
        />
      </section>
    )

  const share = async () => {
    const text = `¡Te reto en Memora! Únete a «${c.title}» con el código ${c.code}`
    const url = `${location.origin}/comunidad?pestana=competir&codigo=${c.code}`
    try {
      if (navigator.share) await navigator.share({ title: 'Memora', text, url })
      else await navigator.clipboard.writeText(`${text}: ${url}`)
    } catch {
      // La persona canceló el menú de compartir.
    }
  }

  return (
    <section>
      {crumbs}
      <h1 className="page-title">🏆 {c.title}</h1>
      <p className="lead">
        {game.question_count} preguntas · {c.study_minutes ? `${c.study_minutes} min para estudiar` : 'sin estudio previo'} · {c.seconds ? `${c.seconds} s por pregunta` : 'sin tiempo'} · {c.hints ? 'con pistas' : 'sin pistas'}
        {c.moderated && ' · con moderador'}
      </p>
      <div className="card">
        <p>
          Código para invitar: <strong className="code">{c.code}</strong>
        </p>
        {c.prizes.some((p) => p > 0) && <p>Premios: 🥇 {c.prizes[0]} · 🥈 {c.prizes[1]} · 🥉 {c.prizes[2]} créditos</p>}
        <p className="muted">{over ? 'La competencia terminó.' : `Abierta hasta ${new Date(c.closes_at).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}.`}</p>
        <div className="card-actions">
          {!over && (
            <button className="btn btn-small btn-ghost" onClick={() => void share()}>
              📨 Invitar amigos
            </button>
          )}
          {mine && !mine.finished_at && !over && (
            <button
              className="btn btn-small"
              onClick={() => {
                if (c.study_minutes) {
                  setStudyEnd(Date.now() + c.study_minutes * 60_000)
                  setPhase('study')
                } else setPhase('play')
              }}
            >
              ▶ Jugar mi turno
            </button>
          )}
          {isHost && !c.closed && (
            <button className="btn btn-small btn-ghost" onClick={() => void closeChallenge(c.id).then(reload, (e: Error) => setError(e.message))}>
              🏁 Cerrar y dar premios
            </button>
          )}
        </div>
        {mine && !mine.finished_at && !over && <p className="muted">Solo tienes un intento. Tus condiciones: {mine.seconds ? `${mine.seconds} s por pregunta` : 'sin tiempo'}, {mine.hints ? 'con pistas' : 'sin pistas'}.</p>}
      </div>

      <h2>Participantes ({players.length})</h2>
      {varied && <p className="confirm-box">⚖️ El moderador dio condiciones distintas a algunos jugadores. Aparecen en la tabla para que todos las vean.</p>}
      <table className="rank-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Jugador</th>
            <th>Condiciones</th>
            <th>Puntos</th>
            <th>Aciertos</th>
            <th>Tiempo</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, k) => (
            <tr key={p.user_id}>
              <td>{p.place ? (MEDALS[p.place - 1] ?? p.place) : p.finished_at ? k + 1 : '–'}</td>
              <td>
                {p.display_name}
                {p.user_id === me && ' (tú)'}
              </td>
              <td>{isHost && c.moderated && !p.finished_at && !over ? <RulesEditor challengeId={c.id} p={p} onSaved={reload} /> : `${p.seconds ? `${p.seconds} s` : 'sin tiempo'}${p.hints ? ' · 💡' : ''}`}</td>
              <td>{p.points ?? '–'}</td>
              <td>{p.correct !== null ? `${p.correct}/${game.question_count}` : 'Pendiente'}</td>
              <td>{p.time_spent !== null ? `${p.time_spent} s` : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function RulesEditor({ challengeId, p, onSaved }: { challengeId: string; p: ChallengePlayer; onSaved: () => void }) {
  return (
    <span className="rules-edit">
      <select className="input input-small" aria-label={`Tiempo de ${p.display_name}`} value={p.seconds} onChange={(e) => void setPlayerRules(challengeId, p.user_id, Number(e.target.value), p.hints).then(onSaved)}>
        <option value={0}>Sin tiempo</option>
        {TIMER_OPTIONS.map((t) => (
          <option key={t} value={t}>
            {timerLabel(t)}
          </option>
        ))}
      </select>
      <label className="check">
        <input type="checkbox" checked={p.hints} onChange={(e) => void setPlayerRules(challengeId, p.user_id, p.seconds, e.target.checked).then(onSaved)} />💡
      </label>
    </span>
  )
}

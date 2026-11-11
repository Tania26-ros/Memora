import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import { dayKey, lastDays, levelInfo, streakInfo } from '../lib/progress'
import { useSettings } from '../lib/settings'
import { isDue } from '../lib/srs'

const WEEKDAY = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

// «Mi progreso»: nivel, racha, meta del día y los últimos 7 días.
export default function ProgressPage() {
  const s = useSettings()
  const data = useLiveQuery(async () => {
    const [days, reviews, questions] = await Promise.all([db.days.toArray(), db.reviews.toArray(), db.questions.count()])
    return { days, due: reviews.filter((r) => isDue(r)).length, learned: reviews.filter((r) => r.lastResult === 'ok').length, questions }
  }, [])
  if (!data) return null

  const { days, due, learned, questions } = data
  const total = days.reduce((sum, d) => sum + d.xp, 0)
  const answered = days.reduce((sum, d) => sum + d.answered, 0)
  const correct = days.reduce((sum, d) => sum + d.correct, 0)
  const level = levelInfo(total)
  const streak = streakInfo(days)
  const week = lastDays(days, 7)
  const today = week[week.length - 1]
  const max = Math.max(s.dailyGoal, ...week.map((d) => d.answered))
  const goalPct = Math.min(100, Math.round((today.answered / s.dailyGoal) * 100))

  return (
    <section>
      <nav className="crumbs">
        <Link to="/">← Cuadernos</Link>
      </nav>
      <h1 className="page-title">Mi progreso</h1>
      <p className="lead">Ganas puntos al responder: más por las difíciles y por acertar a la primera. Estudia cada día para mantener tu racha.</p>

      <div className="card level-card">
        <p className="muted">Nivel {level.level}</p>
        <p className="level-name">⭐ {level.name}</p>
        <span className="xp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={level.needed} aria-valuenow={level.into} aria-label="Puntos hacia el siguiente nivel">
          <span style={{ width: `${level.pct}%` }} />
        </span>
        <p className="muted">
          {level.into} de {level.needed} puntos para el nivel {level.level + 1}
        </p>
      </div>

      <div className="progress-grid">
        <div className="card stat-card">
          <p className="stat-value">🔥 {streak.current}</p>
          <p className="stat-label">{streak.current === 1 ? 'día de racha' : 'días de racha'}{streak.best > streak.current ? ` · tu mejor: ${streak.best}` : ''}</p>
        </div>
        <div className="card stat-card">
          <p className="stat-value">{today.answered} / {s.dailyGoal}</p>
          <p className="stat-label">{goalPct >= 100 ? '✓ Meta de hoy cumplida' : 'preguntas de la meta de hoy'}</p>
          <span className="xp-bar" aria-hidden>
            <span style={{ width: `${goalPct}%` }} />
          </span>
        </div>
        <div className="card stat-card">
          <p className="stat-value">{answered ? Math.round((correct / answered) * 100) : 0}%</p>
          <p className="stat-label">de aciertos ({answered} respuestas)</p>
        </div>
        <div className="card stat-card">
          <p className="stat-value">{learned} / {questions}</p>
          <p className="stat-label">preguntas dominadas{due ? ` · ${due} para repasar hoy` : ''}</p>
        </div>
      </div>

      <div className="card">
        <h2>Preguntas de los últimos 7 días</h2>
        <div className="week" role="img" aria-label={`Preguntas respondidas por día: ${week.map((d) => d.answered).join(', ')}`}>
          {week.map((d) => {
            const [y, m, dd] = d.date.split('-').map(Number)
            return (
              <div key={d.date} className={`week-col ${d.answered >= s.dailyGoal ? 'goal-met' : ''} ${d.date === dayKey() ? 'today' : ''}`}>
                <span>{d.answered || ''}</span>
                <span className="week-bar" style={{ height: `${(d.answered / max) * 100}%` }} />
                <span>{WEEKDAY[new Date(y, m - 1, dd).getDay()]}</span>
              </div>
            )
          })}
        </div>
        <p className="goal-note">
          Las barras verdes son días en que cumpliste tu meta. <Link to="/ajustes">Cambiar la meta diaria</Link>
        </p>
      </div>
    </section>
  )
}

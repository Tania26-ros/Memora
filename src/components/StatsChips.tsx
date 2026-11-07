import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../lib/db'
import { levelInfo, streakInfo } from '../lib/progress'

// Racha y nivel en la barra superior. Toca para ver «Mi progreso».
export default function StatsChips() {
  const data = useLiveQuery(async () => {
    const days = await db.days.toArray()
    return { streak: streakInfo(days), level: levelInfo(days.reduce((s, d) => s + d.xp, 0)) }
  }, [])
  if (!data) return null
  const { streak, level } = data
  return (
    <Link to="/progreso" className="topbar-right" aria-label={`Racha de ${streak.current} días, nivel ${level.level}. Ver mi progreso`}>
      <span className={`stat-chip ${streak.playedToday ? '' : 'off'}`} title={streak.playedToday ? 'Ya estudiaste hoy' : 'Estudia hoy para mantener tu racha'}>
        🔥 {streak.current}
      </span>
      <span className="stat-chip">⭐ Nv {level.level}</span>
    </Link>
  )
}

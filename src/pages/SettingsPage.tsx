import { Link } from 'react-router-dom'
import { DAILY_GOALS, TEXT_SCALES, THEMES, updateSettings, useSettings } from '../lib/settings'

// Ajustes: estilo visual, tamaño de letra, meta diaria y efectos del juego.
// Todo se guarda en este dispositivo y se aplica al instante.
export default function SettingsPage() {
  const s = useSettings()
  return (
    <section>
      <nav className="crumbs">
        <Link to="/">← Cuadernos</Link>
      </nav>
      <h1 className="page-title">Ajustes</h1>
      <p className="lead">Elige cómo quieres que se vea y se sienta Memora. Los cambios se ven al instante.</p>

      <div className="card settings-section">
        <h2>Estilo</h2>
        <div className="theme-grid" role="radiogroup" aria-label="Estilo">
          {THEMES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={s.theme === t.id} className="theme-card" onClick={() => updateSettings({ theme: t.id })}>
              <span className="theme-preview" style={{ background: t.swatch[0] }} aria-hidden>
                <span style={{ background: t.swatch[2] }} />
                <span style={{ background: t.swatch[1], border: `1px solid ${t.swatch[3]}22` }} />
              </span>
              <strong>{t.label}</strong>
              <small>{t.hint}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="card settings-section">
        <h2>Tamaño de letra</h2>
        <div className="seg" role="radiogroup" aria-label="Tamaño de letra">
          {TEXT_SCALES.map((t) => (
            <button key={t.value} type="button" role="radio" aria-checked={s.textScale === t.value} className={`seg-btn ${s.textScale === t.value ? 'seg-on' : ''}`} onClick={() => updateSettings({ textScale: t.value })}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card settings-section">
        <h2>Meta diaria</h2>
        <div className="seg" role="radiogroup" aria-label="Meta diaria">
          {DAILY_GOALS.map((g) => (
            <button key={g.value} type="button" role="radio" aria-checked={s.dailyGoal === g.value} className={`seg-btn ${s.dailyGoal === g.value ? 'seg-on' : ''}`} onClick={() => updateSettings({ dailyGoal: g.value })}>
              {g.label}
            </button>
          ))}
        </div>
        <p className="muted">{DAILY_GOALS.find((g) => g.value === s.dailyGoal)?.hint}</p>
      </div>

      <div className="card settings-section">
        <h2>Al jugar</h2>
        <div className="chips">
          {(
            [
              ['sound', 'Sonido'],
              ['animations', 'Animaciones (confeti y lluvia)'],
              ['vibration', 'Vibración'],
              ['hints', 'Mostrar pistas'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="check">
              <input type="checkbox" checked={s[key]} onChange={(e) => updateSettings({ [key]: e.target.checked })} />
              {label}
            </label>
          ))}
        </div>
      </div>
    </section>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import VoiceControls from '../components/VoiceControls'
import { DAILY_GOALS, TEXT_SCALES, THEMES, updateSettings, useSettings } from '../lib/settings'
import { LANGUAGES, canListen, canSpeak } from '../lib/speech'
import { say } from '../lib/voice'

// Ajustes: estilo visual, tamaño de letra, meta diaria y efectos del juego.
// Todo se guarda en este dispositivo y se aplica al instante.
export default function SettingsPage() {
  const s = useSettings()
  const [configLang, setConfigLang] = useState(s.voiceLang === 'auto' ? 'es-ES' : s.voiceLang)
  return (
    <section>
      <nav className="crumbs">
        <Link to="/">← Cuadernos</Link>
      </nav>
      <h1 className="page-title">Ajustes</h1>
      <p className="lead">Elige cómo quieres que se vea y se sienta Memora. Los cambios se ven al instante.</p>

      <Link to="/cuenta" className="card settings-section account-link">
        <span>
          <strong>☁️ Cuenta y copias de seguridad</strong>
          <small className="muted"> Guarda tus cuadernos para no perderlos y úsalos en otro equipo.</small>
        </span>
        <span aria-hidden>›</span>
      </Link>

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
        <h2>Voz</h2>
        {!canSpeak() && <p className="import-problem">Este navegador no puede leer en voz alta. Prueba con Chrome (Android) o Safari (iPhone).</p>}
        <div className="setup-grid">
          <label className="field" htmlFor="voice-lang">
            <span>Idioma de la voz</span>
            <select id="voice-lang" className="input" value={s.voiceLang} onChange={(e) => updateSettings({ voiceLang: e.target.value })}>
              <option value="auto">Automático (según el texto)</option>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field" htmlFor="voice-config">
            <span>Configurar la voz para</span>
            <select id="voice-config" className="input" value={configLang} onChange={(e) => setConfigLang(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <VoiceControls lang={configLang} idPrefix="settings" />
        <div className="chips">
          <label className="check">
            <input type="checkbox" checked={s.autoRead} onChange={(e) => updateSettings({ autoRead: e.target.checked })} />
            Leer cada pregunta al aparecer
          </label>
          <button type="button" className="btn btn-small btn-ghost" onClick={() => void say(configLang.startsWith('en') ? 'Hello! This is how I sound.' : 'Hola, así sueno al leer tus preguntas.', configLang)}>
            🔊 Probar la voz
          </button>
        </div>
        <p className="muted">
          {canListen() ? 'Para responder hablando, toca 🎤 en el juego. La primera vez el celular te pedirá permiso para el micrófono.' : 'Este navegador no permite responder hablando; podrás escribir o tocar la respuesta.'} Si una voz suena rara, instala la voz de ese idioma en los ajustes de «Texto a voz» de tu celular.
        </p>
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
              ['mascot', 'Mostrar a Memo, la mascota'],
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

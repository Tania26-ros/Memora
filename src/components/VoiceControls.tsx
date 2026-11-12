import { LANGUAGES, VOICE_STYLES } from '../lib/speech'
import { useVoices } from '../lib/useVoices'
import { VOICE_RATES, updateSettings, useSettings } from '../lib/settings'

// Velocidad, voz y estilo. Se guardan en Ajustes y valen para toda la app.
export default function VoiceControls({ lang, idPrefix = 'vc', showSpeed = true }: { lang: string; idPrefix?: string; showSpeed?: boolean }) {
  const s = useSettings()
  const voices = useVoices(lang)
  const base = lang.split('-')[0].toLowerCase()
  const langLabel = LANGUAGES.find((l) => l.code.startsWith(base))?.label ?? lang
  return (
    <div className="voice-controls">
      {showSpeed && (
        <div className="field">
          <span>Velocidad</span>
          <div className="seg seg-wrap" role="radiogroup" aria-label="Velocidad de la voz">
            {VOICE_RATES.map((r) => (
              <button key={r.value} type="button" role="radio" aria-checked={s.voiceRate === r.value} className={`seg-btn ${s.voiceRate === r.value ? 'seg-on' : ''}`} onClick={() => updateSettings({ voiceRate: r.value })}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="setup-grid">
        <label className="field" htmlFor={`${idPrefix}-voice`}>
          <span>Voz en {langLabel.toLowerCase()}</span>
          <select id={`${idPrefix}-voice`} className="input" value={s.voices[base] ?? ''} onChange={(e) => updateSettings({ voices: { ...s.voices, [base]: e.target.value } })}>
            <option value="">{voices.length ? 'La del celular (automática)' : 'No hay voces instaladas para este idioma'}</option>
            {voices.map((v) => (
              <option key={v.uri} value={v.uri}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field" htmlFor={`${idPrefix}-style`}>
          <span>Estilo</span>
          <select id={`${idPrefix}-style`} className="input" value={s.voiceStyle} onChange={(e) => updateSettings({ voiceStyle: e.target.value as typeof s.voiceStyle })}>
            {VOICE_STYLES.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="premium-voices" aria-disabled="true">
        <span className="badge">Premium</span>
        <span>
          <strong>Voces naturales con IA</strong>: narrador, alegre, serio, susurro, niño, abuela y más, en muchos idiomas. Requiere pago y llegará con Memora Premium.
        </span>
      </div>
      <p className="muted">Las voces gratis son las que trae tu celular. Para tener más, instálalas en Ajustes del celular → «Texto a voz» (Android) o «Contenido leído» (iPhone).</p>
    </div>
  )
}

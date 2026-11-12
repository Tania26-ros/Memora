import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { canSpeak, speak, stopSpeaking } from '../lib/speech'
import { getSettings, useSettings } from '../lib/settings'
import { splitSentences } from '../lib/vocab'
import { voiceOptions } from '../lib/voice'
import VoiceControls from './VoiceControls'

type WakeLock = { release: () => Promise<void> }

// Lee tu texto en voz alta, frase por frase. Puedes pausar, retroceder,
// avanzar o tocar cualquier frase para seguir desde ahí. La frase que
// se está leyendo se resalta, y Memora recuerda dónde te quedaste.
export default function TextReader({ text, lang, startAt = 0, onPosition, below }: { text: string; lang: string; startAt?: number; onPosition?: (i: number) => void; below?: ReactNode }) {
  const s = useSettings()
  const sentences = useMemo(() => splitSentences(text), [text])
  const [idx, setIdx] = useState(() => Math.min(startAt, Math.max(0, sentences.length - 1)))
  const [playing, setPlaying] = useState(false)
  const [loop, setLoop] = useState(false)
  const [repeatOne, setRepeatOne] = useState(false)
  const [pass, setPass] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const posRef = useRef(onPosition)
  const flags = useRef({ loop, repeatOne })
  useEffect(() => {
    posRef.current = onPosition
    flags.current = { loop, repeatOne }
  })

  // Lee la frase actual; al terminar pasa a la siguiente. Cualquier cambio
  // (pausa, otra frase, otra velocidad o voz) corta la lectura y vuelve a empezar.
  useEffect(() => {
    if (!playing || !sentences.length) return
    const token = { cancelled: false }
    const run = async () => {
      const opts = voiceOptions(lang)
      await speak(sentences[idx], lang, getSettings().voiceRate, opts)
      if (token.cancelled) return
      if (flags.current.repeatOne) return setPass((n) => n + 1) // vuelve a leer la misma frase
      if (idx + 1 < sentences.length) setIdx(idx + 1)
      else if (flags.current.loop) setIdx(0)
      else setPlaying(false)
    }
    void run()
    return () => {
      token.cancelled = true
      stopSpeaking()
    }
  }, [playing, idx, pass, sentences, lang, s.voiceRate, s.voiceStyle, s.voices])

  // Guardar dónde va y mostrar la frase actual dentro del recuadro.
  useEffect(() => {
    posRef.current?.(idx)
    const el = boxRef.current?.querySelector<HTMLElement>(`[data-i="${idx}"]`)
    const box = boxRef.current
    if (el && box) box.scrollTo({ top: el.offsetTop - box.clientHeight / 3, behavior: 'smooth' })
  }, [idx])

  // Mantener la pantalla encendida mientras lee (en el bus el celular no se apaga solo).
  useEffect(() => {
    if (!playing) return
    let lock: WakeLock | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLock> } }
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    return () => void lock?.release().catch(() => {})
  }, [playing])

  useEffect(() => () => stopSpeaking(), [])

  if (!canSpeak()) return <p className="import-problem">Este navegador no puede leer en voz alta. Prueba con Chrome (Android) o Safari (iPhone).</p>
  if (!sentences.length) return <p className="empty">Escribe o pega un texto para escucharlo.</p>

  const go = (i: number) => setIdx(Math.max(0, Math.min(sentences.length - 1, i)))

  return (
    <div className="text-reader">
      <div className="reader-box" ref={boxRef} lang={lang} aria-label="Texto para escuchar">
        {sentences.map((t, i) => (
          <button key={i} type="button" data-i={i} className={`reader-sentence ${i === idx ? 'reading' : ''}`} aria-current={i === idx ? 'true' : undefined} onClick={() => (go(i), setPlaying(true))}>
            {t}{' '}
          </button>
        ))}
      </div>
      {below}
      <div className="reader-controls" role="group" aria-label="Controles de lectura">
        <button type="button" className="btn btn-ghost" aria-label="Frase anterior" onClick={() => go(idx - 1)} disabled={idx === 0}>
          ⏮
        </button>
        <button type="button" className="btn reader-play" aria-label={playing ? 'Pausar' : 'Leer en voz alta'} onClick={() => setPlaying(!playing)}>
          {playing ? '⏸ Pausar' : idx > 0 ? '▶ Seguir' : '▶ Leer'}
        </button>
        <button type="button" className="btn btn-ghost" aria-label="Frase siguiente" onClick={() => go(idx + 1)} disabled={idx >= sentences.length - 1}>
          ⏭
        </button>
        <span className="muted reader-count">
          {idx + 1} / {sentences.length}
        </span>
      </div>
      <div className="chips">
        <label className="check">
          <input type="checkbox" checked={repeatOne} onChange={(e) => setRepeatOne(e.target.checked)} />
          Repetir esta frase
        </label>
        <label className="check">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
          Volver a empezar al terminar
        </label>
        {idx > 0 && (
          <button type="button" className="btn btn-small btn-ghost" onClick={() => go(0)}>
            Desde el inicio
          </button>
        )}
      </div>
      <VoiceControls lang={lang} idPrefix="reader" />
      <p className="muted">Toca cualquier frase para empezar desde ahí. Deja la pantalla encendida: algunos celulares detienen la voz al bloquearse.</p>
    </div>
  )
}

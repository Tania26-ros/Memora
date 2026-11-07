import { useState } from 'react'
import { canListen, canSpeak, listen, stopSpeaking } from '../lib/speech'
import { say } from '../lib/voice'

// Botón 🔊 para escuchar un texto.
export function SpeakButton({ text, lang, label = 'Escuchar' }: { text: string; lang?: string; label?: string }) {
  if (!canSpeak()) return null
  return (
    <button type="button" className="btn btn-small btn-ghost voice-btn" aria-label={label} title={label} onClick={() => void say(text, lang)}>
      🔊
    </button>
  )
}

// Botón 🎤: escucha y entrega lo que entendió. Si no se puede, explica qué hacer.
export function MicButton({ lang, onResult, label = 'Responder hablando' }: { lang: string; onResult: (alternatives: string[]) => string | void; label?: string }) {
  const [state, setState] = useState<'idle' | 'listening'>('idle')
  const [error, setError] = useState<string | null>(null)
  if (!canListen()) return null
  return (
    <span className="mic-wrap">
      <button
        type="button"
        className={`btn btn-small ${state === 'listening' ? 'mic-on' : 'btn-ghost'}`}
        aria-label={state === 'listening' ? 'Escuchando… toca para terminar' : label}
        onClick={async () => {
          setError(null)
          stopSpeaking()
          setState('listening')
          try {
            // onResult puede devolver un mensaje si no entendió la respuesta.
            const problem = onResult(await listen(lang).result)
            if (problem) setError(problem)
          } catch (e) {
            setError((e as Error).message)
          } finally {
            setState('idle')
          }
        }}
      >
        {state === 'listening' ? '🎙️ Escuchando…' : `🎤 ${label}`}
      </button>
      {error && (
        <span className="mic-error" role="alert">
          {error}
        </span>
      )}
    </span>
  )
}


import { useEffect, useState } from 'react'

// Chrome y Edge avisan con el evento "beforeinstallprompt" cuando la app se
// puede instalar. Lo guardamos y mostramos nuestro propio botón "Instalar".
// En iPhone no existe ese evento: allí se instala desde Compartir →
// "Añadir a pantalla de inicio", así que mostramos esa pista.
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
const isInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export default function InstallButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null)
  const [showIosHint, setShowIosHint] = useState(false)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (isInstalled()) return null

  if (promptEvent) {
    return (
      <button
        className="btn btn-small"
        onClick={async () => {
          await promptEvent.prompt()
          await promptEvent.userChoice
          setPromptEvent(null)
        }}
      >
        Instalar app
      </button>
    )
  }

  if (isIos) {
    return (
      <div className="ios-install">
        <button className="btn btn-small btn-ghost" onClick={() => setShowIosHint((v) => !v)}>
          Instalar
        </button>
        {showIosHint && (
          <p className="ios-hint" role="status">
            Toca <strong>Compartir</strong> y luego <strong>Añadir a pantalla de inicio</strong>.
          </p>
        )}
      </div>
    )
  }

  return null
}

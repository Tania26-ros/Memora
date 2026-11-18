import { useCallback, useEffect, useRef, useState } from 'react'
import { maybeSignedIn } from '../lib/cloud'
import { onLocalChange } from '../lib/sync'

// Sincroniza sola con la nube cuando entraste con tu correo:
// al abrir la app, al volver a ella, al recuperar internet y unos
// segundos después de cada cambio. Si este dispositivo y la nube
// cambiaron a la vez, pregunta cuál conservar.

const AFTER_CHANGE_MS = 15_000
const NOTICE = 'memora-aviso-sincronizado'

export default function CloudSync() {
  const [conflict, setConflict] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(() => {
    try {
      const n = sessionStorage.getItem(NOTICE)
      sessionStorage.removeItem(NOTICE)
      return n
    } catch {
      return null
    }
  })
  const running = useRef(false)

  const afterDownload = () => {
    try {
      sessionStorage.setItem(NOTICE, 'Se trajeron tus cambios de tu otro dispositivo.')
    } catch {
      // sin almacenamiento
    }
    location.reload()
  }

  const sync = useCallback(async () => {
    if (running.current || !maybeSignedIn() || !navigator.onLine) return
    running.current = true
    try {
      const { syncNow } = await import('../lib/cloud')
      const { action } = await syncNow()
      if (action === 'download') afterDownload()
      setConflict(action === 'conflict')
    } catch (e) {
      console.warn('[Memora] No se pudo sincronizar:', e)
    } finally {
      running.current = false
    }
  }, [])

  useEffect(() => {
    void sync()
    let timer: ReturnType<typeof setTimeout> | undefined
    const stop = onLocalChange(() => {
      clearTimeout(timer)
      timer = setTimeout(() => void sync(), AFTER_CHANGE_MS)
    })
    const onVisible = () => document.visibilityState === 'visible' && void sync()
    const onOnline = () => void sync()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    window.addEventListener('memora-sync', onOnline)
    return () => {
      stop()
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('memora-sync', onOnline)
    }
  }, [sync])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(t)
  }, [notice])

  const keep = async (side: 'cloud' | 'device') => {
    setBusy(true)
    try {
      const { resolveConflict } = await import('../lib/cloud')
      await resolveConflict(side)
      setConflict(false)
      if (side === 'cloud') afterDownload()
      else setNotice('Listo: la nube ahora tiene lo de este dispositivo.')
    } catch (e) {
      setNotice((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (conflict)
    return (
      <div className="card sync-conflict" role="alertdialog" aria-label="Elegir qué copia conservar">
        <p>
          <strong>☁️ Tienes cambios en este dispositivo y también en tu otro dispositivo.</strong>
        </p>
        <p className="muted">Elige cuál conservar. La otra se reemplazará.</p>
        <div className="card-actions">
          <button className="btn btn-small" disabled={busy} onClick={() => void keep('cloud')}>
            Usar la de la nube
          </button>
          <button className="btn btn-small btn-ghost" disabled={busy} onClick={() => void keep('device')}>
            Usar la de este dispositivo
          </button>
        </div>
      </div>
    )

  if (notice)
    return (
      <p className="toast sync-notice" role="status">
        {notice}
      </p>
    )

  return null
}

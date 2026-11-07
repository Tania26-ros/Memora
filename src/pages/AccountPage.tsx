import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { checkBackup, describeBackup, exportAll, restoreAll, type Backup } from '../lib/backup'
import { cloudEnabled, currentUser, fetchCloudBackup, lastSynced, restoreFromCloud, sendLoginCode, signOut, uploadBackup, verifyLoginCode } from '../lib/cloud'
import { downloadFile } from '../lib/document'
import { dayKey } from '../lib/progress'

const when = (t: number) => new Date(t).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })

// Cuenta y copias: guardar todo en un archivo o en la nube, y traerlo a otro equipo.
export default function AccountPage() {
  return (
    <section>
      <nav className="crumbs">
        <Link to="/ajustes">← Ajustes</Link>
      </nav>
      <h1 className="page-title">Cuenta y copias</h1>
      <p className="lead">Todo lo que haces en Memora se guarda en este dispositivo. Haz copias para no perderlo si cambias o pierdes el celular.</p>
      <CloudCard />
      <FileBackupCard />
    </section>
  )
}

// ── Copia en un archivo ──────────────────────────────────────
function FileBackupCard() {
  const [withFiles, setWithFiles] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Backup | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const download = async () => {
    setBusy(true)
    try {
      const b = await exportAll({ includeFiles: withFiles })
      downloadFile(JSON.stringify(b), `memora-copia-${dayKey()}.json`, 'application/json')
      setMsg({ ok: true, text: `Copia descargada: ${describeBackup(b)}. Guárdala en tu Drive o envíatela por correo.` })
    } finally {
      setBusy(false)
    }
  }

  const pick = async (file: File | undefined) => {
    if (!file) return
    setMsg(null)
    try {
      const data = JSON.parse(await file.text())
      const problem = checkBackup(data)
      if (problem) return setMsg({ ok: false, text: problem })
      setPending(data)
    } catch {
      setMsg({ ok: false, text: 'No se pudo leer el archivo. ¿Es una copia de Memora (.json)?' })
    }
  }

  return (
    <div className="card settings-section">
      <h2>💾 Copia en un archivo</h2>
      <p className="muted">Funciona sin internet y sin cuenta. Descarga la copia y ábrela en otro celular con «Restaurar».</p>
      <label className="check">
        <input type="checkbox" checked={withFiles} onChange={(e) => setWithFiles(e.target.checked)} />
        Incluir mis archivos (PDF, fotos…). La copia pesará más.
      </label>
      <div className="card-actions">
        <button className="btn btn-small" disabled={busy} onClick={() => void download()}>
          {busy ? 'Preparando…' : '⬇ Descargar copia'}
        </button>
        <label className="btn btn-small btn-ghost">
          ⬆ Restaurar copia
          <input type="file" accept="application/json,.json" hidden onChange={(e) => void pick(e.target.files?.[0])} />
        </label>
      </div>
      {pending && <ConfirmRestore backup={pending} onCancel={() => setPending(null)} onConfirm={async () => (await restoreAll(pending), location.assign('/'))} />}
      {msg && <p className={msg.ok ? 'form-ok' : 'form-error'}>{msg.text}</p>}
    </div>
  )
}

function ConfirmRestore({ backup, onConfirm, onCancel }: { backup: Backup; onConfirm: () => Promise<void>; onCancel: () => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="confirm-box" role="alertdialog" aria-label="Confirmar restauración">
      <p>
        <strong>¿Reemplazar todo lo de este dispositivo?</strong>
      </p>
      <p>
        La copia es del {when(backup.exportedAt)} y tiene {describeBackup(backup)}. Lo que tienes ahora en este dispositivo se reemplazará.
      </p>
      <div className="card-actions">
        <button className="btn btn-small" disabled={busy} onClick={() => (setBusy(true), void onConfirm())}>
          {busy ? 'Restaurando…' : 'Sí, restaurar'}
        </button>
        <button className="btn btn-small btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Nube ─────────────────────────────────────────────────────
function CloudCard() {
  const [user, setUser] = useState<{ email?: string } | null | undefined>(undefined)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [cloudCopy, setCloudCopy] = useState<Backup | null>(null)
  const [synced, setSynced] = useState(lastSynced)

  useEffect(() => {
    if (!cloudEnabled()) return
    let alive = true
    void currentUser().then((u) => alive && setUser(u))
    return () => {
      alive = false
    }
  }, [])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  if (!cloudEnabled())
    return (
      <div className="card settings-section">
        <h2>☁️ Cuenta en la nube</h2>
        <p>La nube todavía no está activada en esta versión de Memora. Cuando lo esté, podrás entrar con tu correo y tener tus cuadernos en el celular y en la computadora.</p>
        <p className="muted">Mientras tanto, usa la copia en archivo de abajo para no perder nada.</p>
      </div>
    )

  if (user === undefined) return null

  if (!user)
    return (
      <div className="card settings-section">
        <h2>☁️ Entrar con tu correo</h2>
        <p className="muted">Sin contraseña: te enviamos un código de 6 dígitos. Es gratis.</p>
        <form
          className="q-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (step === 'email')
              void run(async () => {
                await sendLoginCode(email)
                setStep('code')
                setMsg({ ok: true, text: `Te enviamos un código a ${email}. Revisa también «Spam» o «Promociones».` })
              })
            else
              void run(async () => {
                await verifyLoginCode(email, code)
                setUser(await currentUser())
              })
          }}
        >
          {step === 'email' ? (
            <label className="field" htmlFor="login-email">
              <span>Correo</span>
              <input id="login-email" type="email" inputMode="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          ) : (
            <label className="field" htmlFor="login-code">
              <span>Código del correo</span>
              <input id="login-code" inputMode="numeric" autoComplete="one-time-code" required className="input" value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
          )}
          <div className="card-actions">
            <button className="btn btn-small" disabled={busy}>
              {step === 'email' ? 'Enviarme el código' : 'Entrar'}
            </button>
            {step === 'code' && (
              <button type="button" className="btn btn-small btn-ghost" onClick={() => (setStep('email'), setCode(''))}>
                Cambiar correo
              </button>
            )}
          </div>
        </form>
        {msg && <p className={msg.ok ? 'form-ok' : 'form-error'}>{msg.text}</p>}
      </div>
    )

  return (
    <div className="card settings-section">
      <h2>☁️ Tu cuenta</h2>
      <p>
        Entraste como <strong>{user.email}</strong>.
      </p>
      <p className="muted">{synced ? `Última copia en la nube: ${when(synced)}.` : 'Todavía no has subido ninguna copia.'}</p>
      <div className="card-actions">
        <button
          className="btn btn-small"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const b = await uploadBackup()
              setSynced(b.exportedAt)
              setMsg({ ok: true, text: `Listo: se guardaron ${describeBackup(b)} en la nube.` })
            })
          }
        >
          ⬆ Guardar en la nube
        </button>
        <button
          className="btn btn-small btn-ghost"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const b = await fetchCloudBackup()
              if (!b) setMsg({ ok: false, text: 'Todavía no hay ninguna copia en la nube. Sube una desde el equipo donde tienes tus cuadernos.' })
              else setCloudCopy(b)
            })
          }
        >
          ⬇ Traer de la nube
        </button>
        <button className="btn btn-small btn-ghost" disabled={busy} onClick={() => void run(async () => (await signOut(), setUser(null)))}>
          Salir
        </button>
      </div>
      {cloudCopy && (
        <ConfirmRestore
          backup={cloudCopy}
          onCancel={() => setCloudCopy(null)}
          onConfirm={async () => {
            await restoreFromCloud(cloudCopy)
            location.assign('/')
          }}
        />
      )}
      {msg && <p className={msg.ok ? 'form-ok' : 'form-error'}>{msg.text}</p>}
    </div>
  )
}

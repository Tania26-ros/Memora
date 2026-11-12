import { useRef, useState } from 'react'

// Botón cuadradito para copiar un texto (por ejemplo, para buscar su significado).
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Navegadores antiguos o sin permiso: copiar con un campo temporal.
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    el.remove()
    return ok
  }
}

export default function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  return (
    <button
      type="button"
      className={`btn btn-ghost copy-btn ${done ? 'copied' : ''}`}
      aria-label={done ? 'Copiado' : `${label} «${text}»`}
      title={done ? 'Copiado' : label}
      disabled={!text.trim()}
      onClick={async () => {
        if (!(await copyText(text))) return
        setDone(true)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setDone(false), 1500)
      }}
    >
      {done ? '✓' : '⧉'}
    </button>
  )
}

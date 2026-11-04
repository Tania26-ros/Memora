import { useEffect, useState, type ReactNode } from 'react'

// Botón de borrar en dos toques: el primero pide confirmación,
// el segundo borra. Evita borrar algo importante por accidente.
export default function ConfirmButton({
  onConfirm,
  children,
  confirmText = '¿Seguro? Toca otra vez',
  label,
}: {
  onConfirm: () => void
  children: ReactNode
  confirmText?: string
  label: string
}) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <button
      type="button"
      aria-label={armed ? confirmText : label}
      title={label}
      className={`btn btn-small ${armed ? 'btn-danger' : 'btn-ghost'}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (armed) onConfirm()
        else setArmed(true)
      }}
    >
      {armed ? confirmText : children}
    </button>
  )
}

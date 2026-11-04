import { useEffect, useLayoutEffect, useRef, useState } from 'react'
// "?url" le dice a Vite que copie el archivo y nos dé su dirección.
// Son los nombres de los emojis en español, para poder buscarlos ("libro", "corazón"...).
import dataSource from 'emoji-picker-element-data/es/cldr/data.json?url'

// Selector completo de emojis (caritas, animales, comida, objetos, símbolos,
// banderas...), con buscador en español, tonos de piel y "usados recientemente".
// Usa la librería emoji-picker-element. La cargamos solo cuando se abre
// (import dinámico) para que la app arranque rápido.
export default function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)
  const onPickRef = useRef(onPick)
  useLayoutEffect(() => {
    onPickRef.current = onPick
  })

  useEffect(() => {
    let picker: HTMLElement | null = null
    const state = { cancelled: false }
    Promise.all([import('emoji-picker-element'), import('emoji-picker-element/i18n/es.js')])
      .then(([{ Picker }, { default: es }]) => {
        if (state.cancelled || !box.current) return
        picker = new Picker({ locale: 'es', dataSource, i18n: es })
        picker.addEventListener('emoji-click', (e) => {
          const unicode = (e as CustomEvent<{ unicode?: string }>).detail.unicode
          if (unicode) onPickRef.current(unicode)
        })
        box.current.appendChild(picker)
      })
      .catch(() => setError(true))
    return () => {
      state.cancelled = true
      picker?.remove()
    }
  }, [])

  if (error) return <p className="muted">No se pudo abrir el selector de emojis. Revisa tu conexión y vuelve a intentarlo.</p>
  return <div ref={box} className="emoji-picker" />
}

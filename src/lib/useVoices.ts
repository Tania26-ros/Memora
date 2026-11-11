import { useEffect, useState } from 'react'
import { canSpeak, voicesFor } from './speech'

/** Lista de voces del celular; se actualiza cuando terminan de cargar. */
export function useVoices(lang: string) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!canSpeak()) return
    const on = () => setTick((t) => t + 1)
    speechSynthesis.addEventListener('voiceschanged', on)
    return () => speechSynthesis.removeEventListener('voiceschanged', on)
  }, [])
  return voicesFor(lang)
}

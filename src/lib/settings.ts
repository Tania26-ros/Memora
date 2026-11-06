import { useSyncExternalStore } from 'react'

// Preferencias del estudiante. Se guardan en este dispositivo (localStorage)
// y se usan como valores por defecto en cada juego.
export interface Settings {
  sound: boolean
  animations: boolean
  vibration: boolean
  timerOn: boolean
  timerSeconds: number
  doseSize: number
  repeatUntil: number
  shuffle: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  animations: true,
  vibration: true,
  timerOn: true,
  timerSeconds: 10,
  doseSize: 10,
  repeatUntil: 2,
  shuffle: false,
}

/** Opciones de tiempo por pregunta: de 5 segundos a 5 minutos. */
export const TIMER_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300]

export function timerLabel(s: number) {
  return s < 60 ? `${s} s` : `${s / 60} min`
}

const KEY = 'memora-ajustes'
let current: Settings = load()
const listeners = new Set<() => void>()

function load(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function getSettings() {
  return current
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // Sin almacenamiento (modo privado): se usan solo durante esta visita.
  }
  listeners.forEach((l) => l())
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}

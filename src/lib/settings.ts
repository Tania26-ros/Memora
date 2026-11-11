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
  /** Mostrar el botón «Ver pista» en las preguntas que tienen pista. */
  hints: boolean
  /** Estilo visual de toda la app. */
  theme: ThemeId
  /** Tamaño de la letra: 1 = normal. */
  textScale: number
  /** Preguntas que quieres responder cada día. */
  dailyGoal: number
  /** Idioma de la voz: 'auto' = adivinarlo por el texto. */
  voiceLang: string
  voiceRate: number
  /** Leer cada pregunta en voz alta al aparecer. */
  autoRead: boolean
  /** Lector tipo libro: tamaño de letra, color del papel e interlineado. */
  readerScale: number
  paper: PaperId
  readerSpacing: number
  /** Mostrar a Memo, la mascota que guía y anima. */
  mascot: boolean
}

export type PaperId = 'blanco' | 'crema' | 'sepia' | 'noche'
export const PAPERS: { id: PaperId; label: string; bg: string; fg: string }[] = [
  { id: 'blanco', label: 'Blanco', bg: '#ffffff', fg: '#1a1a1a' },
  { id: 'crema', label: 'Crema', bg: '#fbf5e6', fg: '#2b2418' },
  { id: 'sepia', label: 'Sepia', bg: '#f1e2c4', fg: '#3d2f1c' },
  { id: 'noche', label: 'Noche', bg: '#1b1b1f', fg: '#e6e2d8' },
]

export type ThemeId = 'clasico' | 'oscuro' | 'minimalista' | 'vintage' | 'pastel' | 'neon' | 'naturaleza'

/** swatch = colores para la vista previa: fondo, tarjeta, color principal, texto. */
export const THEMES: { id: ThemeId; label: string; hint: string; swatch: [string, string, string, string] }[] = [
  { id: 'clasico', label: 'Clásico', hint: 'Claro u oscuro según tu celular', swatch: ['#f6f5fb', '#ffffff', '#5b4cf0', '#1c1a29'] },
  { id: 'oscuro', label: 'Oscuro', hint: 'Descansa la vista de noche', swatch: ['#121019', '#1c1926', '#8b7dff', '#edeaf7'] },
  { id: 'minimalista', label: 'Minimalista', hint: 'Blanco y negro, sin distracciones', swatch: ['#ffffff', '#ffffff', '#111111', '#111111'] },
  { id: 'vintage', label: 'Vintage', hint: 'Papel antiguo y letra clásica', swatch: ['#f3ead7', '#fbf6ea', '#8b4a1c', '#3b2f22'] },
  { id: 'pastel', label: 'Pastel', hint: 'Rosa suave y bordes redondos', swatch: ['#fff4f8', '#ffffff', '#e2557f', '#40263a'] },
  { id: 'neon', label: 'Neón', hint: 'Oscuro con colores brillantes', swatch: ['#0a0a16', '#13132b', '#00e5ff', '#e8f7ff'] },
  { id: 'naturaleza', label: 'Naturaleza', hint: 'Verdes tranquilos', swatch: ['#eff5ec', '#ffffff', '#2f7d32', '#1f2d1f'] },
]

export const TEXT_SCALES = [
  { value: 1, label: 'Normal' },
  { value: 1.12, label: 'Grande' },
  { value: 1.25, label: 'Muy grande' },
]

export const DAILY_GOALS = [
  { value: 5, label: 'Suave', hint: 'Responder 5 preguntas al día' },
  { value: 10, label: 'Normal', hint: 'Responder 10 preguntas al día' },
  { value: 20, label: 'Intensa', hint: 'Responder 20 preguntas al día' },
  { value: 30, label: 'Maratón', hint: 'Responder 30 preguntas al día' },
]

/** Antes la meta se medía en puntos (30, 60, 120, 250): se pasa a preguntas. */
const OLD_GOALS: Record<number, number> = { 60: 10, 120: 20, 250: 30 }

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  animations: true,
  vibration: true,
  timerOn: true,
  timerSeconds: 10,
  doseSize: 10,
  repeatUntil: 2,
  shuffle: false,
  hints: true,
  theme: 'clasico',
  textScale: 1,
  dailyGoal: 10,
  voiceLang: 'auto',
  voiceRate: 1,
  autoRead: false,
  readerScale: 1.2,
  paper: 'crema',
  readerSpacing: 1.7,
  mascot: true,
}

export const VOICE_RATES = [
  { value: 0.75, label: 'Lenta' },
  { value: 1, label: 'Normal' },
  { value: 1.25, label: 'Rápida' },
]

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
    const saved: Settings = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
    if (!DAILY_GOALS.some((g) => g.value === saved.dailyGoal)) saved.dailyGoal = OLD_GOALS[saved.dailyGoal] ?? (saved.dailyGoal === 30 ? 5 : 10)
    return saved
  } catch {
    return DEFAULT_SETTINGS
  }
}

/** Aplica el estilo y el tamaño de letra a toda la página. */
function applyLook(s: Settings) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = s.theme
  root.style.fontSize = s.textScale === 1 ? '' : `${s.textScale * 100}%`
  // Color de la barra del navegador en el celular.
  const bar = THEMES.find((t) => t.id === s.theme)?.swatch[0]
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', s.theme === 'clasico' ? '#5b4cf0' : (bar ?? '#5b4cf0'))
}
applyLook(current)

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
  applyLook(current)
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

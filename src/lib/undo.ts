import { useSyncExternalStore } from 'react'

// Un aviso pequeño abajo de la pantalla con el botón "Deshacer".
// Es un "store" mínimo: cualquier parte de la app puede llamar showUndo(),
// y el componente <UndoToast> se entera y se muestra.
export interface UndoItem {
  id: number
  message: string
  undo: () => Promise<void> | void
}

let current: UndoItem | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const UNDO_SECONDS = 8

export function showUndo(message: string, undo: UndoItem['undo']) {
  clearTimeout(timer)
  current = { id: Date.now(), message, undo }
  emit()
  timer = setTimeout(dismissUndo, UNDO_SECONDS * 1000)
}

export function dismissUndo() {
  clearTimeout(timer)
  current = null
  emit()
}

export function useUndo() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'

// localStorage de mentira (las pruebas corren fuera del navegador)
const store = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size
  },
} as Storage

const { MemoraDB, createNotebook } = await import('./db')
const { decide, hasLocalChanges, markInSync, pendingSince, trackChanges, withoutTracking } = await import('./sync')

describe('decidir qué sincronizar', () => {
  it('no hace nada si nada cambió', () => {
    expect(decide({ remote: 'v1', known: 'v1', dirty: false })).toBe('nothing')
    expect(decide({ remote: null, known: null, dirty: false })).toBe('nothing')
  })
  it('sube si solo cambió este dispositivo', () => {
    expect(decide({ remote: 'v1', known: 'v1', dirty: true })).toBe('upload')
    expect(decide({ remote: null, known: null, dirty: true })).toBe('upload')
  })
  it('trae si solo cambió la nube', () => {
    expect(decide({ remote: 'v2', known: 'v1', dirty: false })).toBe('download')
    expect(decide({ remote: 'v1', known: null, dirty: false })).toBe('download')
  })
  it('pregunta si cambiaron los dos', () => {
    expect(decide({ remote: 'v2', known: 'v1', dirty: true })).toBe('conflict')
  })
})

describe('anotar los cambios locales', () => {
  beforeEach(() => store.clear())

  it('anota crear, editar y borrar, y se limpia al sincronizar', async () => {
    const d = new MemoraDB('sync-a')
    trackChanges(d)
    expect(await hasLocalChanges(d)).toBe(false)

    const id = await createNotebook({ name: 'Inglés', color: '#000', emoji: '📘' }, d)
    expect(await hasLocalChanges(d)).toBe(true)

    markInSync('v1')
    expect(await hasLocalChanges(d)).toBe(false)

    await d.notebooks.update(id, { name: 'Francés' })
    expect(await hasLocalChanges(d)).toBe(true)
    markInSync('v2')

    await d.notebooks.delete(id)
    expect(await hasLocalChanges(d)).toBe(true)
  })

  it('no cuenta lo que llega de la nube', async () => {
    const d = new MemoraDB('sync-b')
    trackChanges(d)
    markInSync('v1')
    await withoutTracking(() => createNotebook({ name: 'Copia', color: '#000', emoji: '📘' }, d))
    expect(await hasLocalChanges(d)).toBe(false)
  })

  it('si hubo cambios mientras se subía, siguen pendientes', async () => {
    const d = new MemoraDB('sync-c')
    trackChanges(d)
    await createNotebook({ name: 'A', color: '#000', emoji: '📘' }, d)
    const snapshot = pendingSince()
    store.set('memora-cambios-sin-subir', String((snapshot ?? 0) + 1)) // otro cambio durante la subida
    markInSync('v1', snapshot)
    expect(await hasLocalChanges(d)).toBe(true)
  })

  it('un dispositivo con cuadernos de antes cuenta como cambiado', async () => {
    const d = new MemoraDB('sync-d')
    await createNotebook({ name: 'Viejo', color: '#000', emoji: '📘' }, d)
    expect(pendingSince()).toBeNull()
    expect(await hasLocalChanges(d)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
// Preguntas de Memora: tipos y cómo se comprueba cada respuesta.
// Todo aquí son "funciones puras": reciben datos y devuelven un
// resultado, sin tocar la base de datos. Así es fácil probarlas.
// ─────────────────────────────────────────────────────────────

export type Difficulty = 'facil' | 'regular' | 'dificil'

export const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'facil', label: 'Fácil' },
  { value: 'regular', label: 'Regular' },
  { value: 'dificil', label: 'Difícil' },
]

interface Base {
  id: number
  topicId: number
  difficulty: Difficulty
  /** Por qué la respuesta es la correcta (y las otras no). */
  explanation?: string
  starred?: boolean
  createdAt: number
}

export interface McqQuestion extends Base {
  type: 'mcq'
  prompt: string
  options: string[]
  /** Posición de la alternativa correcta (0 = la primera). */
  correct: number
}

export interface TfQuestion extends Base {
  type: 'tf'
  prompt: string
  correct: boolean
}

export interface MatchQuestion extends Base {
  type: 'match'
  prompt: string
  pairs: { left: string; right: string }[]
}

export interface OpenQuestion extends Base {
  type: 'open'
  prompt: string
  answer: string
}

/** Párrafo con espacios en blanco. En el texto, cada espacio es [[0]], [[1]]... */
export interface ClozeQuestion extends Base {
  type: 'cloze'
  prompt: string
  text: string
  blanks: { answer: string; distractors: string[] }[]
}

export type Question = McqQuestion | TfQuestion | MatchQuestion | OpenQuestion | ClozeQuestion
export type QuestionType = Question['type']
/** Una pregunta antes de guardarla (todavía sin id). */
export type NewQuestion = Omit<McqQuestion, 'id'> | Omit<TfQuestion, 'id'> | Omit<MatchQuestion, 'id'> | Omit<OpenQuestion, 'id'> | Omit<ClozeQuestion, 'id'>

export const QUESTION_TYPES: { value: QuestionType; label: string; hint: string }[] = [
  { value: 'mcq', label: 'Opción múltiple', hint: 'Marcar una alternativa' },
  { value: 'tf', label: 'Verdadero o falso', hint: 'Decidir si la frase es cierta' },
  { value: 'match', label: 'Unir columnas', hint: 'Emparejar conceptos' },
  { value: 'cloze', label: 'Completar espacios', hint: 'Elegir la palabra que falta' },
  { value: 'open', label: 'Pregunta abierta', hint: 'Responder y comparar' },
]

export const LETTERS = 'abcdefghij'

// ── Completar espacios ───────────────────────────────────────
// En el editor escribes el párrafo con las palabras clave entre corchetes:
//   "La [mitocondria] produce [ATP] para la célula."
// parseClozeDraft lo convierte en el texto con marcas [[0]], [[1]] y la lista de respuestas.
export function parseClozeDraft(draft: string): { text: string; answers: string[] } {
  const answers: string[] = []
  const text = draft.replace(/\[([^\][]+)\]/g, (_, word: string) => {
    answers.push(word.trim())
    return `[[${answers.length - 1}]]`
  })
  return { text, answers }
}

/** Lo inverso: vuelve a poner las respuestas entre corchetes para editar. */
export function clozeToDraft(q: Pick<ClozeQuestion, 'text' | 'blanks'>): string {
  return q.text.replace(/\[\[(\d+)\]\]/g, (_, i: string) => `[${q.blanks[Number(i)]?.answer ?? ''}]`)
}

/** Divide el texto en trozos: texto normal y espacios en blanco. */
export function clozeSegments(text: string): ({ kind: 'text'; value: string } | { kind: 'blank'; index: number })[] {
  const out: ({ kind: 'text'; value: string } | { kind: 'blank'; index: number })[] = []
  const re = /\[\[(\d+)\]\]/g
  let last = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ kind: 'text', value: text.slice(last, m.index) })
    out.push({ kind: 'blank', index: Number(m[1]) })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ kind: 'text', value: text.slice(last) })
  return out
}

// ── Comprobar respuestas ─────────────────────────────────────

export function checkMcq(q: McqQuestion, picked: number) {
  return picked === q.correct
}

export function checkTf(q: TfQuestion, picked: boolean) {
  return picked === q.correct
}

/** picked[i] = índice del elemento de la derecha que se unió con el elemento i de la izquierda. */
export function checkMatch(q: MatchQuestion, picked: number[]) {
  return q.pairs.length === picked.length && picked.every((right, left) => right === left)
}

/** picked[i] = palabra elegida para el espacio i. */
export function checkCloze(q: ClozeQuestion, picked: string[]) {
  return q.blanks.every((b, i) => normalize(picked[i] ?? '') === normalize(b.answer))
}

export function normalize(s: string) {
  return s.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

/** Texto corto de la respuesta correcta, para "Estudiar primero" y las explicaciones. */
export function correctAnswerText(q: Question): string {
  switch (q.type) {
    case 'mcq':
      return `${LETTERS[q.correct]}) ${q.options[q.correct]}`
    case 'tf':
      return q.correct ? 'Verdadero' : 'Falso'
    case 'match':
      return q.pairs.map((p) => `${p.left} → ${p.right}`).join(' · ')
    case 'open':
      return q.answer
    case 'cloze':
      return q.blanks.map((b) => b.answer).join(' · ')
  }
}

/** Revisa que una pregunta esté completa antes de guardarla. Devuelve el problema o null. */
export function validateQuestion(q: NewQuestion): string | null {
  if (q.type !== 'cloze' && !q.prompt.trim()) return 'Escribe la pregunta.'
  switch (q.type) {
    case 'mcq':
      if (q.options.filter((o) => o.trim()).length < 2) return 'Escribe al menos 2 alternativas.'
      if (!q.options[q.correct]?.trim()) return 'Marca cuál alternativa es la correcta.'
      return null
    case 'tf':
      return null
    case 'match':
      if (q.pairs.filter((p) => p.left.trim() && p.right.trim()).length < 2) return 'Escribe al menos 2 parejas completas.'
      return null
    case 'open':
      return q.answer.trim() ? null : 'Escribe la respuesta esperada.'
    case 'cloze':
      if (q.blanks.length < 1) return 'Pon entre [corchetes] al menos una palabra del párrafo.'
      if (q.blanks.length > 3) return 'Usa como máximo 3 espacios por párrafo.'
      if (q.blanks.some((b) => b.distractors.filter((d) => d.trim()).length < 1)) return 'Escribe al menos 1 alternativa incorrecta para cada espacio.'
      return null
  }
}

/** Mezcla una lista (algoritmo de Fisher-Yates). rand se puede fijar en las pruebas. */
export function shuffle<T>(list: T[], rand: () => number = Math.random): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Hora actual en milisegundos (separada para poder fijarla en pruebas). */
export const nowMs = () => Date.now()

import { validateQuestion, normalize, type Difficulty, type NewQuestion } from './questions'

// ─────────────────────────────────────────────────────────────
// Pegado inteligente (sin IA).
// Convierte un texto copiado de un examen o cuestionario en preguntas.
// Reconoce lo que se escribe normalmente en los exámenes:
//
//   1. ¿Qué orgánulo produce energía?
//   a) Ribosoma
//   b) Mitocondria
//   Respuesta: b
//   Explicación: ...
//   Pista: ...
//
// Si algo no queda claro, la pregunta se marca para que la revises.
// ─────────────────────────────────────────────────────────────

export interface ParsedQuestion {
  question: NewQuestion
  /** Qué falta o qué hay que revisar; null si está completa. */
  problem: string | null
}

const QUESTION_START = /^\s*(?:pregunta\s*)?(\d{1,3})\s*[.)\-:]\s*(.*)$/i
const OPTION = /^\s*\(?([a-jA-J])\s*[).\-:]\s+(.+)$/
const ANSWER = /^\s*(?:respuesta(?:\s+correcta)?|rpta|resp|clave|correcta|soluci[oó]n|answer)\s*\.?\s*[:=-]?\s*(.+)$/i
const EXPLANATION = /^\s*(?:explicaci[oó]n|justificaci[oó]n|fundamento|porque|nota)\s*[:-]\s*(.+)$/i
const HINT = /^\s*pista\s*[:-]\s*(.+)$/i
const MARKED = /\s*(?:\*|✓|✔|\(correcta\)|\[correcta\])\s*$/i
const TRUE_WORDS = ['v', 'verdadero', 'verdadera', 'true', 'cierto', 'si', 'sí']
const FALSE_WORDS = ['f', 'falso', 'falsa', 'false']

/** Separa el texto en bloques, uno por pregunta. */
export function splitBlocks(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const numbered = lines.some((l) => QUESTION_START.test(l))
  const blocks: string[][] = []
  let current: string[] = []
  const flush = () => {
    if (current.some((l) => l.trim())) blocks.push(current)
    current = []
  }
  for (const line of lines) {
    if (numbered ? QUESTION_START.test(line) && !OPTION.test(line) : !line.trim()) flush()
    if (line.trim()) current.push(line)
  }
  flush()
  return blocks
}

function isTrue(s: string) {
  return TRUE_WORDS.includes(normalize(s).replace(/[().]/g, ''))
}
function isFalse(s: string) {
  return FALSE_WORDS.includes(normalize(s).replace(/[().]/g, ''))
}

export function parseBlock(block: string[], topicId: number, difficulty: Difficulty = 'regular'): ParsedQuestion {
  const promptLines: string[] = []
  const options: { text: string; marked: boolean }[] = []
  let answer = ''
  let explanation = ''
  let hint = ''

  block.forEach((raw, i) => {
    let line = raw
    if (i === 0) {
      const m = QUESTION_START.exec(line)
      if (m) line = m[2]
    }
    let m: RegExpExecArray | null
    if ((m = ANSWER.exec(line))) answer = m[1].trim()
    else if ((m = EXPLANATION.exec(line))) explanation = m[1].trim()
    else if ((m = HINT.exec(line))) hint = m[1].trim()
    else if ((m = OPTION.exec(line)) && (options.length > 0 || promptLines.length > 0)) {
      const marked = MARKED.test(m[2])
      options.push({ text: m[2].replace(MARKED, '').trim(), marked })
    } else if (options.length === 0) promptLines.push(line.trim())
    else options[options.length - 1].text += ' ' + line.trim() // alternativa en dos líneas
  })

  let prompt = promptLines.join(' ').replace(/\s+/g, ' ').trim()
  const common = { topicId, difficulty, explanation: explanation || undefined, hint: hint || undefined, createdAt: 0 }

  // Verdadero o falso: "(V)" o "(F)" al final, o respuesta V/F, o alternativas Verdadero/Falso.
  const tfMark = /\(\s*(V|F)\s*\)\s*$/i.exec(prompt)
  const tfOptions = options.length === 2 && options.some((o) => isTrue(o.text)) && options.some((o) => isFalse(o.text))
  if (tfMark || (options.length === 0 && (isTrue(answer) || isFalse(answer))) || tfOptions) {
    let correct: boolean | null = null
    if (tfMark) {
      correct = tfMark[1].toUpperCase() === 'V'
      prompt = prompt.replace(tfMark[0], '').trim()
    } else if (tfOptions) {
      const marked = options.find((o) => o.marked)
      const byLetter = answerLetter(answer)
      const chosen = marked ?? (byLetter !== null ? options[byLetter] : options.find((o) => normalize(o.text) === normalize(answer)))
      if (chosen) correct = isTrue(chosen.text)
      else if (isTrue(answer) || isFalse(answer)) correct = isTrue(answer)
    } else correct = isTrue(answer)
    const question: NewQuestion = { ...common, type: 'tf', prompt, correct: correct ?? true }
    return { question, problem: correct === null ? 'Falta indicar si es verdadera o falsa.' : validateQuestion(question) }
  }

  if (options.length >= 2) {
    let correct = options.findIndex((o) => o.marked)
    if (correct === -1) {
      const byLetter = answerLetter(answer)
      if (byLetter !== null && byLetter < options.length) correct = byLetter
      else if (answer) correct = options.findIndex((o) => normalize(o.text) === normalize(answer))
    }
    const question: NewQuestion = { ...common, type: 'mcq', prompt, options: options.map((o) => o.text), correct: Math.max(0, correct) }
    return { question, problem: correct === -1 ? 'Falta marcar la alternativa correcta.' : validateQuestion(question) }
  }

  const question: NewQuestion = { ...common, type: 'open', prompt, answer }
  return { question, problem: answer ? validateQuestion(question) : 'Falta la respuesta. Escríbela o se jugará como tarjeta sin respuesta.' }
}

/** "b", "b)", "(B)", "Alternativa b", "b. Mitocondria" → 1 */
function answerLetter(answer: string): number | null {
  const m = /^\s*(?:alternativa|opci[oó]n|letra)?\s*\(?([a-jA-J])\)?(?:[).\-:\s]|$)/i.exec(answer)
  return m ? 'abcdefghij'.indexOf(m[1].toLowerCase()) : null
}

export function parseQuestionsText(text: string, topicId: number, difficulty: Difficulty = 'regular'): ParsedQuestion[] {
  return splitBlocks(text)
    .map((b) => parseBlock(b, topicId, difficulty))
    .filter((p) => p.question.type === 'mcq' || p.question.prompt)
}

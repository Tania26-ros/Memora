import type { Question } from './questions'
import { getSettings } from './settings'
import { detectLang, speak, stopSpeaking } from './speech'

/** Idioma para leer un texto: el elegido en Ajustes o el que se adivine. */
export function langFor(text: string) {
  const s = getSettings()
  return s.voiceLang === 'auto' ? detectLang(text) : s.voiceLang
}

/** Lee un texto con el idioma y velocidad de Ajustes. */
export function say(text: string, lang = langFor(text)) {
  stopSpeaking()
  return speak(text, lang, getSettings().voiceRate)
}

/** Lo que se lee en voz alta de una pregunta (la pregunta y sus alternativas). */
export function questionSpeech(q: Question): string {
  const letters = 'abcdefghij'
  switch (q.type) {
    case 'mcq':
      return `${q.prompt}. ${q.options.map((o, i) => `${letters[i]}: ${o}.`).join(' ')}`
    case 'tf':
      return `${q.prompt}. ¿Verdadero o falso?`
    case 'cloze':
      return q.text.replace(/\[\[\d+\]\]/g, ' ... ')
    case 'order':
      return `${q.prompt}: ${q.items.join(', ')}.`
    case 'classify':
      return `${q.prompt}: ${q.groups.map((g) => g.name).join(' o ')}.`
    default:
      return q.prompt
  }
}

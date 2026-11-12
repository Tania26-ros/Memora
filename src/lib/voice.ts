import type { Question } from './questions'
import { getSettings } from './settings'
import { detectLang, speak, stopSpeaking } from './speech'

/** Idioma para leer un texto: el elegido en Ajustes o el que se adivine. */
export function langFor(text: string) {
  const s = getSettings()
  return s.voiceLang === 'auto' ? detectLang(text) : s.voiceLang
}

/** Voz y estilo elegidos en Ajustes para ese idioma. */
export function voiceOptions(lang: string) {
  const s = getSettings()
  return { voiceURI: s.voices[lang.split('-')[0].toLowerCase()], style: s.voiceStyle }
}

/** Lee un texto con el idioma, la voz y la velocidad de Ajustes. slow = más lento (para entender mejor). */
export function say(text: string, lang = langFor(text), slow = false) {
  stopSpeaking()
  const rate = getSettings().voiceRate
  return speak(text, lang, slow ? Math.max(0.35, rate * 0.6) : rate, voiceOptions(lang))
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

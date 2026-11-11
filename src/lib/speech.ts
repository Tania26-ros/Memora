// ─────────────────────────────────────────────────────────────
// Voz: leer en voz alta y escuchar al micrófono.
// Usa lo que ya trae el navegador del celular (sin pagar ninguna IA):
//  - speechSynthesis: convierte texto en voz.
//  - SpeechRecognition: convierte tu voz en texto (en Chrome/Android y Safari/iPhone).
// Si algo no está disponible, la app lo avisa y ofrece otra forma.
// ─────────────────────────────────────────────────────────────

export const LANGUAGES = [
  { code: 'es-ES', label: 'Español' },
  { code: 'en-US', label: 'Inglés' },
  { code: 'pt-BR', label: 'Portugués' },
  { code: 'fr-FR', label: 'Francés' },
  { code: 'it-IT', label: 'Italiano' },
  { code: 'de-DE', label: 'Alemán' },
  { code: 'zh-CN', label: 'Chino' },
  { code: 'ja-JP', label: 'Japonés' },
  { code: 'ko-KR', label: 'Coreano' },
]

// Palabras muy frecuentes de cada idioma: sirven para adivinar en qué idioma está un texto.
const STOPWORDS: Record<string, string[]> = {
  'es-ES': ['el', 'la', 'de', 'que', 'y', 'en', 'los', 'las', 'por', 'una', 'es', 'con', 'para', 'del', 'se', 'qué', 'cuál'],
  'en-US': ['the', 'of', 'and', 'to', 'is', 'in', 'that', 'it', 'for', 'you', 'what', 'with', 'are', 'this', 'which'],
  'pt-BR': ['o', 'de', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'não', 'uma', 'os', 'com', 'você', 'é'],
  'fr-FR': ['le', 'la', 'les', 'de', 'et', 'un', 'une', 'est', 'que', 'des', 'du', 'pour', 'pas', 'vous', 'qui'],
  'it-IT': ['il', 'di', 'che', 'e', 'la', 'un', 'per', 'non', 'una', 'sono', 'gli', 'con', 'del', 'della', 'è'],
  'de-DE': ['der', 'die', 'und', 'das', 'ist', 'nicht', 'ein', 'eine', 'zu', 'mit', 'den', 'ich', 'sie', 'es', 'auf'],
}

/** Adivina el idioma de un texto. Si no está claro, devuelve fallback. */
export function detectLang(text: string, fallback = 'es-ES'): string {
  if (/[぀-ヿ]/.test(text)) return 'ja-JP'
  if (/[가-힯]/.test(text)) return 'ko-KR'
  if (/[一-鿿]/.test(text)) return 'zh-CN'
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? []
  if (words.length < 2) return fallback
  let best = fallback
  let bestScore = 0
  for (const [code, list] of Object.entries(STOPWORDS)) {
    const set = new Set(list)
    const score = words.filter((w) => set.has(w)).length
    if (score > bestScore) [best, bestScore] = [code, score]
  }
  return bestScore === 0 ? fallback : best
}

// ── Leer en voz alta ─────────────────────────────────────────
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

const baseOf = (lang: string) => lang.replace('_', '-').split('-')[0].toLowerCase()

function pickVoice(lang: string, voiceURI?: string) {
  const voices = speechSynthesis.getVoices()
  const base = baseOf(lang)
  const chosen = voiceURI ? voices.find((v) => v.voiceURI === voiceURI && baseOf(v.lang) === base) : undefined
  return chosen ?? voices.find((v) => v.lang === lang) ?? voices.find((v) => baseOf(v.lang) === base)
}

// ── Voces y estilos ──────────────────────────────────────────
// Las voces son las que trae el celular (gratis). Cada marca trae otras:
// en iPhone suele haber varias por idioma; en Android, «Ajustes → Texto a voz».

const FEMALE = /female|mujer|woman|femenin|paulina|m[oó]nica|helena|laura|sabina|samantha|karen|victoria|zira|susan|hazel|luciana|joana|am[eé]lie|alice|anna|elsa|ellen|kyoko|yuna|ting|ioana|sara|paola|elena|luc[ií]a|lupe|pen[eé]lope|conchita|esperanza|marisol|isabela|francisca|catalina|valentina|tessa|moira|fiona|veena|karen|serena|allison|ava|nora|kate|flo|grandma|sandy|shelley|dalia|elvira|ximena|camila|sof[ií]a/i
const MALE = /\bmale\b|hombre|\bman\b|masculin|jorge|juan|diego|carlos|daniel|alex\b|fred|thomas|david|mark|george|pablo|ra[uú]l|enrique|miguel|andr[eé]s|luca|reed|rocko|eddy|grandpa|aaron|arthur|gordon|oliver|rishi|tom\b|alvaro|jorge|antonio|gonzalo|tom[aá]s/i

export type VoiceGender = 'femenina' | 'masculina' | null

/** Adivina por el nombre si la voz es femenina o masculina (no siempre se puede). */
export function voiceGender(name: string): VoiceGender {
  if (MALE.test(name) && !/female/i.test(name)) return 'masculina'
  if (FEMALE.test(name)) return 'femenina'
  return null
}

export interface VoiceOption {
  uri: string
  label: string
  gender: VoiceGender
}

/** Voces instaladas para un idioma, con un nombre fácil de leer. */
export function voicesFor(lang: string, all: Pick<SpeechSynthesisVoice, 'voiceURI' | 'name' | 'lang' | 'localService'>[] = canSpeak() ? speechSynthesis.getVoices() : []): VoiceOption[] {
  const base = baseOf(lang)
  return all
    .filter((v) => baseOf(v.lang) === base)
    .sort((a, b) => Number(b.localService) - Number(a.localService) || a.name.localeCompare(b.name))
    .map((v, i) => {
      const gender = voiceGender(v.name)
      const name = v.name.replace(/^(Microsoft|Google|Apple)\s+/, '').replace(/\s*\(.*?\)\s*/g, ' ').trim()
      const pretty = /^[a-z]{2}-[a-z]{2}-x-/i.test(name) ? `Voz ${i + 1}` : name
      return { uri: v.voiceURI, label: `${pretty}${gender ? ` · ${gender}` : ''}${v.localService ? '' : ' · con internet'}`, gender }
    })
}

export type VoiceStyle = 'normal' | 'alegre' | 'serio' | 'calmado' | 'grave' | 'aguda'
/** Los estilos cambian el tono y el ritmo de la voz del celular. */
export const VOICE_STYLES: { id: VoiceStyle; label: string; pitch: number; rate: number }[] = [
  { id: 'normal', label: 'Normal', pitch: 1, rate: 1 },
  { id: 'alegre', label: 'Alegre', pitch: 1.35, rate: 1.08 },
  { id: 'serio', label: 'Serio', pitch: 0.75, rate: 0.93 },
  { id: 'calmado', label: 'Calmado', pitch: 0.95, rate: 0.85 },
  { id: 'grave', label: 'Grave', pitch: 0.5, rate: 1 },
  { id: 'aguda', label: 'Aguda', pitch: 1.7, rate: 1 },
]

export interface SpeakOptions {
  voiceURI?: string
  style?: VoiceStyle
}

/** Lee el texto. Devuelve una promesa que termina cuando acaba de hablar (o se detiene). */
export function speak(text: string, lang: string, rate = 1, opts: SpeakOptions = {}): Promise<void> {
  if (!canSpeak() || !text.trim()) return Promise.resolve()
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    const style = VOICE_STYLES.find((s) => s.id === opts.style) ?? VOICE_STYLES[0]
    u.lang = lang
    u.rate = Math.min(4, Math.max(0.3, rate * style.rate))
    u.pitch = style.pitch
    const voice = pickVoice(lang, opts.voiceURI)
    if (voice) u.voice = voice
    u.onend = () => resolve()
    u.onerror = () => resolve()
    speechSynthesis.speak(u)
  })
}

export function stopSpeaking() {
  if (canSpeak()) speechSynthesis.cancel()
}

/** ¿Hay alguna voz instalada para ese idioma? (en algunos celulares hay que descargarla) */
export function hasVoiceFor(lang: string) {
  return canSpeak() && (speechSynthesis.getVoices().length === 0 || !!pickVoice(lang))
}

// ── Escuchar (micrófono) ─────────────────────────────────────
interface RecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function Recognition(): (new () => RecognitionLike) | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as Record<string, new () => RecognitionLike>
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export const canListen = () => !!Recognition()

export class ListenError extends Error {}

const LISTEN_ERRORS: Record<string, string> = {
  'not-allowed': 'Memora no tiene permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones (o en Ajustes del celular → Apps → Chrome → Permisos).',
  'no-speech': 'No te escuché. Toca el micrófono y habla cerca del celular.',
  network: 'El dictado de tu navegador necesita internet. Conéctate o escribe la respuesta.',
  'audio-capture': 'No se encontró un micrófono.',
}

/** Escucha una frase y devuelve las posibles transcripciones (la más probable primero). */
export function listen(lang: string): { result: Promise<string[]>; stop: () => void } {
  const R = Recognition()
  if (!R) return { result: Promise.reject(new ListenError('Tu navegador no permite dictar. Prueba con Chrome en Android o Safari en iPhone, o escribe la respuesta.')), stop: () => {} }
  const r = new R()
  r.lang = lang
  r.interimResults = false
  r.maxAlternatives = 3
  const result = new Promise<string[]>((resolve, reject) => {
    let got: string[] = []
    r.onresult = (e) => {
      const first = e.results[0]
      got = Array.from({ length: first.length }, (_, i) => first[i].transcript)
    }
    r.onerror = (e) => reject(new ListenError(LISTEN_ERRORS[e.error] ?? `No se pudo escuchar (${e.error}).`))
    r.onend = () => (got.length ? resolve(got) : reject(new ListenError(LISTEN_ERRORS['no-speech'])))
  })
  r.start()
  return { result, stop: () => r.stop() }
}

// ── Comparar respuestas: correcto, casi o incorrecto ─────────
function plain(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
}

/** Distancia de edición: cuántas letras hay que cambiar para pasar de a a b. */
export function editDistance(a: string, b: string) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

export type Grade = 'correcto' | 'casi' | 'incorrecto'

/**
 * Compara lo que dijo o escribió el estudiante con lo esperado.
 * - Igual (sin contar tildes, mayúsculas ni signos): correcto.
 * - Le falta solo una tilde o hay un error pequeño: casi.
 */
export function gradeAnswer(given: string | string[], expected: string): Grade {
  const list = Array.isArray(given) ? given : [given]
  const want = plain(expected)
  if (!want) return 'incorrecto'
  if (list.some((g) => withAccents(g) === withAccents(expected))) return 'correcto'
  if (list.some((g) => plain(g) === want)) return 'casi' // solo faltan tildes
  const tolerance = Math.max(1, Math.round(want.length * 0.2))
  if (list.some((g) => editDistance(plain(g), want) <= tolerance)) return 'casi'
  return 'incorrecto'
}

function withAccents(s: string) {
  return s.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().normalize('NFC')
}

const LETTER_WORDS: Record<string, number> = { a: 0, be: 1, b: 1, bee: 1, ce: 2, c: 2, see: 2, sea: 2, de: 3, d: 3, dee: 3, e: 4, efe: 5, f: 5 }

/**
 * ¿Qué alternativa dijo el estudiante? Acepta la letra («la b», «letra be», «opción c»)
 * o el texto de la alternativa. Devuelve la posición en options, o null si no está claro.
 */
export function matchSpokenOption(alternatives: string[], options: string[]): number | null {
  for (const alt of alternatives) {
    const p = plain(alt)
    const m = /^(?:la |letra |opcion |alternativa |option |letter )*([a-z]+)$/.exec(p)
    if (m && m[1] in LETTER_WORDS && LETTER_WORDS[m[1]] < options.length) return LETTER_WORDS[m[1]]
    const exact = options.findIndex((o) => plain(o) === p)
    if (exact !== -1) return exact
    const close = options.map((o, i) => ({ i, g: gradeAnswer(alt, o) })).filter((x) => x.g !== 'incorrecto')
    if (close.length === 1) return close[0].i
    const contains = options.map((o, i) => ({ i, o: plain(o) })).filter((x) => x.o && (p.includes(x.o) || x.o.includes(p)) && p.length >= 3)
    if (contains.length === 1) return contains[0].i
  }
  return null
}

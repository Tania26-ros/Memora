// ─────────────────────────────────────────────────────────────
// Memo, la mascota de Memora: qué dice en cada momento.
// Son funciones puras (reciben datos y devuelven una frase), así
// se pueden probar sin pantalla. El dibujo está en Mascot.tsx.
// ─────────────────────────────────────────────────────────────

export type Mood = 'feliz' | 'celebra' | 'animo' | 'piensa' | 'duerme'

export interface MascotLine {
  mood: Mood
  text: string
  /** Botón opcional para seguir el consejo. */
  link?: { to: string; label: string }
}

/** Elige una frase de la lista; rand se puede fijar en las pruebas. */
export function pick<T>(list: readonly T[], rand: () => number = Math.random): T {
  return list[Math.min(list.length - 1, Math.floor(rand() * list.length))]
}

function greeting(hour: number) {
  if (hour < 5) return 'Es muy tarde'
  if (hour < 12) return '¡Buenos días'
  if (hour < 19) return '¡Buenas tardes'
  return '¡Buenas noches'
}

export interface HomeState {
  hour: number
  notebooks: number
  questions: number
  /** Preguntas respondidas hoy. */
  todayAnswered: number
  dailyGoal: number
  streak: number
  /** Preguntas cuyo repaso ya toca, y el tema con más pendientes. */
  due: number
  dueTopic?: { id: number; name: string }
}

/** Consejo de la página de inicio: «Memora siempre te guía». */
export function homeLine(s: HomeState): MascotLine {
  if (s.hour < 5) return { mood: 'duerme', text: 'Es muy tarde. Dormir bien también ayuda a recordar: tu cerebro guarda lo que estudiaste mientras duermes.' }
  const hi = greeting(s.hour)
  if (s.notebooks === 0) return { mood: 'feliz', text: `${hi}! Soy Memo. Empieza creando un cuaderno por cada curso; luego le agregas temas y archivos.` }
  if (s.questions === 0) return { mood: 'piensa', text: `${hi}! Ya tienes cuadernos. Abre un tema y crea o pega preguntas para empezar a jugar.` }
  if (s.due > 0 && s.dueTopic) {
    const n = s.due === 1 ? '1 pregunta' : `${s.due} preguntas`
    return {
      mood: 'piensa',
      text: `${hi}! Tienes ${n} para repasar hoy. Repasar justo a tiempo es lo que hace que no se te olvide.`,
      link: { to: `/tema/${s.dueTopic.id}/jugar`, label: `Repasar «${s.dueTopic.name}»` },
    }
  }
  if (s.todayAnswered >= s.dailyGoal) {
    return { mood: 'celebra', text: s.streak > 1 ? `¡Meta cumplida! Llevas ${s.streak} días seguidos. Así se hace.` : '¡Meta de hoy cumplida! Vuelve mañana para empezar tu racha.' }
  }
  const left = s.dailyGoal - s.todayAnswered
  if (s.streak > 1 && s.todayAnswered === 0) return { mood: 'animo', text: `${hi}! Llevas ${s.streak} días seguidos. Juega un poco hoy para no perder tu racha.` }
  return { mood: 'feliz', text: `${hi}! Te ${left === 1 ? 'falta 1 pregunta' : `faltan ${left} preguntas`} para tu meta de hoy.` }
}

const OK = ['¡Bien!', '¡Eso es!', '¡Excelente!', '¡Correcto, sigue así!', '¡Lo tienes!'] as const
const FAIL = [
  'No te preocupes: equivocarse es parte de aprender. La volverás a ver pronto.',
  'Casi. Lee la explicación y la próxima te sale.',
  'No pasa nada: las que fallas son las que más aprendes.',
] as const
const TIMEOUT = ['Se acabó el tiempo. Si necesitas más tiempo, puedes darte más segundos en la configuración del juego.'] as const

/** Lo que dice al responder una pregunta. streak = aciertos seguidos contando este. */
export function answerLine(result: 'ok' | 'fail' | 'timeout', streak: number, rand: () => number = Math.random): MascotLine {
  if (result === 'ok') {
    if (streak >= 5 && streak % 5 === 0) return { mood: 'celebra', text: `¡${streak} seguidas! Ganas puntos extra por la racha.` }
    if (streak >= 3) return { mood: 'celebra', text: `¡${streak} seguidas! Estás en racha.` }
    return { mood: 'feliz', text: pick(OK, rand) }
  }
  if (result === 'timeout') return { mood: 'animo', text: pick(TIMEOUT, rand) }
  return { mood: 'animo', text: pick(FAIL, rand) }
}

/** Lo que dice al terminar una ronda. pct = porcentaje acertado a la primera. */
export function resultsLine(pct: number, failed: number): MascotLine {
  if (pct === 100) return { mood: 'celebra', text: '¡Todas a la primera! Ya dominas esta dosis.' }
  if (pct >= 70) return { mood: 'celebra', text: failed === 1 ? 'Muy bien. Solo 1 pregunta se resistió: repásala y quedará.' : `Muy bien. Repasa las ${failed} que fallaste y quedarán.` }
  if (pct >= 40) return { mood: 'animo', text: 'Vas avanzando. Lee las explicaciones de las que fallaste y vuelve a intentarlo.' }
  return { mood: 'animo', text: 'Es normal fallar al principio. Prueba primero «Leer como libro» y luego vuelve a jugar.' }
}

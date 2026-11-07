import { db } from './db'
import { supabase, currentUser } from './cloud'
import type { NewQuestion, Question } from './questions'

// ─────────────────────────────────────────────────────────────
// Comunidad en línea: juegos compartidos, competencias y créditos.
// Las reglas importantes (quién ve qué, créditos, premios) viven en
// la base de datos (supabase/migrations/…_comunidad.sql), no aquí:
// así nadie puede hacer trampa cambiando la app.
// ─────────────────────────────────────────────────────────────

export interface Game {
  id: string
  owner: string
  author_name: string
  title: string
  description: string | null
  is_public: boolean
  join_code: string
  /** No viene en la lista de juegos públicos (para que cargue rápido). */
  questions?: SharedQuestion[]
  question_count: number
  plays: number
  created_at: string
}
export type SharedQuestion = Omit<NewQuestion, 'topicId' | 'createdAt' | 'starred'>

export interface Challenge {
  id: string
  game_id: string
  host: string
  title: string
  code: string
  study_minutes: number
  seconds: number
  hints: boolean
  moderated: boolean
  prizes: [number, number, number]
  closes_at: string
  closed: boolean
}

export interface ChallengePlayer {
  user_id: string
  display_name: string
  seconds: number
  hints: boolean
  points: number | null
  correct: number | null
  time_spent: number | null
  hints_used: number | null
  finished_at: string | null
  place: number | null
}

async function call<T>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data as T
}

export async function ensureProfile(name: string) {
  const sb = await supabase()
  const rows = await call<{ display_name: string; credits: number }[]>(sb.rpc('ensure_profile', { p_name: name }))
  return rows[0]
}

/** Prepara las preguntas para compartir: sin datos de este dispositivo. */
export function toShared(questions: Question[]): SharedQuestion[] {
  const local = ['id', 'topicId', 'createdAt', 'starred']
  return questions.map((q) => Object.fromEntries(Object.entries(q).filter(([k]) => !local.includes(k))) as SharedQuestion)
}

export async function publishTopic(topicId: number, data: { title: string; description: string; isPublic: boolean; author: string }) {
  const sb = await supabase()
  const questions = await db.questions.where('topicId').equals(topicId).sortBy('createdAt')
  if (questions.length === 0) throw new Error('Este tema no tiene preguntas para compartir.')
  return call<Game>(
    sb
      .from('games')
      .insert({ title: data.title.trim(), description: data.description.trim() || null, is_public: data.isPublic, author_name: data.author, questions: toShared(questions) })
      .select()
      .single(),
  )
}

export async function myGames() {
  const sb = await supabase()
  const me = await currentUser()
  return call<Game[]>(sb.from('games').select('*').eq('owner', me?.id ?? '').order('created_at', { ascending: false }))
}

export async function publicGames(search = '') {
  const sb = await supabase()
  let q = sb.from('games').select('id, owner, author_name, title, description, is_public, join_code, question_count, plays, created_at').eq('is_public', true)
  if (search.trim()) q = q.ilike('title', `%${search.trim().replace(/[%_]/g, '')}%`)
  return call<Game[]>(q.order('plays', { ascending: false }).limit(30))
}

export async function gameById(id: string) {
  const sb = await supabase()
  return call<Game>(sb.from('games').select('*').eq('id', id).single())
}

export async function gameByCode(code: string) {
  const sb = await supabase()
  const rows = await call<Game[]>(sb.rpc('game_by_code', { p_code: code }))
  if (!rows.length) throw new Error('No encontré ningún juego con ese código.')
  return rows[0]
}

export async function setGamePublic(id: string, isPublic: boolean) {
  const sb = await supabase()
  await call(sb.from('games').update({ is_public: isPublic }).eq('id', id))
}

export async function deleteGame(id: string) {
  const sb = await supabase()
  await call(sb.from('games').delete().eq('id', id))
}

/** Copia un juego de la comunidad a tus cuadernos (en «🌐 Comunidad») y suma un crédito a su autor. */
export async function importGame(game: Game): Promise<number> {
  const full = game.questions ? game : await gameById(game.id)
  const topicId = await db.transaction('rw', db.notebooks, db.topics, db.questions, async () => {
    const nb = (await db.notebooks.filter((n) => n.name === 'Comunidad').first())?.id ?? (await db.notebooks.add({ name: 'Comunidad', emoji: '🌐', color: '#0ea5e9', createdAt: Date.now() } as never))
    const t = await db.topics.add({ notebookId: nb, name: `${full.title} · de ${full.author_name}`, createdAt: Date.now() } as never)
    const now = Date.now()
    await db.questions.bulkAdd((full.questions ?? []).map((q, i) => ({ ...q, topicId: t, createdAt: now + i }) as Question))
    return t
  })
  // Las consultas de Supabase solo se envían al usar .then() o await.
  void (await supabase()).rpc('record_play', { p_game: game.id }).then(() => undefined)
  return topicId
}

// ── Competencias ─────────────────────────────────────────────
export async function createChallenge(o: { gameId: string; title: string; study: number; seconds: number; hints: boolean; moderated: boolean; prizes: [number, number, number]; hours: number }) {
  const sb = await supabase()
  return call<Challenge>(
    sb.rpc('create_challenge', { p_game: o.gameId, p_title: o.title, p_study: o.study, p_seconds: o.seconds, p_hints: o.hints, p_moderated: o.moderated, p_prizes: o.prizes, p_hours: o.hours }).single(),
  )
}

export async function joinChallenge(code: string, name: string) {
  const sb = await supabase()
  return call<Challenge>(sb.rpc('join_challenge', { p_code: code, p_name: name }).single())
}

export async function myChallenges() {
  const sb = await supabase()
  return call<Challenge[]>(sb.from('challenges').select('*').order('created_at', { ascending: false }).limit(30))
}

export async function challengeDetail(id: string) {
  const sb = await supabase()
  const [challenge, players, games] = await Promise.all([
    call<Challenge>(sb.from('challenges').select('*').eq('id', id).single()),
    call<ChallengePlayer[]>(sb.from('challenge_players').select('*').eq('challenge_id', id)),
    call<Game[]>(sb.rpc('challenge_game', { p_challenge: id })),
  ])
  return { challenge, players, game: games[0] }
}

export async function setPlayerRules(challengeId: string, userId: string, seconds: number, hints: boolean) {
  const sb = await supabase()
  await call(sb.rpc('set_player_rules', { p_challenge: challengeId, p_user: userId, p_seconds: seconds, p_hints: hints }))
}

export async function submitResult(challengeId: string, r: { points: number; correct: number; time: number; hints: number }) {
  const sb = await supabase()
  await call(sb.rpc('submit_result', { p_challenge: challengeId, p_points: r.points, p_correct: r.correct, p_time: r.time, p_hints: r.hints }))
}

export async function closeChallenge(id: string) {
  const sb = await supabase()
  await call(sb.rpc('close_challenge', { p_challenge: id }))
}

/** Convierte las preguntas compartidas en preguntas jugables (con ids temporales). */
export function playable(game: Game): Question[] {
  return (game.questions ?? []).map((q, i) => ({ ...q, id: -(i + 1), topicId: 0, createdAt: i }) as Question)
}

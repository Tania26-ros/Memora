import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { cloudEnabled, currentUser } from '../lib/cloud'
import {
  createChallenge, deleteGame, ensureProfile, gameByCode, importGame, joinChallenge, myChallenges, myGames, publicGames, publishTopic, setGamePublic,
  type Challenge, type Game,
} from '../lib/community'
import { db } from '../lib/db'
import { TIMER_OPTIONS, timerLabel } from '../lib/settings'

type Tab = 'explorar' | 'publicar' | 'competir'

// Comunidad: explorar juegos públicos, compartir los tuyos y competir en línea.
export default function CommunityPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('pestana') as Tab) ?? 'explorar'
  const [me, setMe] = useState<{ name: string; credits: number } | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cloudEnabled()) return
    let alive = true
    void (async () => {
      try {
        const u = await currentUser()
        if (!u) return alive && setMe(null)
        const p = await ensureProfile(u.email?.split('@')[0] ?? 'Estudiante')
        if (alive) setMe({ name: p.display_name, credits: p.credits })
      } catch (e) {
        if (alive) setError((e as Error).message)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const header = (
    <>
      <nav className="crumbs">
        <Link to="/">← Cuadernos</Link>
      </nav>
      <h1 className="page-title">🌐 Comunidad</h1>
    </>
  )

  if (!cloudEnabled())
    return (
      <section>
        {header}
        <p className="lead">Aquí podrás publicar tus juegos, jugar los de otros estudiantes, invitar amigos con un código y competir por créditos.</p>
        <div className="card">
          <p>La comunidad en línea todavía no está activada en esta versión de Memora.</p>
          <p className="muted">Mientras tanto puedes competir con tus amigos en el mismo celular: abre un tema y toca «🏆 Competir».</p>
        </div>
      </section>
    )
  if (error)
    return (
      <section>
        {header}
        <p className="form-error">{error}</p>
      </section>
    )
  if (me === undefined) return <section>{header}</section>
  if (me === null)
    return (
      <section>
        {header}
        <div className="card">
          <p>Para usar la comunidad necesitas entrar con tu correo (es gratis y sin contraseña).</p>
          <Link className="btn" to="/cuenta">
            Entrar
          </Link>
        </div>
      </section>
    )

  return (
    <section>
      {header}
      <p className="lead">
        Hola, <strong>{me.name}</strong> · 🪙 {me.credits} créditos. Ganas créditos cuando otros juegan lo que publicas y cuando quedas en el podio de una competencia.
      </p>
      <div className="seg tabs" role="tablist">
        {(
          [
            ['explorar', '🔎 Explorar'],
            ['publicar', '📤 Mis juegos'],
            ['competir', '🏆 Competencias'],
          ] as const
        ).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} className={`seg-btn ${tab === v ? 'seg-on' : ''}`} onClick={() => setParams({ pestana: v })}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'explorar' && <Explore />}
      {tab === 'publicar' && <Publish author={me.name} />}
      {tab === 'competir' && <Challenges name={me.name} />}
    </section>
  )
}

function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true })
  const [n, setN] = useState(0)
  useEffect(() => {
    let alive = true
    fn().then(
      (data) => alive && setState({ data, loading: false }),
      (e: Error) => alive && setState({ error: e.message, loading: false }),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n])
  return { ...state, reload: () => setN(n + 1) }
}

function Explore() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const list = useAsync(() => publicGames(query), [query])

  const take = async (g: Game) => {
    setMsg(null)
    try {
      navigate(`/tema/${await importGame(g)}`)
    } catch (e) {
      setMsg((e as Error).message)
    }
  }

  return (
    <div className="community">
      <form
        className="search-row"
        onSubmit={(e) => {
          e.preventDefault()
          setQuery(search)
        }}
      >
        <input className="input" type="search" placeholder="Buscar: célula, inglés, álgebra…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar juegos" />
        <button className="btn">Buscar</button>
      </form>
      <form
        className="search-row"
        onSubmit={(e) => {
          e.preventDefault()
          void gameByCode(code).then(take, (err: Error) => setMsg(err.message))
        }}
      >
        <input className="input" placeholder="¿Te pasaron un código? Ej.: 4F2A9C" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Código de juego" />
        <button className="btn btn-ghost" disabled={!code.trim()}>
          Abrir
        </button>
      </form>
      {msg && <p className="form-error">{msg}</p>}
      {list.loading ? (
        <p className="muted">Cargando…</p>
      ) : list.error ? (
        <p className="form-error">{list.error}</p>
      ) : list.data?.length === 0 ? (
        <p className="empty">Todavía no hay juegos públicos{query ? ` sobre «${query}»` : ''}. ¡Publica el primero en «Mis juegos»!</p>
      ) : (
        <ul className="vocab-list">
          {list.data?.map((g) => (
            <li key={g.id} className="card vocab-item">
              <p className="vocab-term">{g.title}</p>
              <p className="muted">
                de {g.author_name} · {g.question_count} preguntas · {g.plays} {g.plays === 1 ? 'jugada' : 'jugadas'}
              </p>
              {g.description && <p>{g.description}</p>}
              <button className="btn btn-small" onClick={() => void take(g)}>
                ➕ Añadir a mis cuadernos
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Publish({ author }: { author: string }) {
  const topics = useLiveQuery(async () => {
    const [ts, nbs, qs] = await Promise.all([db.topics.toArray(), db.notebooks.toArray(), db.questions.toArray()])
    const count = new Map<number, number>()
    qs.forEach((q) => count.set(q.topicId, (count.get(q.topicId) ?? 0) + 1))
    return ts.filter((t) => count.get(t.id)).map((t) => ({ ...t, count: count.get(t.id)!, nb: nbs.find((n) => n.id === t.notebookId) }))
  }, [])
  const games = useAsync(myGames, [])
  const [topicId, setTopicId] = useState<number | ''>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [challengeFor, setChallengeFor] = useState<Game | null>(null)

  return (
    <div className="community">
      <form
        className="card q-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!topicId) return
          void publishTopic(topicId, { title, description, isPublic, author }).then(
            (g) => {
              setMsg({ ok: true, text: `Publicado. Código para compartir: ${g.join_code}` })
              setTitle('')
              setDescription('')
              games.reload()
            },
            (err: Error) => setMsg({ ok: false, text: err.message }),
          )
        }}
      >
        <h2>Compartir un tema como juego</h2>
        <label className="field" htmlFor="pub-topic">
          <span>Tema</span>
          <select
            id="pub-topic"
            className="input"
            value={topicId}
            onChange={(e) => {
              const id = Number(e.target.value)
              setTopicId(id || '')
              setTitle(topics?.find((t) => t.id === id)?.name ?? '')
            }}
          >
            <option value="">Elige un tema…</option>
            {topics?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nb?.emoji} {t.nb?.name} › {t.name} ({t.count})
              </option>
            ))}
          </select>
        </label>
        <label className="field" htmlFor="pub-title">
          <span>Título</span>
          <input id="pub-title" className="input" maxLength={80} required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field" htmlFor="pub-desc">
          <span>Descripción (opcional)</span>
          <input id="pub-desc" className="input" maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej.: Repaso para el examen de 3.º de secundaria" />
        </label>
        <div className="seg" role="radiogroup" aria-label="Visibilidad">
          <button type="button" role="radio" aria-checked={isPublic} className={`seg-btn ${isPublic ? 'seg-on' : ''}`} onClick={() => setIsPublic(true)}>
            🌍 Público
          </button>
          <button type="button" role="radio" aria-checked={!isPublic} className={`seg-btn ${!isPublic ? 'seg-on' : ''}`} onClick={() => setIsPublic(false)}>
            🔒 Privado (solo con código)
          </button>
        </div>
        <p className="muted">Se comparten las preguntas, respuestas, explicaciones y pistas. No se comparten tus archivos ni tu progreso.</p>
        <button className="btn" disabled={!topicId || !title.trim()}>
          Publicar
        </button>
        {msg && <p className={msg.ok ? 'form-ok' : 'form-error'}>{msg.text}</p>}
      </form>

      <h2>Mis juegos publicados</h2>
      {games.loading ? (
        <p className="muted">Cargando…</p>
      ) : games.error ? (
        <p className="form-error">{games.error}</p>
      ) : games.data?.length === 0 ? (
        <p className="empty">Aún no publicas ningún juego.</p>
      ) : (
        <ul className="vocab-list">
          {games.data?.map((g) => (
            <li key={g.id} className="card vocab-item">
              <p className="vocab-term">
                {g.title} <span className="badge">{g.is_public ? '🌍 Público' : '🔒 Privado'}</span>
              </p>
              <p className="muted">
                Código <strong className="code">{g.join_code}</strong> · {g.question_count} preguntas · {g.plays} jugadas
              </p>
              <div className="card-actions">
                <button className="btn btn-small" onClick={() => setChallengeFor(g)}>
                  🏆 Crear competencia
                </button>
                <button className="btn btn-small btn-ghost" onClick={() => void setGamePublic(g.id, !g.is_public).then(games.reload)}>
                  {g.is_public ? 'Hacer privado' : 'Hacer público'}
                </button>
                <button className="btn btn-small btn-ghost" onClick={() => void deleteGame(g.id).then(games.reload)}>
                  Borrar
                </button>
              </div>
              {challengeFor?.id === g.id && <NewChallenge game={g} onCancel={() => setChallengeFor(null)} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function NewChallenge({ game, onCancel }: { game: Game; onCancel: () => void }) {
  const navigate = useNavigate()
  const [o, setO] = useState({ title: game.title, study: 2, seconds: 20, hints: false, moderated: false, prizes: [0, 0, 0] as [number, number, number], hours: 24 })
  const [error, setError] = useState<string | null>(null)
  const PRIZES: { label: string; value: [number, number, number] }[] = [
    { label: 'Sin premios', value: [0, 0, 0] },
    { label: '🪙 10 · 5 · 3', value: [10, 5, 3] },
    { label: '🪙 20 · 10 · 5', value: [20, 10, 5] },
    { label: '🪙 50 · 25 · 10', value: [50, 25, 10] },
  ]
  return (
    <form
      className="q-form confirm-box"
      onSubmit={(e) => {
        e.preventDefault()
        void createChallenge({ gameId: game.id, ...o }).then(
          (c) => navigate(`/comunidad/reto/${c.id}`),
          (err: Error) => setError(err.message),
        )
      }}
    >
      <label className="field" htmlFor="ch-title">
        <span>Nombre de la competencia</span>
        <input id="ch-title" className="input" value={o.title} onChange={(e) => setO({ ...o, title: e.target.value })} />
      </label>
      <div className="setup-grid">
        <label className="field" htmlFor="ch-study">
          <span>Estudiar antes</span>
          <select id="ch-study" className="input" value={o.study} onChange={(e) => setO({ ...o, study: Number(e.target.value) })}>
            {[0, 1, 2, 3, 5, 10, 15].map((m) => (
              <option key={m} value={m}>
                {m ? `${m} min` : 'Sin estudiar'}
              </option>
            ))}
          </select>
        </label>
        <label className="field" htmlFor="ch-seconds">
          <span>Tiempo por pregunta</span>
          <select id="ch-seconds" className="input" value={o.seconds} onChange={(e) => setO({ ...o, seconds: Number(e.target.value) })}>
            <option value={0}>Sin tiempo</option>
            {TIMER_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {timerLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="field" htmlFor="ch-hours">
          <span>Abierta durante</span>
          <select id="ch-hours" className="input" value={o.hours} onChange={(e) => setO({ ...o, hours: Number(e.target.value) })}>
            <option value={1}>1 hora</option>
            <option value={24}>1 día</option>
            <option value={72}>3 días</option>
            <option value={168}>1 semana</option>
          </select>
        </label>
        <label className="field" htmlFor="ch-prizes">
          <span>Premios (salen de tus créditos)</span>
          <select id="ch-prizes" className="input" value={o.prizes.join(',')} onChange={(e) => setO({ ...o, prizes: e.target.value.split(',').map(Number) as [number, number, number] })}>
            {PRIZES.map((p) => (
              <option key={p.label} value={p.value.join(',')}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="chips">
        <label className="check">
          <input type="checkbox" checked={o.hints} onChange={(e) => setO({ ...o, hints: e.target.checked })} />
          Permitir pistas
        </label>
        <label className="check">
          <input type="checkbox" checked={o.moderated} onChange={(e) => setO({ ...o, moderated: e.target.checked })} />
          Con moderador (podré dar tiempo o pistas a alguien; todos lo verán)
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="card-actions">
        <button className="btn btn-small">Crear y obtener el código</button>
        <button type="button" className="btn btn-small btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

function Challenges({ name }: { name: string }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const list = useAsync(myChallenges, [])
  const [now] = useState(() => Date.now())
  const [code, setCode] = useState(params.get('codigo') ?? '')
  const [nick, setNick] = useState(name)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="community">
      <form
        className="card q-form"
        onSubmit={(e) => {
          e.preventDefault()
          void joinChallenge(code, nick).then(
            (c: Challenge) => navigate(`/comunidad/reto/${c.id}`),
            (err: Error) => setError(err.message),
          )
        }}
      >
        <h2>Unirme a una competencia</h2>
        <div className="search-row">
          <input className="input" placeholder="Código, ej.: 9B3D1E" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Código de la competencia" required />
          <input className="input" placeholder="Tu nombre" value={nick} onChange={(e) => setNick(e.target.value)} aria-label="Tu nombre en la competencia" maxLength={40} />
        </div>
        <button className="btn">Unirme</button>
        {error && <p className="form-error">{error}</p>}
        <p className="muted">Para crear una, ve a «Mis juegos» y toca «🏆 Crear competencia».</p>
      </form>
      <h2>Mis competencias</h2>
      {list.loading ? (
        <p className="muted">Cargando…</p>
      ) : list.error ? (
        <p className="form-error">{list.error}</p>
      ) : list.data?.length === 0 ? (
        <p className="empty">Todavía no participas en ninguna.</p>
      ) : (
        <ul className="vocab-list">
          {list.data?.map((c) => (
            <li key={c.id}>
              <Link className="card vocab-item challenge-link" to={`/comunidad/reto/${c.id}`}>
                <strong>{c.title}</strong>
                <span className="muted">{c.closed || new Date(c.closes_at).getTime() < now ? 'Terminada' : `Abierta hasta ${new Date(c.closes_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}`} · código {c.code}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

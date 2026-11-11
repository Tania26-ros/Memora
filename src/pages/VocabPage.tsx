import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import TextReader from '../components/TextReader'
import { MicButton, SpeakButton } from '../components/Voice'
import WordEditor, { type WordDraft } from '../components/WordEditor'
import { db, deleteVocabList } from '../lib/db'
import { normalize, nowMs } from '../lib/questions'
import { LANGUAGES, detectLang } from '../lib/speech'
import { shareVocab } from '../lib/vocabShare'
import { parseWordList, phrase, sentenceOf, tokenize } from '../lib/vocab'

type Tab = 'texto' | 'sombrear' | 'palabras'
const TABS: { id: Tab; label: string }[] = [
  { id: 'texto', label: '📄 Mi texto' },
  { id: 'sombrear', label: '🖍 Sombrear palabras' },
  { id: 'palabras', label: '📚 Mis palabras' },
]

// Un vocabulario: tu texto (para leerlo y escucharlo), sombrear palabras
// para guardarlas, y la lista de palabras con su información.
export default function VocabPage() {
  const topicId = Number(useParams().topicId)
  const listId = Number(useParams().listId)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const topic = useLiveQuery(() => db.topics.get(topicId), [topicId])
  const list = useLiveQuery(() => db.vocabLists.get(listId), [listId])
  const words = useLiveQuery(() => db.words.where('listId').equals(listId).sortBy('createdAt'), [listId])
  const textFiles = useLiveQuery(async () => (await db.files.where('topicId').equals(topicId).toArray()).filter((f) => f.mimeType.startsWith('text/') || /\.(txt|md|srt|vtt)$/i.test(f.name)), [topicId])

  const tab = (params.get('ver') as Tab) || 'texto'
  const setTab = (t: Tab) => setParams({ ver: t }, { replace: true })
  const [text, setTextState] = useState<string | null>(null)
  const [editText, setEditingText] = useState<boolean | null>(null) // null = según si ya hay texto
  const [pick, setPick] = useState<{ a: number; b: number } | null>(null)
  const [editing, setEditing] = useState<WordDraft | null>(null)
  const [hideInfo, setHideInfo] = useState(false)
  const [shown, setShown] = useState<Set<number>>(new Set())
  const [wordList, setWordList] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  const current = text ?? list?.text ?? ''
  const tokens = useMemo(() => tokenize(current), [current])
  const lang = !list || list.lang === 'auto' ? detectLang(current, 'en-US') : list.lang
  // Si el vocabulario no tiene texto, se empieza escribiéndolo.
  const editingText = editText ?? !list?.text
  const saved = useMemo(() => new Set((words ?? []).map((w) => normalize(w.term))), [words])

  const setText = (v: string) => {
    setEditingText(editingText) // fija el modo actual: escribir no debe cerrar el editor
    setTextState(v)
    setPick(null)
    void db.vocabLists.update(listId, { text: v, position: 0 })
  }

  const tapWord = (i: number) => {
    // Primer toque: elige la palabra. Otro toque cerca: alarga la frase (hasta 8 palabras).
    if (pick && i !== pick.a && Math.abs(i - pick.a) < 8 && pick.a === pick.b) setPick({ a: pick.a, b: i })
    else setPick({ a: i, b: i })
  }
  const inPick = (i: number) => !!pick && i >= Math.min(pick.a, pick.b) && i <= Math.max(pick.a, pick.b)

  const addList = async () => {
    const items = parseWordList(wordList)
    const t = nowMs()
    await db.words.bulkAdd(items.map((it, i) => ({ ...it, topicId, listId, lang: detectLang(it.term, lang), createdAt: t + i })) as never)
    setWordList('')
  }

  if (!topic || !list || !words) return null

  const rename = async () => {
    const name = prompt('Nuevo nombre del vocabulario', list.name)?.trim()
    if (name) await db.vocabLists.update(listId, { name })
  }
  const remove = async () => {
    if (!confirm(`¿Borrar «${list.name}» y sus ${words.length} palabras?`)) return
    await deleteVocabList(listId)
    navigate(`/tema/${topicId}/vocabulario`, { replace: true })
  }
  const share = async () => {
    setNotice(await shareVocab(list, words))
  }

  return (
    <section>
      <nav className="crumbs">
        <Link to={`/tema/${topicId}/vocabulario`}>← Vocabularios de {topic.name}</Link>
      </nav>
      <div className="page-head">
        <h1 className="page-title">{list.name}</h1>
        <div className="card-actions">
          {words.length >= 2 && (
            <Link className="btn" to={`/tema/${topicId}/vocabulario/${listId}/practicar`}>
              Practicar
            </Link>
          )}
          {words.length >= 3 && (
            <Link className="btn btn-ghost" to={`/tema/${topicId}/competir?vocab=${listId}`}>
              🏆 Competir
            </Link>
          )}
        </div>
      </div>
      {list.from && <p className="muted">Compartido por {list.from}</p>}
      <div className="card-actions">
        <button className="btn btn-small btn-ghost" onClick={() => void share()} disabled={words.length === 0}>
          📤 Compartir
        </button>
        <button className="btn btn-small btn-ghost" onClick={() => void rename()}>
          ✎ Cambiar nombre
        </button>
        <button className="btn btn-small btn-ghost" onClick={() => void remove()}>
          Borrar
        </button>
      </div>
      {notice && (
        <p className="form-ok" role="status">
          {notice}
        </p>
      )}

      <div className="seg vocab-tabs" role="tablist" aria-label="Partes del vocabulario">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`seg-btn ${tab === t.id ? 'seg-on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'palabras' ? ` (${words.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'texto' && (
        <div className="card">
          {editingText ? (
            <>
              <details className="tip">
                <summary>¿Cómo copio la transcripción de un video?</summary>
                <ul>
                  <li>
                    <strong>YouTube</strong>: abre el video, toca la descripción → «Mostrar transcripción». Mantén pulsado el texto para copiarlo. En computadora: «…» → «Mostrar transcripción».
                  </li>
                  <li>
                    <strong>TikTok o Instagram</strong>: si el video tiene subtítulos, actívalos y cópialos desde la descripción. Si no se pueden copiar, usa 🎤 Dictar: pon el video en voz alta cerca del celular.
                  </li>
                  <li>
                    <strong>Clase grabada o audio</strong>: reprodúcelo cerca del celular y usa 🎤 Dictar por partes.
                  </li>
                  <li>Si nada de esto funciona con tu video, Memora no puede sacar el texto sola: escríbelo o pídele a alguien la transcripción.</li>
                </ul>
              </details>
              <div className="card-actions">
                <MicButton lang={lang} label="Dictar" onResult={(alts) => setText(current ? `${current} ${alts[0]}` : alts[0])} />
                {textFiles?.map((f) => (
                  <button key={f.id} className="btn btn-small btn-ghost" onClick={async () => setText(await f.blob.text())}>
                    Usar «{f.name}»
                  </button>
                ))}
              </div>
              <label className="field" htmlFor="vocab-text">
                <span>Texto, letra de canción o transcripción</span>
                <textarea id="vocab-text" className="input textarea" rows={8} value={current} onChange={(e) => setText(e.target.value)} placeholder="Pega aquí el texto…" />
              </label>
              <label className="field" htmlFor="text-lang">
                <span>Idioma del texto</span>
                <select id="text-lang" className="input" value={list.lang} onChange={(e) => void db.vocabLists.update(listId, { lang: e.target.value })}>
                  <option value="auto">Automático ({LANGUAGES.find((l) => l.code === lang)?.label ?? lang})</option>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn btn-block" disabled={!current.trim()} onClick={() => setEditingText(false)}>
                Listo
              </button>
            </>
          ) : (
            <>
              <TextReader key={current} text={current} lang={lang} startAt={list.position ?? 0} onPosition={(i) => void db.vocabLists.update(listId, { position: i })} />
              <div className="card-actions">
                <button className="btn btn-small btn-ghost" onClick={() => setEditingText(true)}>
                  ✎ Editar el texto
                </button>
                <button className="btn btn-small btn-ghost" onClick={() => setTab('sombrear')}>
                  🖍 Sombrear palabras
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'sombrear' && (
        <div className="card shade-card">
          {!current.trim() ? (
            <p className="empty">
              Primero escribe o pega tu texto en{' '}
              <button className="btn-link" onClick={() => (setTab('texto'), setEditingText(true))}>
                Mi texto
              </button>
              .
            </p>
          ) : (
            <>
              <p className="muted">Toca una palabra. Para una frase («wake up»), toca la primera y luego la última. Las amarillas ya están guardadas.</p>
              <div className="shade-text" lang={lang} aria-label="Texto para sombrear">
                {tokens.map((t, k) =>
                  t.kind === 'sep' ? (
                    <span key={k}>{t.value}</span>
                  ) : (
                    <button key={k} type="button" className={`shade-word ${inPick(t.index) ? 'picked' : saved.has(normalize(t.value)) ? 'saved' : ''}`} onClick={() => tapWord(t.index)}>
                      {t.value}
                    </button>
                  ),
                )}
              </div>
              <div className="shade-bar" aria-live="polite">
                {pick ? (
                  <>
                    <button className="btn" onClick={() => setEditing({ term: phrase(tokens, pick.a, pick.b), example: sentenceOf(tokens, Math.min(pick.a, pick.b)), lang })}>
                      Guardar «{phrase(tokens, pick.a, pick.b)}»
                    </button>
                    <SpeakButton text={phrase(tokens, pick.a, pick.b)} lang={lang} />
                    <button className="btn btn-small btn-ghost" onClick={() => setPick(null)}>
                      Cancelar
                    </button>
                  </>
                ) : (
                  <span className="muted">Toca una palabra del texto para guardarla.</span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'palabras' && (
        <>
          <div className="card-actions">
            <button className="btn" onClick={() => setEditing({ lang })}>
              + Palabra
            </button>
            {words.length > 0 && (
              <label className="check">
                <input type="checkbox" checked={hideInfo} onChange={(e) => (setHideInfo(e.target.checked), setShown(new Set()))} />
                Ocultar significados
              </label>
            )}
          </div>
          <details className="tip">
            <summary>¿Ya tienes una lista de palabras? Pégala aquí</summary>
            <p>Una por línea: «apple - manzana», «to run: correr» o solo la palabra.</p>
            <textarea className="input textarea" rows={4} value={wordList} onChange={(e) => setWordList(e.target.value)} aria-label="Lista de palabras" />
            <button className="btn btn-small" disabled={!wordList.trim()} onClick={() => void addList()}>
              Añadir {parseWordList(wordList).length} palabras
            </button>
          </details>
          {words.length === 0 ? (
            <p className="empty">Todavía no hay palabras. Sombréalas en tu texto o toca «+ Palabra».</p>
          ) : (
            <ul className="vocab-list">
              {words.map((w) => {
                const hidden = hideInfo && !shown.has(w.id)
                const info = [
                  ['Significado', w.meaning],
                  ['Sinónimos', w.synonyms],
                  ['Antónimos', w.antonyms],
                  ['Contexto', w.example],
                  ['Notas', w.notes],
                  ['Pista', w.hint],
                ].filter(([, v]) => v)
                return (
                  <li key={w.id} className="card vocab-item">
                    <p className="vocab-term" lang={w.lang}>
                      {w.term}
                      <SpeakButton text={w.term} lang={w.lang} label={`Escuchar ${w.term}`} />
                    </p>
                    {info.length > 0 && (
                      <dl className={hidden ? 'hidden-info' : ''} onClick={() => setShown(new Set([...shown, w.id]))} tabIndex={hidden ? 0 : undefined} aria-label={hidden ? 'Toca para ver' : undefined}>
                        {info.map(([k, v]) => (
                          <div key={k} style={{ display: 'contents' }}>
                            <dt>{k}</dt>
                            <dd>{v}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    <div className="card-actions">
                      <button className="btn btn-small btn-ghost" onClick={() => setEditing(w)}>
                        Editar
                      </button>
                      <button className="btn btn-small btn-ghost" onClick={() => db.words.delete(w.id)}>
                        Borrar
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {editing && <WordEditor key={editing.id ?? 'nueva'} topicId={topicId} listId={listId} draft={editing} onClose={() => (setEditing(null), setPick(null))} />}
    </section>
  )
}

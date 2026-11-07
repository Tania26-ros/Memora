import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MicButton, SpeakButton } from '../components/Voice'
import WordEditor, { type WordDraft } from '../components/WordEditor'
import { db } from '../lib/db'
import { normalize, nowMs } from '../lib/questions'
import { LANGUAGES, detectLang } from '../lib/speech'
import { parseWordList, phrase, sentenceOf, tokenize } from '../lib/vocab'

const textKey = (topicId: number) => `memora-texto-${topicId}`
function loadText(topicId: number) {
  try {
    return localStorage.getItem(textKey(topicId)) ?? ''
  } catch {
    return ''
  }
}

// Vocabulario del tema: sombrear palabras en un texto o transcripción,
// guardarlas con su significado, y verlas con la información visible u oculta.
export default function VocabPage() {
  const topicId = Number(useParams().topicId)
  const topic = useLiveQuery(() => db.topics.get(topicId), [topicId])
  const words = useLiveQuery(() => db.words.where('topicId').equals(topicId).sortBy('createdAt'), [topicId])
  const textFiles = useLiveQuery(async () => (await db.files.where('topicId').equals(topicId).toArray()).filter((f) => f.mimeType.startsWith('text/') || /\.(txt|md|srt|vtt)$/i.test(f.name)), [topicId])

  const [text, setTextState] = useState(() => loadText(topicId))
  const [textLang, setTextLang] = useState<string>('auto')
  const [shading, setShading] = useState(false)
  const [pick, setPick] = useState<{ a: number; b: number } | null>(null)
  const [editing, setEditing] = useState<WordDraft | null>(null)
  const [hideInfo, setHideInfo] = useState(false)
  const [shown, setShown] = useState<Set<number>>(new Set())
  const [list, setList] = useState('')

  const tokens = useMemo(() => tokenize(text), [text])
  const lang = textLang === 'auto' ? detectLang(text, 'en-US') : textLang
  const saved = useMemo(() => new Set((words ?? []).map((w) => normalize(w.term))), [words])

  const setText = (v: string) => {
    setTextState(v)
    setPick(null)
    try {
      localStorage.setItem(textKey(topicId), v)
    } catch {
      // Sin almacenamiento: el texto se pierde al salir, no pasa nada grave.
    }
  }

  const tapWord = (i: number) => {
    // Primer toque: elige la palabra. Otro toque cerca: alarga la frase (hasta 8 palabras).
    if (pick && i !== pick.a && Math.abs(i - pick.a) < 8 && pick.a === pick.b) setPick({ a: pick.a, b: i })
    else setPick({ a: i, b: i })
  }
  const inPick = (i: number) => !!pick && i >= Math.min(pick.a, pick.b) && i <= Math.max(pick.a, pick.b)

  const addList = async () => {
    const items = parseWordList(list)
    const t = nowMs()
    await db.words.bulkAdd(items.map((it, i) => ({ ...it, topicId, lang: detectLang(it.term, lang), createdAt: t + i })) as never)
    setList('')
  }

  if (!topic || !words) return null

  return (
    <section>
      <nav className="crumbs">
        <Link to={`/tema/${topicId}`}>← {topic.name}</Link>
      </nav>
      <div className="page-head">
        <h1 className="page-title">Vocabulario</h1>
        <div className="card-actions">
          {words.length >= 2 && (
            <Link className="btn" to={`/tema/${topicId}/vocabulario/practicar`}>
              Practicar
            </Link>
          )}
          <button className="btn btn-ghost" onClick={() => setEditing({ lang })}>
            + Palabra
          </button>
        </div>
      </div>
      <p className="lead">Pega un texto, una canción o la transcripción de un video, y toca las palabras que quieres aprender. También puedes escribirlas una por una.</p>

      <div className="card">
        <h2>1. Tu texto</h2>
        {!shading ? (
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
              <MicButton lang={lang} label="Dictar" onResult={(alts) => setText(text ? `${text} ${alts[0]}` : alts[0])} />
              {textFiles?.map((f) => (
                <button key={f.id} className="btn btn-small btn-ghost" onClick={async () => setText(await f.blob.text())}>
                  Usar «{f.name}»
                </button>
              ))}
            </div>
            <label className="field" htmlFor="vocab-text">
              <span>Texto, letra de canción o transcripción</span>
              <textarea id="vocab-text" className="input textarea" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Pega aquí el texto…" />
            </label>
            <div className="setup-grid">
              <label className="field" htmlFor="text-lang">
                <span>Idioma del texto</span>
                <select id="text-lang" className="input" value={textLang} onChange={(e) => setTextLang(e.target.value)}>
                  <option value="auto">Automático ({LANGUAGES.find((l) => l.code === lang)?.label ?? lang})</option>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button className="btn btn-block" disabled={!text.trim()} onClick={() => setShading(true)}>
              2. Sombrear palabras
            </button>
          </>
        ) : (
          <>
            <p className="muted">Toca una palabra. Para una frase («wake up»), toca la primera y luego la última. Las amarillas ya están en tu vocabulario.</p>
            <div className="shade-text" lang={lang}>
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
            {pick && (
              <div className="card-actions">
                <button className="btn" onClick={() => setEditing({ term: phrase(tokens, pick.a, pick.b), example: sentenceOf(tokens, Math.min(pick.a, pick.b)), lang })}>
                  Guardar «{phrase(tokens, pick.a, pick.b)}»
                </button>
                <SpeakButton text={phrase(tokens, pick.a, pick.b)} lang={lang} />
                <button className="btn btn-ghost" onClick={() => setPick(null)}>
                  Cancelar
                </button>
              </div>
            )}
            <button className="btn btn-small btn-ghost" onClick={() => setShading(false)}>
              ✎ Cambiar el texto
            </button>
          </>
        )}
      </div>

      <details className="tip">
        <summary>¿Ya tienes una lista de palabras? Pégala aquí</summary>
        <p>Una por línea: «apple - manzana», «to run: correr» o solo la palabra.</p>
        <textarea className="input textarea" rows={4} value={list} onChange={(e) => setList(e.target.value)} aria-label="Lista de palabras" />
        <button className="btn btn-small" disabled={!list.trim()} onClick={() => void addList()}>
          Añadir {parseWordList(list).length} palabras
        </button>
      </details>

      <div className="page-head">
        <h2>
          Mis palabras <span className="muted">({words.length})</span>
        </h2>
        {words.length > 0 && (
          <label className="check">
            <input type="checkbox" checked={hideInfo} onChange={(e) => (setHideInfo(e.target.checked), setShown(new Set()))} />
            Ocultar significados
          </label>
        )}
      </div>
      {words.length === 0 ? (
        <p className="empty">Todavía no hay palabras. Sombrea algunas en tu texto o toca «+ Palabra».</p>
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

      {editing && <WordEditor key={editing.id ?? 'nueva'} topicId={topicId} draft={editing} onClose={() => setEditing(null)} />}
    </section>
  )
}

import type { Word } from '../lib/db'
import { LETTERS, classifyItems, correctAnswerText, shuffle, type Question } from '../lib/questions'

export type BookMode = 'respuestas' | 'examen'

// Contenido del libro: lo mismo se muestra en pantalla, se imprime en PDF y se descarga en Word.
// Por eso usa HTML simple (títulos, listas, tablas) y casi nada de estilos propios.
export default function BookContent({ title, subtitle, questions, words, texts, mode }: { title: string; subtitle?: string; questions: Question[]; words: Word[]; texts: { name: string; text: string }[]; mode: BookMode }) {
  const exam = mode === 'examen'
  return (
    <>
      <h1>{title}</h1>
      {subtitle && <p className="muted">{subtitle}</p>}

      {questions.length > 0 && (
        <section>
          <h2>{exam ? 'Examen' : 'Preguntas y respuestas'}</h2>
          {exam && <p className="muted">Nombre: ______________________ Fecha: __________</p>}
          {questions.map((q, i) => (
            <div key={q.id} className="book-q">
              <h3>
                {i + 1}. {q.prompt}
              </h3>
              <QuestionBody q={q} exam={exam} />
              {!exam && q.explanation && <p className="explain">{q.explanation}</p>}
            </div>
          ))}
        </section>
      )}

      {words.length > 0 && (
        <section>
          <h2>Vocabulario</h2>
          <table>
            <thead>
              <tr>
                <th>Palabra</th>
                <th>Significado</th>
                <th>Contexto y notas</th>
              </tr>
            </thead>
            <tbody>
              {words.map((w) => (
                <tr key={w.id}>
                  <td lang={w.lang}>
                    <strong>{w.term}</strong>
                  </td>
                  <td>{exam ? '' : [w.meaning, w.synonyms && `Sinónimos: ${w.synonyms}`, w.antonyms && `Antónimos: ${w.antonyms}`].filter(Boolean).join(' · ')}</td>
                  <td>{[w.example && `«${w.example}»`, !exam && w.notes].filter(Boolean).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {texts.map((t) => (
        <section key={t.name}>
          <h2>{t.name}</h2>
          {t.text.split(/\n{2,}/).map((para, k) => (
            <p key={k}>{para}</p>
          ))}
        </section>
      ))}

      {exam && questions.length > 0 && (
        <section className="page-break">
          <h2>Hoja de respuestas</h2>
          <ol>
            {questions.map((q) => (
              <li key={q.id}>{correctAnswerText(q)}</li>
            ))}
          </ol>
        </section>
      )}
    </>
  )
}

/** Números "al azar" pero siempre iguales para la misma pregunta (para que el examen no cambie al redibujar). */
function seeded(seed: number) {
  let a = seed * 2654435761
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function QuestionBody({ q, exam }: { q: Question; exam: boolean }) {
  const rand = seeded(q.id)
  switch (q.type) {
    case 'mcq':
      return (
        <ol type="a">
          {q.options.map((o, k) => (
            <li key={k} className={!exam && k === q.correct ? 'correct' : undefined}>
              {o}
              {!exam && k === q.correct && ' ✔'}
            </li>
          ))}
        </ol>
      )
    case 'tf':
      return <p>{exam ? '( ) Verdadero   ( ) Falso' : <span className="correct">{q.correct ? 'Verdadero ✔' : 'Falso ✔'}</span>}</p>
    case 'match':
      return exam ? (
        <table>
          <tbody>
            {shuffle(q.pairs.map((p) => p.right), rand).map((right, k) => (
              <tr key={k}>
                <td>
                  {k + 1}. {q.pairs[k].left}
                </td>
                <td>
                  {LETTERS[k]}) {right}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul>
          {q.pairs.map((p, k) => (
            <li key={k}>
              {p.left} → <span className="correct">{p.right}</span>
            </li>
          ))}
        </ul>
      )
    case 'cloze':
      return <p>{exam ? q.text.replace(/\[\[\d+\]\]/g, '__________') : q.text.replace(/\[\[(\d+)\]\]/g, (_, n) => `«${q.blanks[Number(n)]?.answer}»`)}</p>
    case 'order':
      return exam ? (
        <ul>
          {shuffle(q.items, rand).map((it, k) => (
            <li key={k}>( ) {it}</li>
          ))}
        </ul>
      ) : (
        <ol>
          {q.items.map((it, k) => (
            <li key={k}>{it}</li>
          ))}
        </ol>
      )
    case 'classify':
      return exam ? (
        <p>
          Grupos: <strong>{q.groups.map((g) => g.name).join(' / ')}</strong>. Elementos: {shuffle(classifyItems(q).map((x) => x.text), rand).join(', ')}
        </p>
      ) : (
        <ul>
          {q.groups.map((g) => (
            <li key={g.name}>
              <strong>{g.name}</strong>: {g.items.join(', ')}
            </li>
          ))}
        </ul>
      )
    case 'open':
      return exam ? <p>______________________________________________</p> : <p className="correct">{q.answer}</p>
  }
}

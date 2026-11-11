// ─────────────────────────────────────────────────────────────
// Vocabulario: herramientas para sombrear palabras en un texto.
// ─────────────────────────────────────────────────────────────

export type Token = { kind: 'word'; value: string; index: number } | { kind: 'sep'; value: string }

/** Divide un texto en palabras (que se pueden tocar) y separadores (espacios, signos). */
export function tokenize(text: string): Token[] {
  const out: Token[] = []
  const re = /[\p{L}\p{M}\p{N}'’-]+/gu
  let last = 0
  let index = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ kind: 'sep', value: text.slice(last, m.index) })
    out.push({ kind: 'word', value: m[0], index: index++ })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ kind: 'sep', value: text.slice(last) })
  return out
}

/** Une las palabras desde la posición a hasta b (incluidas), con sus espacios originales. */
export function phrase(tokens: Token[], a: number, b: number): string {
  const [from, to] = a <= b ? [a, b] : [b, a]
  let s = ''
  let inside = false
  for (const t of tokens) {
    if (t.kind === 'word' && t.index === from) inside = true
    if (inside) s += t.value
    if (t.kind === 'word' && t.index === to) break
  }
  return s.trim()
}

/** La oración donde aparece la palabra número `wordIndex`: sirve como contexto. */
export function sentenceOf(tokens: Token[], wordIndex: number): string {
  const full = tokens.map((t) => t.value).join('')
  let offset = 0
  for (const t of tokens) {
    if (t.kind === 'word' && t.index === wordIndex) break
    offset += t.value.length
  }
  const before = full.slice(0, offset)
  const start = Math.max(before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?'), before.lastIndexOf('\n')) + 1
  const rest = full.slice(offset)
  const endRel = rest.search(/[.!?\n]/)
  const end = endRel === -1 ? full.length : offset + endRel + 1
  return full.slice(start, end).replace(/\s+/g, ' ').trim()
}

/**
 * Lista rápida de palabras, una por línea:
 *   apple - manzana
 *   to run: correr
 *   house = casa
 */
export function parseWordList(text: string): { term: string; meaning?: string }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .map((l) => {
      const m = /^(.+?)\s+[-–—:=]\s+(.+)$/.exec(l) ?? /^(.+?)\s*[:=]\s*(.+)$/.exec(l)
      return m ? { term: m[1].trim(), meaning: m[2].trim() } : { term: l }
    })
}

/**
 * Divide un texto en frases para leerlo en voz alta de a poco
 * (así se puede pausar, retroceder y empezar desde cualquier frase).
 * Las frases muy largas se cortan en comas, para que la voz no se trabe.
 */
export function splitSentences(text: string, maxLen = 220): string[] {
  const out: string[] = []
  for (const para of text.split(/\n+/)) {
    const parts = para.match(/[^.!?…。！？]+(?:[.!?…。！？]+["'»”)\]]*|$)/gu) ?? []
    for (const raw of parts) {
      const s = raw.trim()
      if (!s) continue
      if (s.length <= maxLen) {
        out.push(s)
        continue
      }
      let chunk = ''
      for (const piece of s.split(/(?<=[,;:])\s+/)) {
        if (chunk && (chunk + ' ' + piece).length > maxLen) {
          out.push(chunk)
          chunk = piece
        } else chunk = chunk ? `${chunk} ${piece}` : piece
      }
      if (chunk) out.push(chunk)
    }
  }
  return out
}

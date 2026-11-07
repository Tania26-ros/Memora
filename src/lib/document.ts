// ─────────────────────────────────────────────────────────────
// Descargas: convertir el contenido del lector en un archivo de Word.
// Word abre sin problema un documento HTML guardado como .doc,
// así no hace falta ninguna librería pesada.
// ─────────────────────────────────────────────────────────────

/** Estilos sencillos que Word entiende (márgenes, letra, tablas). */
const WORD_CSS = `
  body { font-family: Calibri, Arial, sans-serif; font-size: 12pt; line-height: 1.4; }
  h1 { font-size: 20pt; margin: 0 0 6pt; }
  h2 { font-size: 15pt; margin: 18pt 0 6pt; border-bottom: 1px solid #999; }
  h3 { font-size: 12pt; margin: 12pt 0 4pt; }
  p { margin: 0 0 6pt; }
  ol, ul { margin-top: 0; }
  .correct { font-weight: bold; color: #166534; }
  .explain { font-style: italic; color: #555; }
  .muted { color: #666; font-size: 10pt; }
  table { border-collapse: collapse; }
  td, th { border: 1px solid #999; padding: 3pt 6pt; vertical-align: top; }
  .page-break { page-break-before: always; }
`

export function wordDocument(title: string, bodyHtml: string): string {
  const safeTitle = title.replace(/[<>&]/g, '')
  return `<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${safeTitle}</title><style>${WORD_CSS}</style></head><body>${bodyHtml}</body></html>`
}

/**
 * Nombre de archivo seguro: «La célula: repaso» → «La celula - repaso».
 * Se quitan las tildes porque algunos navegadores cambian por «download»
 * los nombres con letras especiales.
 */
export function fileName(title: string, ext: string) {
  const base =
    title
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^\x20-\x7e]/g, '')
      .replace(/[\\/:*?"<>|]+/g, ' - ')
      .replace(/\s+/g, ' ')
      .trim() || 'Memora'
  return `${base}.${ext}`
}

/** Descarga un texto como archivo (en el celular aparece en «Descargas»). */
export function downloadFile(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob(['﻿', content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

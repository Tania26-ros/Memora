import { describe, expect, it } from 'vitest'
import { fileName, wordDocument } from './document'

describe('descargas', () => {
  it('arma un documento de Word con título y estilos', () => {
    const doc = wordDocument('La célula <repaso>', '<h1>Hola</h1>')
    expect(doc).toContain('<title>La célula repaso</title>')
    expect(doc).toContain('<h1>Hola</h1>')
    expect(doc).toContain('charset="utf-8"')
  })
  it('nombre de archivo seguro', () => {
    expect(fileName('La célula: repaso/1', 'doc')).toBe('La celula - repaso - 1.doc')
    expect(fileName('Año 🧪', 'doc')).toBe('Ano.doc')
    expect(fileName('  ', 'pdf')).toBe('Memora.pdf')
  })
})

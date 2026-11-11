import { describe, expect, it } from 'vitest'
import { detectLang, editDistance, gradeAnswer, matchSpokenOption } from './speech'

describe('voz', () => {
  it('adivina el idioma', () => {
    expect(detectLang('¿Qué es la célula y para qué sirve?')).toBe('es-ES')
    expect(detectLang('What is the function of the cell?')).toBe('en-US')
    expect(detectLang('Qu’est-ce que la cellule? Elle est la base de la vie')).toBe('fr-FR')
    expect(detectLang('细胞')).toBe('zh-CN')
    expect(detectLang('ok', 'en-US')).toBe('en-US')
  })
  it('distancia de edición', () => {
    expect(editDistance('casa', 'cosa')).toBe(1)
    expect(editDistance('', 'abc')).toBe(3)
  })
  it('correcto, casi o incorrecto', () => {
    expect(gradeAnswer('Canción', 'canción')).toBe('correcto')
    expect(gradeAnswer('¡apple!', 'Apple')).toBe('correcto')
    expect(gradeAnswer('cancion', 'canción')).toBe('casi')
    expect(gradeAnswer('aple', 'apple')).toBe('casi')
    expect(gradeAnswer(['banana', 'apple'], 'apple')).toBe('correcto')
    expect(gradeAnswer('pear', 'apple')).toBe('incorrecto')
  })
})

describe('responder hablando', () => {
  const opts = ['Ribosoma', 'Mitocondria', 'Núcleo', 'Lisosoma']
  it('por letra o por texto', () => {
    expect(matchSpokenOption(['la be'], opts)).toBe(1)
    expect(matchSpokenOption(['letra C'], opts)).toBe(2)
    expect(matchSpokenOption(['mitocondria'], opts)).toBe(1)
    expect(matchSpokenOption(['nucleo'], opts)).toBe(2)
    expect(matchSpokenOption(['es la mitocondria'], opts)).toBe(1)
    expect(matchSpokenOption(['no sé'], opts)).toBeNull()
  })
})

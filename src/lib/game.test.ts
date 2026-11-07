import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import {
  checkClassify, checkCloze, checkMatch, checkMcq, checkOrder, classifyItems, clozeSegments, clozeToDraft, correctAnswerText, parseClozeDraft, shuffle, validateQuestion,
  type ClassifyQuestion, type ClozeQuestion, type MatchQuestion, type McqQuestion, type OrderQuestion,
} from './questions'
import { answer, currentQid, isFinished, splitDoses, startSession, summary } from './session'
import { dueLabel, isDue, nextReview } from './srs'

const base = { id: 1, topicId: 1, difficulty: 'regular' as const, createdAt: 0 }

describe('completar espacios', () => {
  it('convierte [corchetes] en espacios y vuelve atrás', () => {
    const { text, answers } = parseClozeDraft('La [mitocondria] produce [ATP].')
    expect(text).toBe('La [[0]] produce [[1]].')
    expect(answers).toEqual(['mitocondria', 'ATP'])
    expect(clozeToDraft({ text, blanks: answers.map((a) => ({ answer: a, distractors: [] })) })).toBe('La [mitocondria] produce [ATP].')
    expect(clozeSegments(text).map((s) => s.kind)).toEqual(['text', 'blank', 'text', 'blank', 'text'])
  })

  it('acepta la respuesta sin importar mayúsculas ni tildes', () => {
    const q: ClozeQuestion = { ...base, type: 'cloze', prompt: '', text: '[[0]] y [[1]]', blanks: [{ answer: 'Célula', distractors: ['x'] }, { answer: 'ADN', distractors: ['y'] }] }
    expect(checkCloze(q, ['celula', 'adn'])).toBe(true)
    expect(checkCloze(q, ['celula', 'ARN'])).toBe(false)
  })

  it('pide entre 1 y 3 espacios con alternativas', () => {
    const q = { ...base, type: 'cloze' as const, prompt: '', text: 'x', blanks: [] }
    expect(validateQuestion(q)).toMatch(/corchetes/)
    expect(validateQuestion({ ...q, blanks: [{ answer: 'a', distractors: [] }] })).toMatch(/incorrecta/)
    expect(validateQuestion({ ...q, blanks: [{ answer: 'a', distractors: ['b'] }] })).toBeNull()
  })
})

describe('comprobar respuestas', () => {
  it('opción múltiple y unir', () => {
    const mcq: McqQuestion = { ...base, type: 'mcq', prompt: '?', options: ['a', 'b', 'c'], correct: 2 }
    expect(checkMcq(mcq, 2)).toBe(true)
    expect(checkMcq(mcq, 0)).toBe(false)
    const m: MatchQuestion = { ...base, type: 'match', prompt: '', pairs: [{ left: 'A', right: '1' }, { left: 'B', right: '2' }] }
    expect(checkMatch(m, [0, 1])).toBe(true)
    expect(checkMatch(m, [1, 0])).toBe(false)
  })

  it('mezclar no pierde elementos', () => {
    expect(shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5])
  })
})

describe('ronda: repetir hasta aprender', () => {
  it('una pregunta fallada vuelve al final y exige 2 aciertos seguidos', () => {
    let s = startSession([1, 2], 2)
    s = answer(s, 'fail') // 1 falla → al final
    expect(s.queue).toEqual([2, 1])
    s = answer(s, 'ok') // 2 acierta (1 de 2) → vuelve pronto
    expect(s.queue).toEqual([1, 2])
    s = answer(s, 'ok') // 1: 1 de 2
    s = answer(s, 'ok') // 2: 2 de 2 → aprendida
    expect(s.done).toEqual([2])
    expect(currentQid(s)).toBe(1)
    s = answer(s, 'ok') // 1: 2 de 2
    expect(isFinished(s)).toBe(true)
    const r = summary(s)
    expect(r.firstTry).toBe(1)
    expect(r.failed).toEqual([1])
  })

  it('divide en dosis', () => {
    expect(splitDoses([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})

describe('repaso espaciado', () => {
  it('fallar la programa para mañana; acertar la aleja más', () => {
    const now = new Date('2026-11-04T10:00:00Z')
    const fail = nextReview(undefined, { id: 1, topicId: 1 }, 'fail', now)
    expect(isDue(fail, now.getTime())).toBe(false)
    expect(isDue(fail, now.getTime() + 86_400_000)).toBe(true)
    expect(fail.wrong).toBe(1)
    const good = nextReview(undefined, { id: 1, topicId: 1 }, 'ok', now)
    expect(good.due).toBeGreaterThan(fail.due)
    let ok = nextReview(undefined, { id: 1, topicId: 1 }, 'easy', now)
    ok = nextReview(ok, { id: 1, topicId: 1 }, 'easy', new Date(ok.due))
    expect(ok.due - now.getTime()).toBeGreaterThan(3 * 86_400_000)
    expect(ok.correct).toBe(2)
  })

  it('etiqueta de próximo repaso', () => {
    const now = new Date('2026-11-04T10:00:00').getTime()
    expect(dueLabel(now, now)).toBe('hoy')
    expect(dueLabel(now + 86_400_000, now)).toBe('mañana')
    expect(dueLabel(now + 10 * 86_400_000, now)).toBe('en 10 días')
  })
})

describe('ordenar y clasificar', () => {
  const order: OrderQuestion = { ...base, type: 'order', prompt: 'Ordena', items: ['Profase', 'Metafase', 'Anafase', 'Telofase'] }
  it('ordenar: solo vale el orden correcto', () => {
    expect(checkOrder(order, [0, 1, 2, 3])).toBe(true)
    expect(checkOrder(order, [1, 0, 2, 3])).toBe(false)
    expect(checkOrder(order, [0, 1, 2])).toBe(false)
  })
  it('ordenar: pide al menos 3 pasos', () => {
    expect(validateQuestion({ ...order, items: ['a', 'b'] })).toMatch(/3 pasos/)
    expect(validateQuestion(order)).toBeNull()
  })
  const classify: ClassifyQuestion = { ...base, type: 'classify', prompt: '¿Animal o vegetal?', groups: [{ name: 'Animal', items: ['Centriolo'] }, { name: 'Vegetal', items: ['Pared celular', 'Cloroplasto'] }] }
  it('clasificar: cada elemento en su grupo', () => {
    const q = { ...classify, groups: classify.groups.map((g) => ({ name: g.name, items: [...g.items] })) }
    expect(classifyItems(q).map((i) => i.group)).toEqual([0, 1, 1])
    expect(checkClassify(q, [0, 1, 1])).toBe(true)
    expect(checkClassify(q, [1, 1, 1])).toBe(false)
    expect(validateQuestion(q)).toBeNull()
    expect(validateQuestion({ ...q, groups: [q.groups[0]] })).toMatch(/2 grupos/)
    expect(correctAnswerText(q)).toBe('Animal: Centriolo · Vegetal: Pared celular, Cloroplasto')
  })
})

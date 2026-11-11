import { expect, it } from 'vitest'
import { MAX_SECONDS, clampSeconds, clock, formatDuration, joinDuration, splitDuration } from './duration'

it('acepta de 1 segundo a 23 h 59 min 59 s', () => {
  expect(MAX_SECONDS).toBe(86399)
  expect(clampSeconds(0)).toBe(1)
  expect(clampSeconds(999999)).toBe(86399)
  expect(clampSeconds(NaN)).toBe(1)
})

it('convierte entre segundos y horas, minutos y segundos', () => {
  expect(splitDuration(3723)).toEqual({ h: 1, m: 2, s: 3 })
  expect(joinDuration(23, 59, 59)).toBe(MAX_SECONDS)
  expect(formatDuration(45)).toBe('45 s')
  expect(formatDuration(120)).toBe('2 min')
  expect(formatDuration(3903)).toBe('1 h 5 min 3 s')
  expect(formatDuration(0)).toBe('Sin tiempo')
  expect(clock(245)).toBe('4:05')
  expect(clock(3729)).toBe('1:02:09')
})

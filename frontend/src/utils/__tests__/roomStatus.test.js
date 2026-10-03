import { describe, it, expect } from 'vitest'
import { getRoomStatus, statusColor, statusLabel } from '../roomStatus'

describe('getRoomStatus', () => {
  it('classifies a strongly positive room as auspicious', () => {
    expect(getRoomStatus({ score: 10, max_score: 12 })).toBe('auspicious')
  })

  it('classifies a negative score as unfavourable', () => {
    expect(getRoomStatus({ score: -5, max_score: 10 })).toBe('unfavourable')
  })

  it('classifies a low positive score as inauspicious', () => {
    expect(getRoomStatus({ score: 2, max_score: 12 })).toBe('inauspicious')
  })

  it('treats zero-max zero-score (Generic Room) as neutral', () => {
    expect(getRoomStatus({ score: 0, max_score: 0 })).toBe('neutral')
  })

  it('treats missing/invalid scores as neutral', () => {
    expect(getRoomStatus({})).toBe('neutral')
    expect(getRoomStatus(null)).toBe('neutral')
  })

  it('accepts the maxScore camelCase alias', () => {
    expect(getRoomStatus({ score: 10, maxScore: 12 })).toBe('auspicious')
  })
})

describe('status color/label', () => {
  it('maps known statuses to colors', () => {
    expect(statusColor('auspicious')).toBe('#16A34A')
    expect(statusColor('unfavourable')).toBe('#DC2626')
    expect(statusColor('whatever')).toBe('#78716C')
  })

  it('maps statuses to labels', () => {
    expect(statusLabel('inauspicious')).toBe('Inauspicious')
    expect(statusLabel('bogus')).toBe('Neutral')
  })
})

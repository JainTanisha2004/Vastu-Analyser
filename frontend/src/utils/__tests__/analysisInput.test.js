import { describe, expect, it } from 'vitest'

import {
  buildAnalysisRequest,
  createAnalysisFingerprint,
  createRoomId,
  fromBackendNorthOffset,
  normalizeDegrees,
  toBackendNorthOffset,
} from '../analysisInput'

const room = {
  room_id: 'room-stable',
  type: 'Kitchen',
  x: 12.25,
  y: 33.75,
  confidence: 'medium',
  source: 'parsed',
  isNew: true,
}

describe('orientation contract', () => {
  it.each([
    [0, 0],
    [-0, 0],
    [22.5, 337.5],
    [359.5, 0.5],
    [360, 0],
    [720.25, 359.75],
    [-22.5, 22.5],
  ])('maps UI bearing %s to engine offset %s', (bearing, offset) => {
    expect(toBackendNorthOffset(bearing)).toBe(offset)
    expect(fromBackendNorthOffset(offset)).toBe(normalizeDegrees(bearing))
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 'north'])('rejects %s', (value) => {
    expect(() => normalizeDegrees(value)).toThrow('finite number')
  })
})

describe('analysis request contract', () => {
  it('preserves canonical identity while removing UI-only fields', () => {
    expect(buildAnalysisRequest(
      'file-123',
      22.5,
      { center_mode: 'manual', manual_center: { x: 50, y: 45 }, house_boundary: null },
      [room],
    )).toEqual({
      file_id: 'file-123',
      north_offset: 337.5,
      rooms: [{
        room_id: 'room-stable',
        type: 'Kitchen',
        x: 12.25,
        y: 33.75,
        confidence: 'medium',
        source: 'parsed',
      }],
      center_mode: 'manual',
      manual_center: { x: 50, y: 45 },
      house_boundary: null,
    })
  })

  it('keeps omitted and explicitly empty rooms distinct', () => {
    expect(buildAnalysisRequest('file', 0, {}, undefined).rooms).toBeUndefined()
    expect(buildAnalysisRequest('file', 0, {}, []).rooms).toEqual([])
  })

  it('requires IDs, finite coordinates, unique rooms, and an initialized manual centre', () => {
    expect(() => buildAnalysisRequest('file', 0, {}, [{ ...room, room_id: '' }]))
      .toThrow('stable room ID')
    expect(() => buildAnalysisRequest('file', 0, {}, [{ ...room, x: Number.NaN }]))
      .toThrow('finite coordinates')
    expect(() => buildAnalysisRequest('file', 0, {}, [room, room]))
      .toThrow('unique')
    expect(() => buildAnalysisRequest('file', 0, { center_mode: 'manual' }, [room]))
      .toThrow('manual centre')
  })

  it('fingerprints all analysis-relevant fields deterministically', () => {
    const center = { center_mode: 'automatic', manual_center: null, house_boundary: null }
    const first = createAnalysisFingerprint('file', 0, center, [room])
    expect(first).toBe(createAnalysisFingerprint('file', 360, center, [{ ...room }]))
    expect(first).not.toBe(createAnalysisFingerprint('file', 0.1, center, [room]))
    expect(first).not.toBe(createAnalysisFingerprint('file', 0, center, [{ ...room, x: 13 }]))
  })

  it('creates collision-resistant IDs only once per call', () => {
    const first = createRoomId()
    const second = createRoomId()
    expect(first).toMatch(/^manual-/)
    expect(second).toMatch(/^manual-/)
    expect(first).not.toBe(second)
  })
})

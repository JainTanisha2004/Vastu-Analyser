import { describe, expect, it } from 'vitest'

import {
  LEGACY_STORAGE_KEYS,
  SESSION_SCHEMA_VERSION,
  STORAGE_KEY,
  loadSaved,
  saveSession,
} from '../wizardSession'

const session = {
  currentStep: 2,
  fileId: 'file-123',
  filename: 'synthetic.dxf',
  sourceKind: 'dxf',
  rooms: [{ room_id: 'room-a', type: 'Kitchen', x: 1, y: 2, confidence: 'high', source: 'parsed' }],
  originalRooms: [{ room_id: 'room-a', type: 'Kitchen', x: 1, y: 2, confidence: 'high', source: 'parsed' }],
  drawingBounds: { min_x: 0, max_x: 10, min_y: 0, max_y: 10 },
  imageExtent: { x_min: -2, x_max: 12, y_min: -2, y_max: 12 },
  northOffset: 22.5,
  centerMode: 'automatic',
  manualCenter: null,
  houseBoundary: null,
}

describe('versioned wizard persistence', () => {
  it('round-trips a lightweight schema-versioned session', () => {
    expect(saveSession(session)).toBe(true)
    const envelope = JSON.parse(localStorage.getItem(STORAGE_KEY))
    expect(envelope.schemaVersion).toBe(SESSION_SCHEMA_VERSION)
    expect(envelope.session).toEqual(session)
    expect(loadSaved()).toEqual(session)
  })

  it('clears malformed, unknown-version, and legacy state', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json')
    expect(loadSaved()).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 99, session }))
    expect(loadSaved()).toBeNull()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.setItem(key, '{}'))
    expect(loadSaved()).toBeNull()
    LEGACY_STORAGE_KEYS.forEach((key) => expect(localStorage.getItem(key)).toBeNull())
  })

  it('rejects incomplete sessions and rooms without stable IDs', () => {
    expect(saveSession({ currentStep: 2 })).toBe(false)
    expect(saveSession({ ...session, rooms: [{ type: 'Kitchen', x: 1, y: 2 }] })).toBe(false)
  })
})

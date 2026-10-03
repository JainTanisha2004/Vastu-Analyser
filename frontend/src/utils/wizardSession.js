export const SESSION_SCHEMA_VERSION = 2
export const STORAGE_KEY = 'vastu.wizard.session.v2'
export const LEGACY_STORAGE_KEYS = ['vastu.wizard.session.v0', 'vastu.wizard.session.v1']
const MAX_STORED_BYTES = 1024 * 1024

function validRoom(room) {
  return Boolean(
    room
    && typeof room.room_id === 'string'
    && room.room_id.trim()
    && typeof room.type === 'string'
    && Number.isFinite(room.x)
    && Number.isFinite(room.y),
  )
}

function validPoint(point) {
  return point === null || Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y))
}

function validSession(session) {
  return Boolean(
    session
    && typeof session.fileId === 'string'
    && session.fileId.trim()
    && Number.isInteger(session.currentStep)
    && session.currentStep >= 0
    && session.currentStep <= 4
    && Array.isArray(session.rooms)
    && session.rooms.every(validRoom)
    && Array.isArray(session.originalRooms)
    && session.originalRooms.every(validRoom)
    && Number.isFinite(session.northOffset)
    && ['automatic', 'manual', 'boundary'].includes(session.centerMode)
    && validPoint(session.manualCenter)
    && (session.houseBoundary === null
      || (Array.isArray(session.houseBoundary) && session.houseBoundary.every(validPoint))),
  )
}

export function clearSaved(storage = localStorage) {
  try {
    storage.removeItem(STORAGE_KEY)
    LEGACY_STORAGE_KEYS.forEach((key) => storage.removeItem(key))
  } catch {
    // Storage can be unavailable in privacy modes; in-memory use still works.
  }
}

export function loadSaved(storage = localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) {
      LEGACY_STORAGE_KEYS.forEach((key) => storage.removeItem(key))
      return null
    }
    const envelope = JSON.parse(raw)
    if (envelope?.schemaVersion !== SESSION_SCHEMA_VERSION || !validSession(envelope.session)) {
      clearSaved(storage)
      return null
    }
    return envelope.session
  } catch {
    clearSaved(storage)
    return null
  }
}

export function saveSession(session, storage = localStorage) {
  try {
    if (!validSession(session)) return false
    const serialized = JSON.stringify({
      schemaVersion: SESSION_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      session,
    })
    if (serialized.length > MAX_STORED_BYTES) return false
    storage.setItem(STORAGE_KEY, serialized)
    LEGACY_STORAGE_KEYS.forEach((key) => storage.removeItem(key))
    return true
  } catch {
    return false
  }
}

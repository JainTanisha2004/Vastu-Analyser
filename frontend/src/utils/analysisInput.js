const CENTER_MODES = new Set(['automatic', 'manual', 'boundary'])
const ROOM_SOURCES = new Set(['parsed', 'manual', 'ocr_candidate'])
const CONFIDENCE_LEVELS = new Set(['high', 'medium', 'low'])

export function normalizeDegrees(value, label = 'Angle') {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) throw new TypeError(`${label} must be a finite number.`)
  const normalized = ((numeric % 360) + 360) % 360
  return Object.is(normalized, -0) || normalized === 0 ? 0 : normalized
}

// The UI bearing is clockwise from plan-up. The legacy backend engine offset
// is subtracted from mathematical room angles, so it is the negative bearing.
export function toBackendNorthOffset(compassBearing) {
  return normalizeDegrees(-normalizeDegrees(compassBearing, 'Compass orientation'))
}

export function fromBackendNorthOffset(engineOffset) {
  return normalizeDegrees(-normalizeDegrees(engineOffset, 'Engine north offset'))
}

function finitePoint(point, label) {
  if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) {
    throw new TypeError(`${label} must contain finite x and y coordinates.`)
  }
  return { x: Number(point.x), y: Number(point.y) }
}

function normalizeRoom(room) {
  const roomId = typeof room?.room_id === 'string' ? room.room_id.trim() : ''
  const type = typeof room?.type === 'string' ? room.type.trim() : ''
  if (!roomId) throw new TypeError('Every room must have a stable room ID.')
  if (!type) throw new TypeError(`Room ${roomId} must have a type.`)
  if (type.length > 80) throw new TypeError(`Room ${roomId} type is too long.`)
  if (!Number.isFinite(Number(room.x)) || !Number.isFinite(Number(room.y))) {
    throw new TypeError(`Room ${roomId} must have finite coordinates.`)
  }
  const confidence = room.confidence ?? 'high'
  const source = room.source ?? 'manual'
  if (!CONFIDENCE_LEVELS.has(confidence)) {
    throw new TypeError(`Room ${roomId} has an invalid confidence value.`)
  }
  if (!ROOM_SOURCES.has(source)) {
    throw new TypeError(`Room ${roomId} has an invalid source.`)
  }
  return {
    room_id: roomId,
    type,
    x: Number(room.x),
    y: Number(room.y),
    confidence,
    source,
  }
}

export function buildAnalysisRequest(fileId, compassBearing, centerParams = {}, rooms) {
  const normalizedFileId = typeof fileId === 'string' ? fileId.trim() : ''
  if (!normalizedFileId) throw new TypeError('Upload a floor plan before requesting analysis.')

  const centerMode = centerParams.center_mode ?? 'automatic'
  if (!CENTER_MODES.has(centerMode)) throw new TypeError('Select a valid centre mode.')
  const manualCenter = centerParams.manual_center == null
    ? null
    : finitePoint(centerParams.manual_center, 'Manual centre')
  if (centerMode === 'manual' && !manualCenter) {
    throw new TypeError('Set the manual centre point before continuing.')
  }
  const houseBoundary = centerParams.house_boundary == null
    ? null
    : centerParams.house_boundary.map((point) => finitePoint(point, 'Boundary point'))

  let normalizedRooms
  if (rooms !== undefined) {
    normalizedRooms = rooms.map(normalizeRoom)
    const roomIds = normalizedRooms.map((room) => room.room_id)
    if (new Set(roomIds).size !== roomIds.length) {
      throw new TypeError('Room IDs must be unique.')
    }
  }

  return {
    file_id: normalizedFileId,
    north_offset: toBackendNorthOffset(compassBearing),
    rooms: normalizedRooms,
    center_mode: centerMode,
    manual_center: manualCenter,
    house_boundary: houseBoundary,
  }
}

export function createAnalysisFingerprint(fileId, compassBearing, centerParams, rooms) {
  return JSON.stringify(buildAnalysisRequest(fileId, compassBearing, centerParams, rooms))
}

export function createRoomId(source = 'manual') {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === 'function') {
    return `${source}-${cryptoApi.randomUUID()}`
  }
  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    cryptoApi.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${source}-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  throw new Error('This browser cannot create a secure room identifier.')
}

export function getScoredRooms(analysisData) {
  return Array.isArray(analysisData?.scored_rooms) ? analysisData.scored_rooms : []
}

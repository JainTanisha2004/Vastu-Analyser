import { describe, expect, it } from 'vitest'

import { createEditorHistory } from '../editorHistory'

const initial = {
  rooms: [{ room_id: 'room-a', type: 'Kitchen', x: 1, y: 2 }],
  northOffset: 0,
  centerMode: 'automatic',
  manualCenter: null,
  houseBoundary: null,
}

describe('transactional editor history', () => {
  it('records many drag updates as one user intent', () => {
    const history = createEditorHistory(initial)
    history.beginTransaction()
    history.apply((state) => ({ ...state, rooms: [{ ...state.rooms[0], x: 5 }] }))
    history.apply((state) => ({ ...state, rooms: [{ ...state.rooms[0], x: 9 }] }))
    history.commitTransaction()

    expect(history.getSnapshot().rooms[0].x).toBe(9)
    expect(history.undo().rooms[0].x).toBe(1)
    expect(history.redo().rooms[0].x).toBe(9)
  })

  it('preserves redo across undo and clears it only after a new action', () => {
    const history = createEditorHistory(initial)
    history.apply((state) => ({ ...state, northOffset: 22.5 }))
    history.apply((state) => ({ ...state, centerMode: 'manual', manualCenter: { x: 5, y: 5 } }))
    history.undo()
    expect(history.canRedo()).toBe(true)
    history.redo()
    expect(history.getSnapshot().centerMode).toBe('manual')
    history.undo()
    history.apply((state) => ({ ...state, northOffset: 45 }))
    expect(history.canRedo()).toBe(false)
  })

  it('does not record server normalization, reset, or replacement', () => {
    const history = createEditorHistory(initial)
    history.replace({ ...initial, northOffset: 90 })
    expect(history.canUndo()).toBe(false)
    history.apply((state) => ({ ...state, northOffset: 45 }))
    expect(history.canUndo()).toBe(true)
    history.reset(initial)
    expect(history.canUndo()).toBe(false)
    expect(history.canRedo()).toBe(false)
  })

  it('bounds retained history by entry count', () => {
    const history = createEditorHistory(initial, { maxEntries: 2 })
    history.apply((state) => ({ ...state, northOffset: 1 }))
    history.apply((state) => ({ ...state, northOffset: 2 }))
    history.apply((state) => ({ ...state, northOffset: 3 }))
    expect(history.undo().northOffset).toBe(2)
    expect(history.undo().northOffset).toBe(1)
    expect(history.canUndo()).toBe(false)
  })
})

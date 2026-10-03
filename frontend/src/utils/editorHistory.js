const DEFAULT_MAX_ENTRIES = 50
const DEFAULT_MAX_SNAPSHOT_BYTES = 512 * 1024

const clone = (value) => JSON.parse(JSON.stringify(value))
const serialize = (value) => JSON.stringify(value)

export function createEditorHistory(initialState, options = {}) {
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
  const maxSnapshotBytes = options.maxSnapshotBytes ?? DEFAULT_MAX_SNAPSHOT_BYTES
  let current = clone(initialState)
  let past = []
  let future = []
  let transactionStart = null

  const same = (first, second) => serialize(first) === serialize(second)
  const pushPast = (snapshot) => {
    const serialized = serialize(snapshot)
    if (serialized.length > maxSnapshotBytes) return
    past.push(serialized)
    if (past.length > maxEntries) past = past.slice(-maxEntries)
  }
  const resolveNext = (nextOrUpdater) => (
    typeof nextOrUpdater === 'function'
      ? nextOrUpdater(clone(current))
      : nextOrUpdater
  )

  return {
    getSnapshot() {
      return clone(current)
    },
    canUndo() {
      return past.length > 0
    },
    canRedo() {
      return future.length > 0
    },
    beginTransaction() {
      if (transactionStart === null) transactionStart = clone(current)
    },
    apply(nextOrUpdater, { record = true } = {}) {
      const next = clone(resolveNext(nextOrUpdater))
      if (same(current, next)) return this.getSnapshot()
      if (record && transactionStart === null) {
        pushPast(current)
        future = []
      }
      current = next
      return this.getSnapshot()
    },
    commitTransaction() {
      if (transactionStart === null) return this.getSnapshot()
      if (!same(transactionStart, current)) {
        pushPast(transactionStart)
        future = []
      }
      transactionStart = null
      return this.getSnapshot()
    },
    cancelTransaction() {
      if (transactionStart !== null) current = transactionStart
      transactionStart = null
      return this.getSnapshot()
    },
    replace(nextState) {
      transactionStart = null
      current = clone(nextState)
      return this.getSnapshot()
    },
    undo() {
      this.commitTransaction()
      if (!past.length) return this.getSnapshot()
      future.push(serialize(current))
      current = JSON.parse(past.pop())
      return this.getSnapshot()
    },
    redo() {
      this.commitTransaction()
      if (!future.length) return this.getSnapshot()
      pushPast(current)
      current = JSON.parse(future.pop())
      return this.getSnapshot()
    },
    reset(nextState) {
      current = clone(nextState)
      past = []
      future = []
      transactionStart = null
      return this.getSnapshot()
    },
  }
}

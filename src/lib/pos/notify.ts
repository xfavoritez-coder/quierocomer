// ── DB change notifier ───────────────────────────────────────────
// Standalone module to avoid circular dependencies.
// Any module that writes to IndexedDB calls notifyDbChange().
// The hooks module subscribes to re-run queries.

let _dbVersion = 0
const _listeners = new Set<() => void>()

export function notifyDbChange() {
  _dbVersion++
  _listeners.forEach(cb => cb())
}

export function getDbVersion(): number {
  return _dbVersion
}

export function subscribeDbChange(cb: () => void): () => void {
  _listeners.add(cb)
  return () => _listeners.delete(cb)
}

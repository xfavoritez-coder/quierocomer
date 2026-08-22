// ── DB change notifier ───────────────────────────────────────────
// Standalone module to avoid circular dependencies.
// Any module that writes to IndexedDB calls notifyDbChange().
// The hooks module subscribes to re-run queries.

let _dbVersion = 0
const _listeners = new Set<() => void>()

// ── Confirmed-online flag ─────────────────────────────────────────
// Set by sync.ts when a Supabase push/pull succeeds. Used by usePosNav
// to decide between router.push() (fast) and location.assign() (safe offline).
let _lastOnlineAt = 0
export function markOnline() { _lastOnlineAt = Date.now() }
/** True if we had confirmed connectivity in the last 15 seconds */
export function isConfirmedOnline(): boolean { return Date.now() - _lastOnlineAt < 15_000 }

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

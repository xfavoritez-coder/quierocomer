import { posDb } from './db'
import { projectEvent, rebuildFromEvents } from './events'
import { notifyDbChange, markOnline } from './notify'
import { supabase } from '@/lib/supabase'
import type { PosEvent } from './types'

// ── Config ───────────────────────────────────────────────────────

const BATCH_SIZE = 50
const SYNC_INTERVAL_MS = 3_000
const MAX_RETRIES = 10

let _syncTimer: ReturnType<typeof setInterval> | null = null
let _isSyncing = false
let _restaurantId = ''
let _onSyncStatusChange: ((syncing: boolean) => void) | null = null

// ── "Primera sincronización lista" ───────────────────────────────
// A diferencia de `syncing` (que se prende/apaga en CADA ciclo incremental, y por
// eso no sirve para gatear UI sin parpadear), este flag se vuelve true cuando la
// sincronización INICIAL del local terminó y ya NO vuelve a false hasta cambiar de
// local (lo cual recarga la página). Sirve para distinguir "cargando" de "cerrada".
let _initialSyncDone = false
const _readyListeners = new Set<(v: boolean) => void>()
function setInitialSyncDone(v: boolean) {
  _initialSyncDone = v
  _readyListeners.forEach((f) => f(v))
}
export function subscribePosReady(fn: (v: boolean) => void): () => void {
  _readyListeners.add(fn)
  fn(_initialSyncDone)
  return () => { _readyListeners.delete(fn) }
}

// ── Public API ───────────────────────────────────────────────────

export function startSync(restaurantId: string, onStatusChange?: (syncing: boolean) => void) {
  _onSyncStatusChange = onStatusChange ?? null

  // Idempotente: si ya está corriendo para ESTE mismo local (otro componente ya
  // llamó startSync, p.ej. la página del POS + el panel de caja a la vez), no se
  // reinicia — reiniciar re-pullearía todo y resetearía `ready` (flash de carga).
  if (_restaurantId === restaurantId && (_isSyncing || _syncTimer)) {
    onStatusChange?.(_isSyncing)
    return
  }
  _restaurantId = restaurantId

  if (_syncTimer) clearInterval(_syncTimer)

  // Full initial pull + rebuild on startup, then start incremental interval
  _isSyncing = true
  _onSyncStatusChange?.(true)
  setInitialSyncDone(false)
  initialSync(restaurantId)
    .catch(err => console.error('[POS Sync] Initial sync error:', err))
    .finally(() => {
      _isSyncing = false
      _onSyncStatusChange?.(false)
      setInitialSyncDone(true)
      _syncTimer = setInterval(syncCycle, SYNC_INTERVAL_MS)
    })

  // Flush pending events immediately when connection returns or tab gets focus
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline)
    window.addEventListener('focus', handleOnline)
    document.addEventListener('visibilitychange', handleVisibility)
  }

  // Listen for Supabase Realtime events from other devices
  subscribeToRemoteEvents(restaurantId)
}

// ── Initial sync: push pending + pull ALL + rebuild ───────────────

async function initialSync(restaurantId: string): Promise<void> {
  // 0. Auto-reparación: re-encolar eventos locales que nunca se sincronizaron.
  //    Pudieron quedar fuera de la cola por un error "tabla inexistente" (42P01)
  //    antes de que pos_events existiera. Siguen en el store `events` con
  //    synced=0, así que los volvemos a poner en la cola para que suban.
  await requeueUnsyncedEvents(restaurantId)

  // 1. Push any locally pending events first
  await pushEvents()

  // 2. Pull ALL events from Supabase (paginated from beginning)
  if (supabase) {
    let cursor = 0
    while (true) {
      const { data, error } = await supabase
        .from('pos_events')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .gt('server_seq', cursor)
        .order('server_seq', { ascending: true })
        .limit(BATCH_SIZE)

      if (error) {
        console.error('[POS Sync] Initial pull error:', error)
        break
      }
      if (!data || data.length === 0) break

      for (const row of data) {
        // Always put (overwrite) to ensure server_seq and synced are set
        await posDb.events.put({
          event_id: row.event_id as string,
          device_id: row.device_id as string,
          user_id: row.user_id as string,
          restaurant_id: row.restaurant_id as string,
          created_at_local: row.created_at_local as string,
          type: row.type as PosEvent['type'],
          payload: row.payload as Record<string, unknown>,
          synced: 1,
          server_seq: row.server_seq as number,
        })
      }

      cursor = data[data.length - 1].server_seq as number
      if (data.length < BATCH_SIZE) break
    }

    markOnline()
  }

  // 2.5 Reparación: si hay eventos locales pero NINGUNO proviene del servidor
  //     (ninguno tiene server_seq), el servidor no tiene nuestros datos — p. ej.
  //     la tabla pos_events se creó después y los eventos quedaron marcados
  //     synced=1 sin haber subido nunca. Re-subimos TODO (upsert idempotente).
  if (supabase) {
    const localAll = (await posDb.events.toArray()).filter(e => e.restaurant_id === restaurantId)
    const fromServer = localAll.filter(e => (e.server_seq ?? 0) > 0).length
    if (localAll.length > 0 && fromServer === 0) {
      const queued = new Set((await posDb.syncQueue.toArray()).map(q => q.event_id))
      await posDb.transaction('rw', [posDb.events, posDb.syncQueue], async () => {
        for (const e of localAll) await posDb.events.update(e.event_id, { synced: 0 })
        const toAdd = localAll.filter(e => !queued.has(e.event_id))
        if (toAdd.length) await posDb.syncQueue.bulkAdd(
          toAdd.map(e => ({ event_id: e.event_id, created_at: e.created_at_local, retries: 0 }))
        )
      })
      console.warn(`[POS Sync] Reparación: re-subiendo ${localAll.length} eventos locales (el servidor no tenía ninguno)`)
      // Drenar la cola (BATCH_SIZE=50 por pasada)
      await pushEvents()
      await pushEvents()
      await pushEvents()
      markOnline()
    }
  }

  // 3. Rebuild projected state from ALL local events (clean replay)
  await rebuildFromEvents(restaurantId)
  notifyDbChange()
}

// Re-encola los eventos locales con synced=0 que ya no están en la cola de sync.
// Red de seguridad: ningún evento local queda varado aunque un error lo haya
// sacado de la cola en el pasado. Idempotente (no duplica entradas en la cola).
async function requeueUnsyncedEvents(restaurantId: string): Promise<void> {
  const unsynced = await posDb.events
    .where('[restaurant_id+synced]')
    .equals([restaurantId, 0])
    .toArray()
  if (unsynced.length === 0) return

  const queued = new Set((await posDb.syncQueue.toArray()).map(q => q.event_id))
  const toAdd = unsynced.filter(e => !queued.has(e.event_id))
  if (toAdd.length === 0) return

  await posDb.syncQueue.bulkAdd(
    toAdd.map(e => ({ event_id: e.event_id, created_at: e.created_at_local, retries: 0 }))
  )
  console.warn(`[POS Sync] Re-encolados ${toAdd.length} evento(s) local(es) sin sincronizar`)
  notifyDbChange()
}

export function stopSync() {
  if (_syncTimer) {
    clearInterval(_syncTimer)
    _syncTimer = null
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('focus', handleOnline)
    document.removeEventListener('visibilitychange', handleVisibility)
  }
  unsubscribeFromRemoteEvents()
}


export async function forceSyncNow() {
  await syncCycle()
}

/**
 * Barrera de sincronización para CERRAR TURNO: fuerza la subida de TODOS los
 * eventos locales del restaurante a la nube y confirma que no quede ninguno
 * pendiente. Devuelve { ok, pending }. ok=true solo cuando pending===0 (todo
 * subido). Si está offline o el push falla, ok=false y pending > 0 → el turno
 * NO debe cerrarse (garantía de cero pérdida de datos).
 */
export async function flushAndVerify(restaurantId: string): Promise<{ ok: boolean; pending: number }> {
  const countPending = () =>
    posDb.events.where('[restaurant_id+synced]').equals([restaurantId, 0]).count()

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, pending: await countPending() }
  }

  // Red de seguridad: re-encolar cualquier evento local no sincronizado que se
  // haya quedado fuera de la cola, y drenar la cola hasta vaciarla o estancarse.
  await requeueUnsyncedEvents(restaurantId)
  let prev = -1
  for (let i = 0; i < 40; i++) {
    const q = await posDb.syncQueue.count()
    if (q === 0) break
    await pushEvents()
    const now = await posDb.syncQueue.count()
    if (now === q && now === prev) break // dos pasadas sin progreso → estancado
    prev = q
  }

  const pending = await countPending()
  return { ok: pending === 0, pending }
}

// ── Sync cycle: push then pull ───────────────────────────────────

// Small delay after 'online' event — browser fires it before DNS/TCP is truly ready
function handleOnline() {
  setTimeout(syncCycle, 500)
}

function handleVisibility() {
  if (document.visibilityState === 'visible') {
    syncCycle()
  }
}

async function syncCycle() {
  if (_isSyncing || !navigator.onLine) return

  // Only show "sincronizando" if there's actually something to sync
  const pendingCount = await posDb.syncQueue.count()
  const hasPending = pendingCount > 0

  _isSyncing = true
  if (hasPending) _onSyncStatusChange?.(true)

  try {
    await pushEvents()
    await pullEvents()
    markOnline()
  } catch (err) {
    console.error('[POS Sync] Unhandled error in sync cycle:', err)
  } finally {
    _isSyncing = false
    _onSyncStatusChange?.(false)
  }
}

// ── Push: local → Supabase ───────────────────────────────────────

async function pushEvents() {
  if (!supabase) return // Supabase not configured (missing env vars)

  const pending = await posDb.syncQueue
    .orderBy('id')
    .limit(BATCH_SIZE)
    .toArray()

  if (pending.length === 0) return

  // Fetch the actual events
  const eventIds = pending.map(p => p.event_id)
  const events = await posDb.events
    .where('event_id')
    .anyOf(eventIds)
    .toArray()

  if (events.length === 0) {
    // Events were deleted but queue entries remain — clean up
    await posDb.syncQueue.where('id').anyOf(pending.map(p => p.id!)).delete()
    notifyDbChange()
    return
  }

  // Upsert to Supabase (idempotent by event_id unique constraint)
  const rows = events.map(e => ({
    event_id: e.event_id,
    device_id: e.device_id,
    user_id: e.user_id,
    restaurant_id: e.restaurant_id,
    created_at_local: e.created_at_local,
    type: e.type,
    payload: e.payload,
  }))

  const { error } = await supabase
    .from('pos_events')
    .upsert(rows, { onConflict: 'event_id', ignoreDuplicates: true })

  if (error) {
    console.error('[POS Sync] Push error:', error.code, error.message, error.details)

    // Errores realmente irrecuperables (dato inválido) — descartar de inmediato.
    // OJO: 42P01 (tabla inexistente) NO va aquí: es transitorio (p. ej. la tabla
    // pos_events aún no creada) y descartar por eso borraría pedidos. Se reintenta.
    const unrecoverable = ['23503', '42703']
    if (unrecoverable.includes(error.code)) {
      console.warn('[POS Sync] Unrecoverable error — dropping events:', error.code, error.message)
      await posDb.syncQueue.where('id').anyOf(pending.map(p => p.id!)).delete()
      notifyDbChange()
      return
    }

    // Recoverable errors: increment retry count, drop if exhausted
    let changed = false
    for (const entry of pending) {
      if (entry.retries >= MAX_RETRIES) {
        await posDb.syncQueue.delete(entry.id!)
        console.warn(`[POS Sync] Dropped event ${entry.event_id} after ${MAX_RETRIES} retries`)
        changed = true
      } else {
        await posDb.syncQueue.update(entry.id!, { retries: entry.retries + 1 })
      }
    }
    if (changed) notifyDbChange()
    return
  }

  // Mark as synced locally
  await posDb.transaction('rw', [posDb.events, posDb.syncQueue], async () => {
    for (const e of events) {
      await posDb.events.update(e.event_id, { synced: 1 })
    }
    await posDb.syncQueue.where('id').anyOf(pending.map(p => p.id!)).delete()
  })

  // Notify React so usePendingSyncCount re-reads the queue
  notifyDbChange()
}

// ── Pull: Supabase → local ───────────────────────────────────────

async function pullEvents() {
  if (!supabase) return

  // Get the highest server_seq we have locally
  const lastLocal = await posDb.events
    .where('server_seq')
    .above(0)
    .last()

  const cursor = lastLocal?.server_seq ?? 0

  const { data, error } = await supabase
    .from('pos_events')
    .select('*')
    .eq('restaurant_id', _restaurantId)
    .gt('server_seq', cursor)
    .order('server_seq', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) {
    console.error('[POS Sync] Pull error:', error)
    return
  }

  if (!data || data.length === 0) return

  for (const row of data) {
    // Skip events we already have (from this device)
    const existing = await posDb.events.get(row.event_id)
    if (existing) {
      // Just update server_seq if we didn't have it
      if (!existing.server_seq) {
        await posDb.events.update(row.event_id, { server_seq: row.server_seq, synced: 1 })
      }
      continue
    }

    // New remote event — store and project
    const event: PosEvent = {
      event_id: row.event_id,
      device_id: row.device_id,
      user_id: row.user_id,
      restaurant_id: row.restaurant_id,
      created_at_local: row.created_at_local,
      type: row.type,
      payload: row.payload,
      synced: 1,
      server_seq: row.server_seq,
    }

    await posDb.events.put(event)
    await projectEvent(event)
    notifyDbChange()
  }
}

// ── Supabase Realtime (live sync when online) ────────────────────

let _realtimeChannel: ReturnType<typeof supabase.channel> | null = null

function subscribeToRemoteEvents(restaurantId: string) {
  if (!supabase) return

  _realtimeChannel = supabase
    .channel(`pos_events_${restaurantId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'pos_events',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      () => {
        // Realtime notification: new event from another device.
        // Trigger a sync cycle to pull it properly (avoids inline projection bugs).
        syncCycle()
      }
    )
    .subscribe()
}

function unsubscribeFromRemoteEvents() {
  if (_realtimeChannel) {
    supabase.removeChannel(_realtimeChannel)
    _realtimeChannel = null
  }
}

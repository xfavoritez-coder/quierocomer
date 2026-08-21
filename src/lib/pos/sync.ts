import { posDb } from './db'
import { projectEvent } from './events'
import { notifyDbChange } from './notify'
import { supabase } from '@/lib/supabase'
import type { PosEvent } from './types'

// ── Config ───────────────────────────────────────────────────────

const BATCH_SIZE = 50
const SYNC_INTERVAL_MS = 5_000
const MAX_RETRIES = 10

let _syncTimer: ReturnType<typeof setInterval> | null = null
let _isSyncing = false
let _restaurantId = ''
let _onSyncStatusChange: ((syncing: boolean) => void) | null = null

// ── Public API ───────────────────────────────────────────────────

export function startSync(restaurantId: string, onStatusChange?: (syncing: boolean) => void) {
  _restaurantId = restaurantId
  _onSyncStatusChange = onStatusChange ?? null

  if (_syncTimer) clearInterval(_syncTimer)

  // Sync immediately, then on interval
  syncCycle()
  _syncTimer = setInterval(syncCycle, SYNC_INTERVAL_MS)

  // Flush pending events immediately when connection returns
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline)
  }

  // Listen for Supabase Realtime events from other devices
  subscribeToRemoteEvents(restaurantId)
}

export function stopSync() {
  if (_syncTimer) {
    clearInterval(_syncTimer)
    _syncTimer = null
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', handleOnline)
  }
  unsubscribeFromRemoteEvents()
}


export async function forceSyncNow() {
  await syncCycle()
}

// ── Sync cycle: push then pull ───────────────────────────────────

// Small delay after 'online' event — browser fires it before DNS/TCP is truly ready
function handleOnline() {
  setTimeout(syncCycle, 500)
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
  } catch (err) {
    console.error('[POS Sync] Error:', err)
  } finally {
    _isSyncing = false
    _onSyncStatusChange?.(false)
  }
}

// ── Push: local → Supabase ───────────────────────────────────────

async function pushEvents() {
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
    console.error('[POS Sync] Push error:', error)

    // FK violation (e.g. test-restaurant doesn't exist) — drop immediately, no point retrying
    if (error.code === '23503') {
      console.warn('[POS Sync] FK violation — dropping events (invalid restaurant_id?)')
      await posDb.syncQueue.where('id').anyOf(pending.map(p => p.id!)).delete()
      return
    }

    // Other errors: increment retry count
    for (const entry of pending) {
      if (entry.retries >= MAX_RETRIES) {
        await posDb.syncQueue.delete(entry.id!)
        console.warn(`[POS Sync] Dropped event ${entry.event_id} after ${MAX_RETRIES} retries`)
      } else {
        await posDb.syncQueue.update(entry.id!, { retries: entry.retries + 1 })
      }
    }
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
  // Get the highest server_seq we have locally
  const lastLocal = await posDb.events
    .orderBy('server_seq')
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
      async (payload) => {
        const row = payload.new as Record<string, unknown>
        const eventId = row.event_id as string

        // Skip our own events
        const existing = await posDb.events.get(eventId)
        if (existing) return

        const event: PosEvent = {
          event_id: eventId,
          device_id: row.device_id as string,
          user_id: row.user_id as string,
          restaurant_id: row.restaurant_id as string,
          created_at_local: row.created_at_local as string,
          type: row.type as PosEvent['type'],
          payload: row.payload as Record<string, unknown>,
          synced: 1,
          server_seq: row.server_seq as number,
        }

        await posDb.events.put(event)
        await projectEvent(event)
        notifyDbChange()
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

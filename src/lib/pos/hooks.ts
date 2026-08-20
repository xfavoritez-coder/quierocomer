'use client'

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import { posDb } from './db'
import { startSync, stopSync } from './sync'
import type { Account, CashSession } from './types'
import { useLiveQuery } from 'dexie-react-hooks'

// ── Online status ────────────────────────────────────────────────

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

function getOnlineSnapshot() {
  return navigator.onLine
}

function getOnlineServerSnapshot() {
  return true // SSR always assumes online
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getOnlineServerSnapshot)
}

// ── Sync status ──────────────────────────────────────────────────

export function usePosSync(restaurantId: string) {
  const [syncing, setSyncing] = useState(false)
  const online = useOnlineStatus()

  useEffect(() => {
    if (!restaurantId) return
    startSync(restaurantId, setSyncing)
    return () => stopSync()
  }, [restaurantId])

  return { syncing, online }
}

// ── Pending sync count ───────────────────────────────────────────

export function usePendingSyncCount(): number {
  return useLiveQuery(() => posDb.syncQueue.count(), [], 0)
}

// ── Accounts ─────────────────────────────────────────────────────

export function useOpenAccounts(): Account[] {
  return useLiveQuery(
    () => posDb.accounts.where('status').anyOf(['abierta', 'con_pedidos', 'cuenta_pedida', 'pagada_parcial']).toArray(),
    [],
    []
  )
}

export function useAccount(accountId: string | null): Account | undefined {
  return useLiveQuery(
    () => accountId ? posDb.accounts.get(accountId) : undefined,
    [accountId],
    undefined
  )
}

// ── Cash session ─────────────────────────────────────────────────

export function useOpenCashSession(): CashSession | undefined {
  return useLiveQuery(
    () => posDb.cashSessions.filter(s => s.is_open).first(),
    [],
    undefined
  )
}

// ── Events (for debug UI) ────────────────────────────────────────

export function useRecentEvents(limit = 20) {
  return useLiveQuery(
    () => posDb.events.orderBy('created_at_local').reverse().limit(limit).toArray(),
    [limit],
    []
  )
}

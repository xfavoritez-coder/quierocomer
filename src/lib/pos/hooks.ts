'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { posDb } from './db'
import { startSync, stopSync } from './sync'
import type { Account, CashSession } from './types'
import type { CachedProduct } from './types'
import { refreshCatalog } from './catalog'
import { notifyDbChange, getDbVersion, subscribeDbChange } from './notify'

function useDbVersion(): number {
  return useSyncExternalStore(subscribeDbChange, getDbVersion, () => 0)
}

export { notifyDbChange }

function useDexieQuery<T>(querier: () => Promise<T>, deps: unknown[], defaultValue: T): T {
  const [value, setValue] = useState<T>(defaultValue)
  const dbVersion = useDbVersion()

  useEffect(() => {
    let cancelled = false
    querier().then(result => {
      if (!cancelled) setValue(result)
    }).catch(err => {
      console.error('[POS DB Query]', err)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, dbVersion])

  return value
}

// ── Online status ────────────────────────────────────────────────

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
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
  return useDexieQuery(() => posDb.syncQueue.count(), [], 0)
}

// ── Accounts ─────────────────────────────────────────────────────

export function useOpenAccounts(): Account[] {
  return useDexieQuery(
    () => posDb.accounts.where('status').anyOf(['abierta', 'con_pedidos', 'cuenta_pedida', 'pagada_parcial']).toArray(),
    [],
    []
  )
}

export function useAccount(accountId: string | null): Account | undefined {
  return useDexieQuery(
    () => accountId ? posDb.accounts.get(accountId).then(a => a ?? undefined) : Promise.resolve(undefined),
    [accountId],
    undefined
  )
}

// ── Cash session ─────────────────────────────────────────────────

export function useOpenCashSession(): CashSession | undefined {
  return useDexieQuery(
    () => posDb.cashSessions.filter(s => s.is_open).first().then(s => s ?? undefined),
    [],
    undefined
  )
}

// ── Catalog ──────────────────────────────────────────────────────

type CatalogCategory = { id: string; name: string; position: number }

export function useCatalog(restaurantId: string) {
  const [refreshCount, setRefreshCount] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const online = useOnlineStatus()

  // Step 1: refresh catalog from server (writes to IndexedDB)
  useEffect(() => {
    if (!restaurantId || !online) return
    let cancelled = false

    setRefreshing(true)
    refreshCatalog(restaurantId)
      .catch(err => console.error('[POS] Catalog refresh error:', err))
      .finally(() => {
        if (!cancelled) {
          setRefreshCount(c => c + 1)
          setRefreshing(false)
        }
      })

    return () => { cancelled = true }
  }, [restaurantId, online])

  // Step 2: read products from IndexedDB (re-runs when refreshCount bumps)
  const products: CachedProduct[] = useDexieQuery(
    () => posDb.products.where('restaurant_id').equals(restaurantId).toArray(),
    [restaurantId, refreshCount],
    [] as CachedProduct[]
  )

  const categories: CatalogCategory[] = useDexieQuery(
    () => posDb.products
      .where('restaurant_id')
      .equals(restaurantId)
      .toArray()
      .then(prods => {
        const catMap = new Map<string, CatalogCategory>()
        for (const p of prods) {
          if (!catMap.has(p.category_id)) {
            catMap.set(p.category_id, {
              id: p.category_id,
              name: p.category_name,
              position: p.category_position,
            })
          }
        }
        return Array.from(catMap.values()).sort((a, b) => a.position - b.position)
      }),
    [restaurantId, refreshCount],
    [] as CatalogCategory[]
  )

  const loading = products.length === 0 && refreshing

  return { products, categories, loading }
}

export function useCategoryProducts(restaurantId: string, categoryId: string | null): CachedProduct[] {
  return useDexieQuery(
    () => {
      if (!categoryId) {
        return posDb.products.where('restaurant_id').equals(restaurantId).sortBy('position')
      }
      return posDb.products.where('category_id').equals(categoryId).sortBy('position')
    },
    [restaurantId, categoryId],
    []
  )
}

// ── Events (for debug) ──────────────────────────────────────────

export function useRecentEvents(limit = 20) {
  return useDexieQuery(
    () => posDb.events.orderBy('created_at_local').reverse().limit(limit).toArray(),
    [limit],
    []
  )
}

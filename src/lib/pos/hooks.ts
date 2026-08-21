'use client'

import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react'
import { posDb } from './db'
import { startSync, stopSync } from './sync'
import type { Account, CashSession } from './types'
import type { CachedProduct } from './types'
import { refreshCatalog } from './catalog'
import { liveQuery } from 'dexie'

// ── Dexie live query hook (React 19 compatible) ──────────────────
// dexie-react-hooks can have issues with React 19, so we use our own

function useDexieLiveQuery<T>(querier: () => Promise<T>, deps: unknown[], defaultValue: T): T {
  const [value, setValue] = useState<T>(defaultValue)

  useEffect(() => {
    const observable = liveQuery(querier)
    const subscription = observable.subscribe({
      next: (result) => setValue(result),
      error: (err) => console.error('[Dexie LiveQuery]', err),
    })
    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

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
  return useDexieLiveQuery(() => posDb.syncQueue.count(), [], 0)
}

// ── Accounts ─────────────────────────────────────────────────────

export function useOpenAccounts(): Account[] {
  return useDexieLiveQuery(
    () => posDb.accounts.where('status').anyOf(['abierta', 'con_pedidos', 'cuenta_pedida', 'pagada_parcial']).toArray(),
    [],
    []
  )
}

export function useAccount(accountId: string | null): Account | undefined {
  return useDexieLiveQuery(
    () => accountId ? posDb.accounts.get(accountId).then(a => a ?? undefined) : Promise.resolve(undefined),
    [accountId],
    undefined
  )
}

// ── Cash session ─────────────────────────────────────────────────

export function useOpenCashSession(): CashSession | undefined {
  return useDexieLiveQuery(
    () => posDb.cashSessions.filter(s => s.is_open).first().then(s => s ?? undefined),
    [],
    undefined
  )
}

// ── Catalog ──────────────────────────────────────────────────────

export function useCatalog(restaurantId: string) {
  const [refreshing, setRefreshing] = useState(false)
  const online = useOnlineStatus()

  // Refresh catalog from server when online
  useEffect(() => {
    if (!restaurantId || !online) return
    let cancelled = false

    async function refresh() {
      setRefreshing(true)
      try {
        await refreshCatalog(restaurantId)
      } catch (err) {
        console.error('[POS] Catalog refresh error:', err)
      } finally {
        if (!cancelled) setRefreshing(false)
      }
    }

    refresh()
    return () => { cancelled = true }
  }, [restaurantId, online])

  // Live query — automatically updates when IndexedDB changes
  const products: CachedProduct[] = useDexieLiveQuery(
    () => restaurantId
      ? posDb.products.where('restaurant_id').equals(restaurantId).toArray()
      : Promise.resolve([] as CachedProduct[]),
    [restaurantId],
    [] as CachedProduct[]
  ) ?? []

  type CatalogCategory = { id: string; name: string; position: number }
  const categories: CatalogCategory[] = useDexieLiveQuery(
    () => {
      if (!restaurantId) return Promise.resolve([] as CatalogCategory[])
      return posDb.products
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
        })
    },
    [restaurantId],
    [] as CatalogCategory[]
  ) ?? []

  // Loading = no products yet AND still refreshing
  const loading = products.length === 0 && refreshing

  return { products, categories, loading }
}

export function useCategoryProducts(restaurantId: string, categoryId: string | null): CachedProduct[] {
  return useDexieLiveQuery(
    () => {
      if (!categoryId) {
        return posDb.products
          .where('restaurant_id')
          .equals(restaurantId)
          .sortBy('position')
      }
      return posDb.products
        .where('category_id')
        .equals(categoryId)
        .sortBy('position')
    },
    [restaurantId, categoryId],
    []
  )
}

// ── Events (for debug UI) ────────────────────────────────────────

export function useRecentEvents(limit = 20) {
  return useDexieLiveQuery(
    () => posDb.events.orderBy('created_at_local').reverse().limit(limit).toArray(),
    [limit],
    []
  )
}

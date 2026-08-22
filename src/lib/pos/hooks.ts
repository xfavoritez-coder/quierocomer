'use client'

import { useState, useEffect, useRef, useSyncExternalStore } from 'react'
import { posDb } from './db'
import { startSync, stopSync } from './sync'
import type { Account, CashSession, PosTable } from './types'
import type { CachedProduct } from './types'
import { refreshCatalog, getCachedProducts, getCachedCategories } from './catalog'
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

// ── Tables ───────────────────────────────────────────────────────

export function useTables(restaurantId: string): PosTable[] {
  return useDexieQuery(
    () => posDb.posTables.where('restaurant_id').equals(restaurantId).filter(t => t.active).sortBy('number'),
    [restaurantId],
    []
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
  const [products, setProducts] = useState<CachedProduct[]>([])
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [loading, setLoading] = useState(true)
  const online = useOnlineStatus()
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!restaurantId) return

    // Abort any previous in-flight load
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    async function load() {
      try {
        if (online) {
          const fresh = await refreshCatalog(restaurantId)
          if (ctrl.signal.aborted) return
          setProducts(fresh)
          setCategories(deriveCategories(fresh))
        } else {
          // Offline: leer del caché local en IndexedDB
          const [cached, cats] = await Promise.all([
            getCachedProducts(restaurantId),
            getCachedCategories(restaurantId),
          ])
          if (ctrl.signal.aborted) return
          setProducts(cached)
          setCategories(cats)
        }

        setLoading(false)
      } catch (err) {
        if (!ctrl.signal.aborted) {
          console.error('[POS] Catalog load error:', err)
          setLoading(false)
        }
      }
    }

    load()
    return () => ctrl.abort()
  }, [restaurantId, online])

  return { products, categories, loading }
}

function deriveCategories(prods: CachedProduct[]): CatalogCategory[] {
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

// ── Session summary ───────────────────────────────────────────────

export type SessionMethodSummary = { amount: number; tip: number; count: number }
export type SessionSummary = {
  byMethod: Partial<Record<string, SessionMethodSummary>>
  totalSales: number
  totalTips: number
  closedAccounts: number
}

export function useSessionSummary(session: CashSession | undefined): SessionSummary {
  return useDexieQuery(
    async () => {
      const empty: SessionSummary = { byMethod: {}, totalSales: 0, totalTips: 0, closedAccounts: 0 }
      if (!session) return empty

      const allAccounts = await posDb.accounts.toArray()
      const sessionAccounts = allAccounts.filter(
        a => a.status === 'cerrada' && a.closed_at && a.closed_at >= session.opened_at
      )

      const byMethod: Record<string, SessionMethodSummary> = {}
      let totalSales = 0
      let totalTips = 0

      for (const account of sessionAccounts) {
        for (const payment of account.payments ?? []) {
          if (!byMethod[payment.method]) byMethod[payment.method] = { amount: 0, tip: 0, count: 0 }
          byMethod[payment.method].amount += payment.amount
          byMethod[payment.method].tip += payment.tip ?? 0
          byMethod[payment.method].count++
          totalSales += payment.amount
          totalTips += payment.tip ?? 0
        }
      }

      return { byMethod, totalSales, totalTips, closedAccounts: sessionAccounts.length }
    },
    [session?.id, session?.opened_at],
    { byMethod: {}, totalSales: 0, totalTips: 0, closedAccounts: 0 }
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

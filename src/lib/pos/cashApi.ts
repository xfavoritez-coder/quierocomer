'use client'

// Cliente de la caja/turno SERVER-AUTHORITATIVE (/api/pos/cash). El servidor es
// la fuente de verdad; aquí solo leemos (con polling + on-focus) y disparamos
// acciones. Reemplaza el estado de caja basado en Dexie/pos_events.

import { useCallback, useEffect, useRef, useState } from 'react'

export interface ServerShift {
  id: string
  restaurantId: string
  openedAt: string
  openedBy?: string | null
  closedAt?: string | null
  cajaCount?: number | null
  totalSales?: number | null
  isOpen: boolean
}
export interface ServerCaja {
  id: string
  restaurantId: string
  shiftId?: string | null
  openedAt: string
  openedBy?: string | null
  initialAmount: number
  closedAt?: string | null
  countedAmounts?: Record<string, number> | null
  expectedAmounts?: Record<string, number> | null
  difference?: number | null
  totalSales?: number | null
  totalTips?: number | null
  closedAccounts?: number | null
  note?: string | null
  source?: string | null
  isOpen: boolean
}

export interface PosCashState {
  shift: ServerShift | null
  caja: ServerCaja | null
  loading: boolean
  refresh: () => Promise<void>
}

async function post(body: Record<string, unknown>): Promise<any> {
  const r = await fetch('/api/pos/cash', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j?.error || 'Error de caja')
  return j
}

export const cashApi = {
  openShift: (restaurantId: string, openedBy?: string) =>
    post({ restaurantId, action: 'shift_open', openedBy }),
  closeShift: (restaurantId: string, shiftId: string, note?: string) =>
    post({ restaurantId, action: 'shift_close', shiftId, note, closedBy: 'pos' }),
  openCaja: (restaurantId: string, initialAmount: number, openedBy?: string) =>
    post({ restaurantId, action: 'caja_open', initialAmount, openedBy }),
  closeCaja: (
    restaurantId: string,
    sessionId: string,
    payload: {
      countedAmounts?: Record<string, number>
      expectedAmounts?: Record<string, number>
      difference?: number
      totalSales?: number
      totalTips?: number
      closedAccounts?: number
      note?: string
    },
  ) => post({ restaurantId, action: 'caja_close', sessionId, closedBy: 'pos', ...payload }),
}

/** Estado actual de caja/turno del local, autoritativo desde el servidor.
 *  Polling cada 12s + al recuperar foco/visibilidad. */
export function usePosCash(restaurantId?: string, pollMs = 12000): PosCashState {
  const [state, setState] = useState<{ shift: ServerShift | null; caja: ServerCaja | null } | undefined>(undefined)
  const ridRef = useRef(restaurantId)
  ridRef.current = restaurantId

  const refresh = useCallback(async () => {
    const rid = ridRef.current
    if (!rid) return
    try {
      const r = await fetch(`/api/pos/cash?restaurantId=${rid}`, { cache: 'no-store' })
      if (r.ok) {
        const j = await r.json()
        setState({ shift: j.shift ?? null, caja: j.caja ?? null })
      }
    } catch { /* red caída: mantener último estado */ }
  }, [])

  useEffect(() => {
    setState(undefined)
    if (!restaurantId) return
    refresh()
    const id = setInterval(refresh, pollMs)
    const onWake = () => { if (document.visibilityState === 'visible') refresh() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onWake)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onWake)
    }
  }, [restaurantId, pollMs, refresh])

  return { shift: state?.shift ?? null, caja: state?.caja ?? null, loading: state === undefined, refresh }
}

// Adapta la caja del servidor a la forma que espera useSessionSummary (Dexie).
export function toLegacyCashSession(caja: ServerCaja | null | undefined, restaurantId?: string) {
  if (!caja) return undefined
  return {
    id: caja.id,
    restaurant_id: caja.restaurantId ?? restaurantId,
    opened_at: caja.openedAt,
    opened_by: caja.openedBy ?? '',
    initial_amount: caja.initialAmount ?? 0,
    is_open: caja.isOpen,
  }
}

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
  closedBy?: string | null
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

// Paso del flujo obligatorio: 1 abrir turno · 2 abrir caja · 3 cerrar caja · 4 cerrar turno.
export type CajaStep = 1 | 2 | 3 | 4

export interface PosCashState {
  shift: ServerShift | null
  caja: ServerCaja | null
  shiftClosedCajas: number
  step: CajaStep
  loading: boolean
  refresh: () => Promise<void>
}

export function computeStep(shift: ServerShift | null, caja: ServerCaja | null, shiftClosedCajas: number): CajaStep {
  if (!shift) return 1
  if (caja) return 3
  if (shiftClosedCajas > 0) return 4
  return 2
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
  const [state, setState] = useState<{ shift: ServerShift | null; caja: ServerCaja | null; shiftClosedCajas: number } | undefined>(undefined)
  const ridRef = useRef(restaurantId)
  ridRef.current = restaurantId

  const refresh = useCallback(async () => {
    const rid = ridRef.current
    if (!rid) return
    try {
      const r = await fetch(`/api/pos/cash?restaurantId=${rid}`, { cache: 'no-store' })
      if (r.ok) {
        const j = await r.json()
        setState({ shift: j.shift ?? null, caja: j.caja ?? null, shiftClosedCajas: j.shiftClosedCajas ?? 0 })
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

  const shift = state?.shift ?? null
  const caja = state?.caja ?? null
  const shiftClosedCajas = state?.shiftClosedCajas ?? 0
  return { shift, caja, shiftClosedCajas, step: computeStep(shift, caja, shiftClosedCajas), loading: state === undefined, refresh }
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

// Caja cerrada del servidor → forma Dexie (snake_case) que usa el historial.
export function toLegacyClosed(c: ServerCaja) {
  return {
    id: c.id,
    restaurant_id: c.restaurantId,
    opened_at: c.openedAt,
    opened_by: c.openedBy ?? '',
    initial_amount: c.initialAmount ?? 0,
    closed_at: c.closedAt ?? undefined,
    closed_by: c.closedBy ?? undefined,
    counted_amounts: c.countedAmounts ?? undefined,
    expected_amounts: c.expectedAmounts ?? undefined,
    difference: c.difference ?? undefined,
    note: c.note ?? undefined,
    total_sales: c.totalSales ?? undefined,
    total_tips: c.totalTips ?? undefined,
    closed_accounts: c.closedAccounts ?? undefined,
    is_open: false as const,
  }
}

/** Historial de cierres del local (server-authoritative), mapeado a la forma
 *  Dexie que ya consume el componente de historial. */
export function useClosedCajas(restaurantId?: string): { sessions: ReturnType<typeof toLegacyClosed>[]; reload: () => void } {
  const [rows, setRows] = useState<ReturnType<typeof toLegacyClosed>[]>([])
  const ridRef = useRef(restaurantId)
  ridRef.current = restaurantId
  const load = useCallback(async () => {
    const rid = ridRef.current
    if (!rid) { setRows([]); return }
    try {
      const r = await fetch(`/api/pos/cash/history?restaurantId=${rid}&limit=180`, { cache: 'no-store' })
      if (r.ok) {
        const j = await r.json()
        setRows((j.sessions as ServerCaja[]).map(toLegacyClosed))
      }
    } catch { /* red caída */ }
  }, [])
  useEffect(() => { load() }, [restaurantId, load])
  return { sessions: rows, reload: load }
}

export const cashHistoryApi = {
  deleteCaja: (restaurantId: string, sessionId: string) =>
    post({ restaurantId, action: 'caja_delete', sessionId }),
}

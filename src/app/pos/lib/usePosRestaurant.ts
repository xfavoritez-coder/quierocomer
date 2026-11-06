'use client'

import { useState, useEffect } from 'react'
import { setRestaurantId as setEventsRestaurantId } from '@/lib/pos'

const FALLBACK_ID = 'cmo22e53z0000l404vsw2cksk'
const PANEL_KEY = 'panel_selected_restaurant'

export interface PosRestaurant {
  branchName?: string | null
  id: string
  name: string
  slug: string
  logoUrl: string | null
}

interface State {
  restaurantId: string
  restaurant: PosRestaurant | null
  restaurants: PosRestaurant[]
  loading: boolean
  // null = desconocido (sin sesión de panel); true/false = habilitado por el local.
  posEnabled: boolean | null
  // true = owner (dueño del local), false = team member (staff). null = desconocido.
  isOwner: boolean | null
}

// Global singleton — fetched once for the lifetime of the SPA session.
// Arranca VACÍO (no con el FALLBACK): así ninguna pantalla muestra datos de un
// restaurante equivocado mientras resuelve el real (evita el flash de otra caja).
let _restaurantId = ''
let _state: State = { restaurantId: '', restaurant: null, restaurants: [], loading: true, posEnabled: null, isOwner: null }
let _listeners = new Set<() => void>()
let _fetched = false

function notify() { _listeners.forEach(l => l()) }

// Mantiene sincronizado el restaurante del módulo de eventos del POS (el que
// etiqueta cash_session/accounts). CRÍTICO: evita que los eventos se graben con
// el FALLBACK cuando una página se monta antes de resolver el restaurante real.
function syncEventsRestaurant(id: string) { if (id) setEventsRestaurantId(id) }

function init() {
  if (_fetched) return
  _fetched = true

  // Immediate: read from panel's localStorage key (same key usePanelSession uses)
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(PANEL_KEY)
    if (saved) {
      _restaurantId = saved
      syncEventsRestaurant(saved)
      _state = { ..._state, restaurantId: saved }
      notify()
    }
  }

  // Async: fetch full info (name, slug, logo) from panel session API
  fetch('/api/panel/me')
    .then(r => r.ok ? r.json() : null)
    .then(async data => {
      if (!data?.restaurants?.length) {
        // Fallback: fetch restaurant directly by ID (sin sesión de panel, ej. localhost)
        try {
          const id = _restaurantId
          const r = await fetch(`/api/pos/restaurant?id=${id}`).then(r => r.ok ? r.json() : null)
          if (r?.id) {
            syncEventsRestaurant(id)
            _state = { restaurantId: id, restaurant: { id: r.id, name: r.name, slug: r.slug, logoUrl: r.logoUrl ?? null, branchName: r.branchName ?? null }, restaurants: [], loading: false, posEnabled: typeof r.posEnabled === "boolean" ? r.posEnabled : null, isOwner: null }
            notify()
            return
          }
        } catch {}
        _state = { ..._state, loading: false }
        notify()
        return
      }
      const savedId = typeof window !== 'undefined' ? localStorage.getItem(PANEL_KEY) : null
      const id = data.restaurants.some((r: PosRestaurant) => r.id === savedId)
        ? savedId!
        : data.selectedRestaurantId || data.restaurants[0]?.id || FALLBACK_ID
      const rest = data.restaurants.find((r: any) => r.id === id) ?? null
      _restaurantId = id
      syncEventsRestaurant(id)
      _state = {
        restaurantId: id,
        restaurant: rest ? { id: rest.id, name: rest.name, slug: rest.slug, logoUrl: rest.logoUrl ?? null, branchName: (rest as any).branchName ?? null } : null,
        restaurants: (data.restaurants as any[]).map((r: any) => ({ id: r.id, name: r.name, slug: r.slug, logoUrl: r.logoUrl ?? null, branchName: r.branchName ?? null })),
        loading: false,
        posEnabled: rest && typeof rest.posEnabled === "boolean" ? rest.posEnabled : null,
        isOwner: !data.teamMember,
      }
      notify()
    })
    .catch(() => {
      _state = { ..._state, loading: false }
      notify()
    })
}

export function usePosRestaurant(): State {
  const [state, setState] = useState<State>(_state)

  useEffect(() => {
    const listener = () => setState({ ..._state })
    _listeners.add(listener)
    init()
    return () => { _listeners.delete(listener) }
  }, [])

  return state
}

/** Cambia a otra sucursal: actualiza localStorage y recarga la página para reinicializar el POS. */
export function switchPosBranch(id: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PANEL_KEY, id)
  _fetched = false
  window.location.reload()
}

/** Get the restaurant ID synchronously (from module-level cache, no re-render) */
export function getPosRestaurantId(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(PANEL_KEY)
    if (saved) return saved
  }
  return _restaurantId
}

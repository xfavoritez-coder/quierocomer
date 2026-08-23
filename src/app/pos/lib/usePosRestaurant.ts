'use client'

import { useState, useEffect } from 'react'

const FALLBACK_ID = 'cmo22e53z0000l404vsw2cksk'
const PANEL_KEY = 'panel_selected_restaurant'

export interface PosRestaurant {
  id: string
  name: string
  slug: string
  logoUrl: string | null
}

interface State {
  restaurantId: string
  restaurant: PosRestaurant | null
  loading: boolean
}

// Global singleton — fetched once for the lifetime of the SPA session
let _restaurantId = FALLBACK_ID
let _state: State = { restaurantId: FALLBACK_ID, restaurant: null, loading: true }
let _listeners = new Set<() => void>()
let _fetched = false

function notify() { _listeners.forEach(l => l()) }

function init() {
  if (_fetched) return
  _fetched = true

  // Immediate: read from panel's localStorage key (same key usePanelSession uses)
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(PANEL_KEY)
    if (saved) {
      _restaurantId = saved
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
            _state = { restaurantId: id, restaurant: { id: r.id, name: r.name, slug: r.slug, logoUrl: r.logoUrl ?? null }, loading: false }
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
      const rest = data.restaurants.find((r: PosRestaurant) => r.id === id) ?? null
      _restaurantId = id
      _state = {
        restaurantId: id,
        restaurant: rest ? { id: rest.id, name: rest.name, slug: rest.slug, logoUrl: rest.logoUrl ?? null } : null,
        loading: false,
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

/** Get the restaurant ID synchronously (from module-level cache, no re-render) */
export function getPosRestaurantId(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(PANEL_KEY)
    if (saved) return saved
  }
  return _restaurantId
}

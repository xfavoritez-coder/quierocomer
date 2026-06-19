'use client'

import { useState, useEffect, useCallback, useLayoutEffect } from 'react'
import dynamic from 'next/dynamic'

export type MapRestaurant = {
  id: string
  name: string
  slug: string
  lat: number
  lng: number
  logo: string | null
  googleRating: number | null
  googleRatingCount: number | null
  dishes: { id: string; name: string; fotoUrl: string | null; precio: number; categoria: string; dieta?: { tipo: 'VEGAN' | 'VEGETARIAN' | 'OMNIVORE'; esPicante: boolean } }[]
}

type Bounds = { north: number; south: number; east: number; west: number }

const LeafletMap = dynamic(() => import('./LeafletMap'), { ssr: false })

const PEEK_HEIGHT = 210
const EXPANDED_HEIGHT = '62vh'

export default function MapaClient() {
  const [restaurants, setRestaurants] = useState<MapRestaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const [isDark, setIsDark] = useState(false)

  useLayoutEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  useEffect(() => {
    fetch('/api/mapa')
      .then((r) => r.json())
      .then((data: MapRestaurant[]) => { setRestaurants(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleBoundsChange = useCallback((b: Bounds) => setBounds(b), [])
  const handleRestaurantClick = useCallback(() => setSheetExpanded(true), [])

  const visibleRestaurants = bounds
    ? restaurants.filter(r => r.lat >= bounds.south && r.lat <= bounds.north && r.lng >= bounds.west && r.lng <= bounds.east)
    : restaurants

  const visibleDishes = visibleRestaurants.flatMap(r =>
    r.dishes.map(d => ({ ...d, restaurantName: r.name, restaurantSlug: r.slug }))
  )

  const sheetHeight = sheetExpanded ? EXPANDED_HEIGHT : `${PEEK_HEIGHT}px`

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#e8e7e3' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .mapa-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Header flotante */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(245,244,241,0.92)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        <a href="/" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 34, height: 34, borderRadius: '50%',
          background: 'rgba(0,0,0,0.07)', color: '#111',
          textDecoration: 'none', fontSize: 18, flexShrink: 0,
        }}>←</a>
        <h1 style={{
          fontFamily: 'var(--font-feed-display), serif',
          fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.3px',
        }}>Mapa</h1>
        {!loading && (
          <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.38)', marginLeft: 'auto', fontFamily: 'var(--font-feed-body), sans-serif' }}>
            {restaurants.length} locales
          </span>
        )}
      </div>

      {/* Mapa full screen — isolation crea nuevo stacking context, evita que Leaflet tape el sheet */}
      <div style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 5,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: '#e8e7e3', gap: 10,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '3px solid rgba(0,0,0,0.1)', borderTop: '3px solid #F4A623',
              animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)', fontFamily: 'var(--font-feed-body), sans-serif' }}>
              Cargando mapa…
            </span>
          </div>
        )}
        <LeafletMap
          restaurants={restaurants}
          onBoundsChange={handleBoundsChange}
          onRestaurantClick={handleRestaurantClick}
          isDark={isDark}
        />
      </div>

      {/* Bottom sheet */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: sheetHeight,
        transition: 'height 0.35s cubic-bezier(0.32,0.72,0,1)',
        background: '#f5f4f1',
        borderRadius: '20px 20px 0 0',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.14)',
        display: 'flex', flexDirection: 'column',
        zIndex: 40,
        overflow: 'hidden',
      }}>

        {/* Handle — tap para toggle */}
        <div
          onClick={() => setSheetExpanded(p => !p)}
          style={{ padding: '12px 16px 8px', cursor: 'pointer', flexShrink: 0 }}
        >
          {/* Pill */}
          <div style={{
            width: 36, height: 4, borderRadius: 99,
            background: 'rgba(0,0,0,0.15)', margin: '0 auto 10px',
          }} />
          {/* Conteo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontSize: 15, fontWeight: 700, color: '#111',
              fontFamily: 'var(--font-feed-body), sans-serif',
            }}>
              {visibleDishes.length > 0
                ? `${visibleDishes.length} platos en esta zona`
                : 'Mueve el mapa para explorar'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {visibleRestaurants.length > 0 && (
                <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.38)', fontFamily: 'var(--font-feed-body), sans-serif' }}>
                  {visibleRestaurants.length} locales
                </span>
              )}
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="rgba(0,0,0,0.35)" strokeWidth="2.5" strokeLinecap="round"
                style={{ transform: sheetExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}
              >
                <polyline points="18 15 12 9 6 15"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Dish cards */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {visibleDishes.length === 0 ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 8, padding: '16px',
            }}>
              <span style={{ fontSize: 36 }}>🗺️</span>
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(0,0,0,0.38)', textAlign: 'center', fontFamily: 'var(--font-feed-body), sans-serif' }}>
                Mueve el mapa para ver platos de esta zona
              </p>
            </div>
          ) : (
            <div className="mapa-scroll" style={{
              display: 'flex', overflowX: 'auto',
              gap: 12, padding: '4px 16px 20px',
              scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
              alignItems: 'flex-start',
            }}>
              {visibleDishes.map((dish) => (
                <div key={dish.id} style={{
                  width: 145, minWidth: 145, borderRadius: 16,
                  background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                  overflow: 'hidden', flexShrink: 0, display: 'flex', flexDirection: 'column',
                  height: 175,
                }}>
                  <div style={{
                    height: 100, flexShrink: 0,
                    background: dish.fotoUrl ? `url(${dish.fotoUrl}) center/cover` : '#e8e7e3',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28,
                  }}>
                    {!dish.fotoUrl && '🍽'}
                  </div>
                  <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflow: 'hidden' }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: '#111',
                      fontFamily: 'var(--font-feed-body), sans-serif',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
                    }}>{dish.name}</span>
                    <span style={{
                      fontSize: 11, color: 'rgba(0,0,0,0.42)',
                      fontFamily: 'var(--font-feed-body), sans-serif',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
                    }}>{dish.restaurantName}</span>
                    <span style={{
                      fontSize: 12, fontWeight: 600, color: '#F4A623',
                      fontFamily: 'var(--font-feed-body), sans-serif', marginTop: 'auto',
                    }}>${dish.precio.toLocaleString('es-CL')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

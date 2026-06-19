'use client'
import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { FeedDish } from '../types'
import type { MapRestaurant } from '../../mapa/MapaClient'

const LeafletMap = dynamic(() => import('../../mapa/LeafletMap'), { ssr: false })

type Bounds = { north: number; south: number; east: number; west: number }

type Props = {
  dishes: FeedDish[]
  isDark: boolean
  onDishTap: (d: FeedDish) => void
}

export default function FeedMapView({ dishes, isDark, onDishTap }: Props) {
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const [sheetExpanded, setSheetExpanded] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [updatingDishes, setUpdatingDishes] = useState(false)
  const prevDishesRef = useRef(dishes)

  // Show brief loading when filtered dishes change
  useEffect(() => {
    if (prevDishesRef.current !== dishes) {
      prevDishesRef.current = dishes
      setUpdatingDishes(true)
      const t = setTimeout(() => setUpdatingDishes(false), 600)
      return () => clearTimeout(t)
    }
  }, [dishes])

  const restaurants = useMemo<MapRestaurant[]>(() => {
    const map = new Map<string, MapRestaurant>()
    for (const dish of dishes) {
      if (dish.restauranteLat == null || dish.restauranteLng == null) continue
      const existing = map.get(dish.restauranteId)
      if (!existing) {
        map.set(dish.restauranteId, {
          id: dish.restauranteId,
          name: dish.restaurante,
          slug: dish.restauranteSlug,
          lat: dish.restauranteLat,
          lng: dish.restauranteLng,
          logo: dish.restauranteLogo,
          googleRating: dish.googleRating ?? null,
          googleRatingCount: dish.googleRatingCount ?? null,
          dishes: [{
            id: dish.id,
            name: dish.nombre,
            fotoUrl: dish.fotoUrl,
            precio: dish.precio,
            categoria: dish.categoria,
          }],
        })
      } else if (existing.dishes.length < 5) {
        existing.dishes.push({
          id: dish.id,
          name: dish.nombre,
          fotoUrl: dish.fotoUrl,
          precio: dish.precio,
          categoria: dish.categoria,
        })
      }
    }
    return Array.from(map.values())
  }, [dishes])

  const locateRef = useRef<(() => void) | null>(null)

  const handleBoundsChange = useCallback((b: Bounds) => {
    setBounds(b)
    setMapReady(true)
  }, [])
  const handleRestaurantClick = useCallback(() => setSheetExpanded(false), [])

  const visibleRestaurants = bounds
    ? restaurants.filter(r =>
        r.lat >= bounds.south && r.lat <= bounds.north &&
        r.lng >= bounds.west && r.lng <= bounds.east
      )
    : restaurants

  const visibleRestaurantIds = useMemo(
    () => new Set(visibleRestaurants.map(r => r.id)),
    [visibleRestaurants]
  )

  const visibleDishes = useMemo(
    () => dishes.filter(d => visibleRestaurantIds.has(d.restauranteId)),
    [dishes, visibleRestaurantIds]
  )

  const sheetBg = isDark ? '#111' : '#f5f4f1'
  const pillBg = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)'
  const countColor = isDark ? 'rgba(255,255,255,0.9)' : '#111'
  const emptyColor = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)'
  const chevronStroke = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'
  const cardBg = isDark ? '#1a1a1a' : '#fff'
  const cardNameColor = isDark ? '#fff' : '#111'
  const cardRestColor = isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.42)'
  const cardNoPhoto = isDark ? '#2a2a2a' : '#e8e7e3'

  return (
    <div style={{ position: 'relative', height: 'calc(100dvh - 130px)', overflow: 'hidden' }}>
      <style>{`
        .feedmap-scroll::-webkit-scrollbar { display: none; }
        @keyframes feedmap-spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Map */}
      <div style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}>
        {/* Loading overlay — mientras Leaflet inicializa */}
        {!mapReady && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: isDark ? '#1a1a1a' : '#dde0e3',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '3px solid rgba(0,0,0,0.1)',
              borderTop: '3px solid #F4A623',
              animation: 'feedmap-spin 0.8s linear infinite',
            }} />
            <span style={{ fontSize: 13, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', fontFamily: 'var(--font-feed-body), sans-serif' }}>
              Cargando mapa…
            </span>
          </div>
        )}
        <LeafletMap
          restaurants={restaurants}
          onBoundsChange={handleBoundsChange}
          onRestaurantClick={handleRestaurantClick}
          isDark={isDark}
          locateRef={locateRef}
        />
        {/* GPS locate button */}
        <button
          onClick={() => locateRef.current?.()}
          style={{
            position: 'absolute', bottom: 216, right: 12, zIndex: 41,
            width: 40, height: 40, borderRadius: '50%',
            background: isDark ? '#1a1a1a' : '#fff',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0,
            color: isDark ? 'rgba(255,255,255,0.75)' : '#333',
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <line x1="12" y1="2" x2="12" y2="6"/>
            <line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="6" y2="12"/>
            <line x1="18" y1="12" x2="22" y2="12"/>
          </svg>
        </button>
      </div>

      {/* Bottom sheet */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40,
        height: sheetExpanded ? '60vh' : '200px',
        transition: 'height 0.35s cubic-bezier(0.32,0.72,0,1)',
        background: sheetBg,
        borderRadius: '20px 20px 0 0',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.14)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Handle */}
        <div
          onClick={() => setSheetExpanded(p => !p)}
          style={{ padding: '12px 16px 8px', cursor: 'pointer', flexShrink: 0 }}
        >
          <div style={{
            width: 36, height: 4, borderRadius: 99,
            background: pillBg, margin: '0 auto 10px',
          }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontSize: 15, fontWeight: 700, color: countColor,
              fontFamily: 'var(--font-feed-body), sans-serif',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {updatingDishes ? (
                <>
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    borderTop: '2px solid #F4A623',
                    animation: 'feedmap-spin 0.7s linear infinite',
                  }} />
                  Actualizando…
                </>
              ) : visibleDishes.length > 0
                ? `${visibleDishes.length} platos en esta zona`
                : 'Mueve el mapa para explorar'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {visibleRestaurants.length > 0 && (
                <span style={{ fontSize: 12, color: emptyColor, fontFamily: 'var(--font-feed-body), sans-serif' }}>
                  {visibleRestaurants.length} locales
                </span>
              )}
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={chevronStroke} strokeWidth="2.5" strokeLinecap="round"
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
              <p style={{ margin: 0, fontSize: 13, color: emptyColor, textAlign: 'center', fontFamily: 'var(--font-feed-body), sans-serif' }}>
                Mueve el mapa para ver platos de esta zona
              </p>
            </div>
          ) : (
            <div className="feedmap-scroll" style={{
              display: 'flex', overflowX: 'auto',
              gap: 12, padding: '4px 16px 20px',
              scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' as const,
              alignItems: 'flex-start',
            }}>
              {visibleDishes.map((dish) => (
                <div
                  key={dish.id}
                  onClick={() => onDishTap(dish)}
                  style={{
                    width: 145, minWidth: 145, borderRadius: 16,
                    background: cardBg, boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                    overflow: 'hidden', flexShrink: 0, display: 'flex', flexDirection: 'column',
                    height: 175, cursor: 'pointer',
                  }}
                >
                  <div style={{
                    height: 100, flexShrink: 0,
                    background: dish.fotoUrl ? `url(${dish.fotoUrl}) center/cover` : cardNoPhoto,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28,
                  }}>
                    {!dish.fotoUrl && '🍽'}
                  </div>
                  <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1, overflow: 'hidden' }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, color: cardNameColor,
                      fontFamily: 'var(--font-feed-body), sans-serif',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
                    }}>{dish.nombre}</span>
                    <span style={{
                      fontSize: 11, color: cardRestColor,
                      fontFamily: 'var(--font-feed-body), sans-serif',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
                    }}>{dish.restaurante}</span>
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

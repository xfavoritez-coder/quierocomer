'use client'

import { useState, useEffect, useCallback } from 'react'
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
  dishes: { id: string; name: string; fotoUrl: string | null; precio: number; categoria: string }[]
}

type Bounds = { north: number; south: number; east: number; west: number }

const LeafletMap = dynamic(() => import('./LeafletMap'), { ssr: false })

export default function MapaClient() {
  const [restaurants, setRestaurants] = useState<MapRestaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const [selectedRestaurant, setSelectedRestaurant] = useState<MapRestaurant | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    fetch('/api/mapa')
      .then((r) => r.json())
      .then((data: MapRestaurant[]) => {
        setRestaurants(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleBoundsChange = useCallback((b: Bounds) => {
    setBounds(b)
  }, [])

  const handleRestaurantClick = useCallback((r: MapRestaurant) => {
    setSelectedRestaurant(r)
  }, [])

  const visibleRestaurants = bounds
    ? restaurants.filter(
        (r) =>
          r.lat >= bounds.south &&
          r.lat <= bounds.north &&
          r.lng >= bounds.west &&
          r.lng <= bounds.east
      )
    : restaurants

  const visibleDishes = visibleRestaurants.flatMap((r) =>
    r.dishes.map((d) => ({ ...d, restaurantName: r.name, restaurantSlug: r.slug }))
  )

  const mapHeight = isMobile ? 'calc(100dvh - 120px)' : '60vh'

  const backButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.06)',
    color: '#111',
    textDecoration: 'none',
    fontSize: 16,
    flexShrink: 0,
    border: 'none',
    cursor: 'pointer',
    fontWeight: 500,
  }

  const dishCardStyle: React.CSSProperties = {
    width: 150,
    minWidth: 150,
    height: 185,
    borderRadius: 16,
    background: '#fff',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    overflow: 'hidden',
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#f5f4f1', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: 'rgba(245,244,241,0.95)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}>
        <a href="/" style={backButtonStyle} aria-label="Volver al inicio">
          ←
        </a>
        <h1 style={{
          fontFamily: 'var(--font-feed-display), serif',
          fontSize: 20,
          fontWeight: 700,
          margin: 0,
          letterSpacing: '-0.3px',
        }}>
          Mapa
        </h1>
        {!loading && (
          <span style={{
            fontSize: 12,
            color: 'rgba(0,0,0,0.4)',
            marginLeft: 'auto',
            fontFamily: 'var(--font-feed-body), system-ui, sans-serif',
          }}>
            {restaurants.length} locales
          </span>
        )}
      </header>

      {/* Map */}
      <div style={{ height: mapHeight, position: 'relative', flexShrink: 0 }}>
        {loading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#e8e7e3',
            zIndex: 5,
            flexDirection: 'column',
            gap: 8,
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '3px solid rgba(0,0,0,0.1)',
              borderTop: '3px solid #F4A623',
              animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)', fontFamily: 'var(--font-feed-body), sans-serif' }}>
              Cargando mapa…
            </span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        <LeafletMap
          restaurants={restaurants}
          onBoundsChange={handleBoundsChange}
          onRestaurantClick={handleRestaurantClick}
        />
      </div>

      {/* Bottom dish panel */}
      <div style={{
        background: '#f5f4f1',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Panel header */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          padding: '12px 16px 8px',
          background: '#f5f4f1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(0,0,0,0.05)',
        }}>
          <span style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#111',
            fontFamily: 'var(--font-feed-body), system-ui, sans-serif',
          }}>
            {visibleDishes.length > 0
              ? `${visibleDishes.length} plato${visibleDishes.length !== 1 ? 's' : ''} en esta zona`
              : 'Mueve el mapa para explorar'}
          </span>
          {visibleRestaurants.length > 0 && (
            <span style={{
              fontSize: 11,
              color: 'rgba(0,0,0,0.35)',
              fontFamily: 'var(--font-feed-body), system-ui, sans-serif',
            }}>
              {visibleRestaurants.length} local{visibleRestaurants.length !== 1 ? 'es' : ''}
            </span>
          )}
        </div>

        {/* Dish cards */}
        {visibleDishes.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 16px',
            gap: 10,
          }}>
            <span style={{ fontSize: 40 }}>🗺️</span>
            <p style={{
              margin: 0,
              fontSize: 14,
              color: 'rgba(0,0,0,0.4)',
              textAlign: 'center',
              fontFamily: 'var(--font-feed-body), system-ui, sans-serif',
            }}>
              Mueve el mapa para ver platos de esta zona
            </p>
          </div>
        ) : (
          <style>{`.mapa-dish-scroll::-webkit-scrollbar { display: none; }`}</style>
          <div className="mapa-dish-scroll" style={{
            display: 'flex',
            overflowX: 'auto',
            gap: 12,
            padding: '12px 16px 20px',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
          }}>
            {visibleDishes.map((dish) => (
              <div key={dish.id} style={dishCardStyle}>
                {/* Photo */}
                <div style={{
                  height: '60%',
                  background: dish.fotoUrl ? `url(${dish.fotoUrl}) center/cover` : '#e8e7e3',
                  flexShrink: 0,
                  position: 'relative',
                }}>
                  {!dish.fotoUrl && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 28,
                    }}>
                      🍽
                    </div>
                  )}
                </div>
                {/* Info */}
                <div style={{
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  flex: 1,
                  overflow: 'hidden',
                }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#111',
                    fontFamily: 'var(--font-feed-body), system-ui, sans-serif',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'block',
                  }}>
                    {dish.name}
                  </span>
                  <span style={{
                    fontSize: 11,
                    color: 'rgba(0,0,0,0.45)',
                    fontFamily: 'var(--font-feed-body), system-ui, sans-serif',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'block',
                  }}>
                    {dish.restaurantName}
                  </span>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#F4A623',
                    fontFamily: 'var(--font-feed-body), system-ui, sans-serif',
                    marginTop: 'auto',
                  }}>
                    ${dish.precio.toLocaleString('es-CL')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

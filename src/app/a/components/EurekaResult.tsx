'use client'

import type { FeedDish } from '../types'
import { getDisplayCategories, getCategoryGradient } from '../lib/categories'
import { distanceKm, formatDistance } from '../lib/geo'

const CATEGORY_EMOJIS: Record<string, string> = Object.fromEntries(
  getDisplayCategories().map(c => [c.norm, c.icon])
)

export default function EurekaResult({
  topCategory,
  topDishes,
  userLocation,
  onContinueExploring,
  onDishTap,
  fallbackMode,
}: {
  topCategory: string | null
  topDishes: FeedDish[]
  userLocation: { lat: number; lng: number } | null
  onContinueExploring: () => void
  onDishTap: (dish: FeedDish) => void
  fallbackMode: boolean
}) {
  if (topDishes.length === 0) return null

  const emoji = topCategory ? (CATEGORY_EMOJIS[topCategory] || '🍽') : '🤤'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 90,
      background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 20,
      animation: 'eurekaFadeIn 0.5s ease-out',
    }}>
      <div style={{ maxWidth: 380, width: '100%', textAlign: 'center' }}>

        {/* Header */}
        <div style={{
          fontSize: 48, marginBottom: 12,
          animation: 'eurekaBounce 0.6s ease-out 0.2s both',
        }}>
          {emoji}
        </div>

        <h1 style={{
          fontFamily: 'var(--font-feed-display), serif',
          fontSize: 24, fontWeight: 700, color: '#fff', margin: '0 0 6px',
          animation: 'eurekaSlideUp 0.5s ease-out 0.3s both',
        }}>
          {fallbackMode ? 'Se te antojaron estos' : 'Ya sabemos qué se te antoja'}
        </h1>

        {topCategory && !fallbackMode && (
          <p style={{
            fontSize: 16, color: '#F4A623', fontWeight: 600, margin: '0 0 24px',
            animation: 'eurekaSlideUp 0.5s ease-out 0.4s both',
          }}>
            Hoy vas por {topCategory}
          </p>
        )}

        {fallbackMode && (
          <p style={{
            fontSize: 14, color: 'rgba(255,255,255,0.4)', margin: '0 0 24px',
            animation: 'eurekaSlideUp 0.5s ease-out 0.4s both',
          }}>
            Estos platos te esperan cerca
          </p>
        )}

        {/* Dish cards */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 10,
          animation: 'eurekaSlideUp 0.5s ease-out 0.5s both',
        }}>
          {topDishes.map((dish, i) => {
            const dist = userLocation && dish.restauranteLat && dish.restauranteLng
              ? distanceKm(userLocation.lat, userLocation.lng, dish.restauranteLat, dish.restauranteLng)
              : null

            return (
              <button key={dish.id} onClick={() => onDishTap(dish)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: 12, borderRadius: 16, width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer', textAlign: 'left',
                animation: `eurekaCardIn 0.4s ease-out ${0.5 + i * 0.1}s both`,
              }}>
                {dish.fotoUrl ? (
                  <img src={dish.fotoUrl} alt={dish.nombre}
                    style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 64, height: 64, borderRadius: 12, flexShrink: 0,
                    background: getCategoryGradient(dish.categoriaNorm),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24,
                  }}>
                    {emoji}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 15, fontWeight: 600, color: '#fff', margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {dish.nombre}
                  </p>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '3px 0 0' }}>
                    {dish.restaurante}
                    {dist != null && <span> · {formatDistance(dist)}</span>}
                    {dish.googleRating != null && (
                      <span style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', gap: 2, verticalAlign: 'middle' }}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="rgba(251,191,36,0.8)" stroke="none">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                        {dish.googleRating.toFixed(1)}
                        {dish.googleRatingCount != null && (
                          <>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="rgba(255,255,255,0.28)" stroke="none" style={{ marginLeft: 1 }}>
                              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                            </svg>
                            <span style={{ fontSize: 10 }}>{dish.googleRatingCount >= 1000 ? `${(dish.googleRatingCount / 1000).toFixed(dish.googleRatingCount >= 10000 ? 0 : 1)}k` : dish.googleRatingCount}</span>
                          </>
                        )}
                      </span>
                    )}
                  </p>
                  {(dish.precioDescuento ?? dish.precio) != null && (
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#F4A623', margin: '3px 0 0' }}>
                      ${(dish.precioDescuento ?? dish.precio)!.toLocaleString('es-CL')}
                    </p>
                  )}
                </div>
                <div style={{
                  padding: '8px 14px', borderRadius: 12,
                  background: 'rgba(244,166,35,0.1)', border: '1px solid rgba(244,166,35,0.2)',
                  color: '#F4A623', fontSize: 12, fontWeight: 600, flexShrink: 0,
                }}>
                  Ver plato
                </div>
              </button>
            )
          })}
        </div>

        {/* Continue exploring */}
        <button onClick={onContinueExploring} style={{
          marginTop: 24, padding: '14px 32px', borderRadius: 14,
          background: 'none', border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: 500,
          cursor: 'pointer', width: '100%',
          animation: 'eurekaSlideUp 0.5s ease-out 0.8s both',
        }}>
          Seguir explorando
        </button>
      </div>

      <style>{`
        @keyframes eurekaFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes eurekaBounce {
          0% { opacity: 0; transform: scale(0.5); }
          60% { transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes eurekaSlideUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes eurekaCardIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

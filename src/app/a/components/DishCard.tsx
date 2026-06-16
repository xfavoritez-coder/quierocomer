'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { FeedDish } from '../types'
import { getCategoryGradient } from '../lib/categories'
import { distanceKm, formatDistance } from '../lib/geo'

export default function DishCard({
  dish,
  onTap,
  onCategoryClick,
  userLocation,
  eager,
}: {
  dish: FeedDish
  onTap: (dish: FeedDish) => void
  onCategoryClick?: (category: string) => void
  userLocation?: { lat: number; lng: number } | null
  eager?: boolean
}) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [logoError, setLogoError] = useState(false)

  // Check if image already loaded (cached) before React attached onLoad
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalHeight > 0) {
      setImgLoaded(true)
    }
  }, [])

  // Timeout: if image doesn't load in 8s, show fallback
  useEffect(() => {
    if (imgLoaded || imgError || !dish.fotoUrl) return
    const t = setTimeout(() => { if (!imgLoaded) setImgError(true) }, 8000)
    return () => clearTimeout(t)
  }, [dish.fotoUrl, imgLoaded, imgError])

  const gradient = getCategoryGradient(dish.categoriaNorm)
  const showFallback = !dish.fotoUrl || imgError

  let seed = 0
  for (let i = 0; i < dish.id.length; i++) seed = (seed * 31 + dish.id.charCodeAt(i)) & 0xffff
  const ratios = ['3/4', '4/5', '1/1', '5/7', '2/3', '5/6', '4/5', '7/9', '3/4', '5/8', '1/1', '4/5']
  const aspectRatio = ratios[seed % ratios.length]

  const handleClick = useCallback(() => {
    onTap(dish)
  }, [dish, onTap])

  return (
    <div
      className="dish-card"
      onClick={handleClick}
      style={{ position: 'relative', cursor: 'pointer' }}
    >
      {/* Photo */}
      <div className="dish-card-img-wrap" style={{ position: 'relative', aspectRatio, overflow: 'hidden', background: 'rgba(0,0,0,0.08)', borderRadius: 14 }}>
        {/* Skeleton shimmer while image loads */}
        {!showFallback && !imgLoaded && (
          <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />
        )}
        {!showFallback ? (
          <img ref={imgRef} src={dish.fotoUrl!} alt={dish.nombre}
            style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s ease',
            }}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            loading={eager ? 'eager' : 'lazy'}
            fetchPriority={eager ? 'high' : 'low'} />
        ) : (
          <div className="dish-card-gradient" style={{ background: gradient }}><span>{dish.nombre}</span></div>
        )}

        {dish.enOferta && <span className="dish-card-oferta">Oferta</span>}

        {/* Restaurant bar — full width top */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '7px 10px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 70%, transparent 100%)',
        }}>
          {dish.restauranteLogo && !logoError ? (
            <img src={dish.restauranteLogo} alt="" onError={() => setLogoError(true)}
              style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 700,
            }}>
              {dish.restaurante.charAt(0)}
            </div>
          )}
          <span style={{
            fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {dish.restaurante}
          </span>
        </div>

        {/* Gradient overlay with info */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 55%, transparent 100%)',
          padding: '24px 10px 10px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            margin: '0 0 5px', minWidth: 0,
          }}>
            <h3 style={{
              fontFamily: 'var(--font-feed-display), serif',
              fontSize: 14, fontWeight: 700, lineHeight: 1.25, color: '#fff',
              margin: 0, flexShrink: 1, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {dish.nombre}
            </h3>
            {dish.dieta.tipo === 'VEGAN' && <span style={{ fontSize: 13, flexShrink: 0 }}>🌱</span>}
            {dish.dieta.tipo === 'VEGETARIAN' && <span style={{ fontSize: 13, flexShrink: 0 }}>🥬</span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 12, color: '#F4A623', fontWeight: 700, flexShrink: 0 }}>
              {dish.enOferta && dish.precioDescuento != null
                ? `$${dish.precioDescuento.toLocaleString('es-CL')}`
                : `$${dish.precio.toLocaleString('es-CL')}`}
            </span>
            {userLocation && dish.restauranteLat && dish.restauranteLng && (
              <>
                <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>·</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
                  {formatDistance(distanceKm(userLocation.lat, userLocation.lng, dish.restauranteLat, dish.restauranteLng))}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

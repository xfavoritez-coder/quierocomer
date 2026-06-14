'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { FeedDish } from '../types'
import { getCategoryGradient } from '../lib/categories'
import { distanceKm, formatDistance } from '../lib/geo'

type CardState = 'normal' | 'liked' | 'disliked' | 'undone'

export default function DishCard({
  dish,
  onTap,
  onLike,
  onDislike,
  onUndo,
  onDwell,
  userLocation,
}: {
  dish: FeedDish
  onTap: (dish: FeedDish) => void
  onLike?: (dish: FeedDish) => void
  onDislike?: (dish: FeedDish) => void
  onUndo?: (dish: FeedDish) => void
  onDwell?: (dishId: string) => void
  userLocation?: { lat: number; lng: number } | null
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [imgError, setImgError] = useState(false)
  const [state, setState] = useState<CardState>('normal')
  const [swipeX, setSwipeX] = useState(0)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const isSwiping = useRef(false)

  // Dwell tracking
  useEffect(() => {
    if (!onDwell || !cardRef.current) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        timer = setTimeout(() => onDwell(dish.id), 2000)
      } else if (timer) { clearTimeout(timer); timer = null }
    }, { threshold: 0.5 })
    observer.observe(cardRef.current)
    return () => { observer.disconnect(); if (timer) clearTimeout(timer) }
  }, [dish.id, onDwell])

  const gradient = getCategoryGradient(dish.categoriaNorm)
  const showFallback = !dish.fotoUrl || imgError

  let seed = 0
  for (let i = 0; i < dish.id.length; i++) seed = (seed * 31 + dish.id.charCodeAt(i)) & 0xffff
  const ratios = ['3/4', '4/5', '1/1', '5/7', '2/3', '5/6', '4/5', '7/9', '3/4', '5/8', '1/1', '4/5']
  const aspectRatio = ratios[seed % ratios.length]

  // Swipe handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isSwiping.current = false
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current)
    // Only swipe if horizontal movement > vertical
    if (Math.abs(dx) > 15 && Math.abs(dx) > dy) {
      isSwiping.current = true
      setSwipeX(dx)
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (Math.abs(swipeX) > 80) {
      if (swipeX > 0) {
        // Like: set state immediately, no fly away
        setState('liked')
        setSwipeX(0)
        onLike?.(dish)
      } else {
        // Dislike: set state immediately to B/W
        setState('disliked')
        setSwipeX(0)
        onDislike?.(dish)
      }
    } else {
      setSwipeX(0)
    }
    isSwiping.current = false
  }, [swipeX, dish, onLike, onDislike])

  const handleClick = useCallback(() => {
    if (!isSwiping.current && state === 'normal') onTap(dish)
  }, [dish, onTap, state])

  const handleUndo = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setState('normal')
    onUndo?.(dish)
  }, [dish, onUndo])

  // Disliked state: B/W card with undo
  if (state === 'disliked') {
    return (
      <div ref={cardRef} className="dish-card" style={{ position: 'relative' }}>
        <div style={{
          aspectRatio, overflow: 'hidden', borderRadius: 14,
          background: '#1a1a1a', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8,
          filter: 'grayscale(1)', opacity: 0.4,
        }}>
          {!showFallback && (
            <img src={dish.fotoUrl!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0 }} />
          )}
        </div>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <button onClick={handleUndo} style={{
            padding: '8px 16px', borderRadius: 20,
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}>
            Deshacer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={cardRef}
      className="dish-card"
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: swipeX !== 0 ? `translateX(${swipeX}px) rotate(${swipeX * 0.04}deg)` : undefined,
        transition: swipeX === 0 ? 'transform 0.2s ease' : 'none',
        position: 'relative',
      }}
    >
      {/* Swipe indicator */}
      {Math.abs(swipeX) > 40 && (
        <div style={{
          position: 'absolute', top: 16, left: swipeX > 0 ? 16 : undefined, right: swipeX < 0 ? 16 : undefined,
          zIndex: 10, padding: '6px 12px', borderRadius: 8,
          background: swipeX > 0 ? 'rgba(244,166,35,0.9)' : 'rgba(255,255,255,0.2)',
          color: swipeX > 0 ? '#000' : '#fff',
          fontSize: 12, fontWeight: 700,
        }}>
          {swipeX > 0 ? '👍 Me gusta' : '👎 Paso'}
        </div>
      )}

      {/* "Me antojé" stamp for liked */}
      {state === 'liked' && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 8,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
          padding: 12, pointerEvents: 'none',
        }}>
          <div style={{
            padding: '6px 12px', borderRadius: 8,
            background: 'rgba(244,166,35,0.85)', color: '#000',
            fontSize: 11, fontWeight: 700, transform: 'rotate(3deg)',
            boxShadow: '0 2px 8px rgba(244,166,35,0.3)',
          }}>
            Me antojé 🤤
          </div>
        </div>
      )}

      {/* Photo */}
      <div style={{ position: 'relative', aspectRatio, overflow: 'hidden', background: gradient }}>
        {!showFallback ? (
          <img src={dish.fotoUrl!} alt={dish.nombre}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={() => setImgError(true)} loading="lazy" />
        ) : (
          <div className="dish-card-gradient"><span>{dish.nombre}</span></div>
        )}

        {/* Popular badge — like cards.png */}
        {dish.popularityScore > 3 && state === 'normal' && (
          <div style={{
            position: 'absolute', top: 10, left: 10, zIndex: 6,
            padding: '4px 10px', borderRadius: 6,
            background: '#F4A623', color: '#000',
            fontSize: 10, fontWeight: 700,
          }}>
            #1 Más popular
          </div>
        )}

        {dish.enOferta && <span className="dish-card-oferta">Oferta</span>}

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
              margin: 0, flex: 1, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {dish.nombre}
            </h3>
            {dish.dieta.tipo === 'VEGAN' && <span style={{ fontSize: 13, flexShrink: 0 }}>🌱</span>}
            {dish.dieta.tipo === 'VEGETARIAN' && <span style={{ fontSize: 13, flexShrink: 0 }}>🥬</span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
            <span style={{ fontSize: 13, color: '#F4A623', fontWeight: 700 }}>
              {dish.enOferta && dish.precioDescuento != null
                ? `$${dish.precioDescuento.toLocaleString('es-CL')}`
                : `$${dish.precio.toLocaleString('es-CL')}`}
            </span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>·</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
              📍 {userLocation && dish.restauranteLat && dish.restauranteLng
                ? formatDistance(distanceKm(userLocation.lat, userLocation.lng, dish.restauranteLat, dish.restauranteLng))
                : `${((seed % 30) * 0.1 + 0.3).toFixed(1)} km`}
            </span>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>·</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
              ⭐ {dish.avgRating != null && dish.avgRating > 0
                ? dish.avgRating.toFixed(1)
                : ((seed % 10) * 0.1 + 4.0).toFixed(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

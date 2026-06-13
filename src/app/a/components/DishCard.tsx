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
        // Swipe right = like
        setState('liked')
        onLike?.(dish)
      } else {
        // Swipe left = dislike
        setState('disliked')
        onDislike?.(dish)
      }
    }
    setSwipeX(0)
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
        transform: swipeX !== 0 ? `translateX(${swipeX}px) rotate(${swipeX * 0.05}deg)` : undefined,
        transition: swipeX === 0 ? 'transform 0.3s ease' : 'none',
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
          position: 'absolute', top: 12, right: 12, zIndex: 10,
          padding: '5px 10px', borderRadius: 8,
          background: 'rgba(244,166,35,0.9)', color: '#000',
          fontSize: 11, fontWeight: 700, transform: 'rotate(3deg)',
        }}>
          Me antojé
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

        <span className="dish-card-badge">
          {dish.restaurante}
          {userLocation && dish.restauranteLat && dish.restauranteLng && (
            <span style={{ marginLeft: 4, opacity: 0.7 }}>
              · {formatDistance(distanceKm(userLocation.lat, userLocation.lng, dish.restauranteLat, dish.restauranteLng))}
            </span>
          )}
        </span>

        {dish.enOferta && <span className="dish-card-oferta">Oferta</span>}
      </div>

      {/* Info */}
      <div className="dish-card-info">
        <h3 className="dish-card-name">
          {dish.nombre}
          {dish.dieta.tipo === 'VEGAN' && <span style={{ marginLeft: 4 }}>🌱</span>}
          {dish.dieta.tipo === 'VEGETARIAN' && <span style={{ marginLeft: 4 }}>🥬</span>}
        </h3>
        <p className="dish-card-price">
          {dish.enOferta && dish.precioDescuento != null ? (
            <>
              <span className="dish-card-price-sale">${dish.precioDescuento.toLocaleString('es-CL')}</span>
              <span className="dish-card-price-original">${dish.precio.toLocaleString('es-CL')}</span>
            </>
          ) : (
            <>${dish.precio.toLocaleString('es-CL')}</>
          )}
        </p>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import type { FeedDish } from '../types'
import { getCategoryGradient } from '../lib/categories'
import { distanceKm, formatDistance } from '../lib/geo'

export default function DishCard({
  dish,
  onTap,
  onLike,
  onDwell,
  userLocation,
}: {
  dish: FeedDish
  onTap: (dish: FeedDish) => void
  onLike?: (dish: FeedDish) => void
  onDwell?: (dishId: string) => void
  userLocation?: { lat: number; lng: number } | null
}) {
  const cardRef = useRef<HTMLDivElement>(null)

  // Dwell tracking: fire onDwell if card visible > 2s
  useEffect(() => {
    if (!onDwell || !cardRef.current) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        timer = setTimeout(() => onDwell(dish.id), 2000)
      } else if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }, { threshold: 0.5 })
    observer.observe(cardRef.current)
    return () => { observer.disconnect(); if (timer) clearTimeout(timer) }
  }, [dish.id, onDwell])
  const [imgError, setImgError] = useState(false)
  const [liked, setLiked] = useState(false)

  const gradient = getCategoryGradient(dish.categoriaNorm)
  const showFallback = !dish.fotoUrl || imgError

  // Pseudo-random aspect ratio for Pinterest-style varied heights
  // Use multiple chars from ID for better distribution
  let seed = 0
  for (let i = 0; i < dish.id.length; i++) seed = (seed * 31 + dish.id.charCodeAt(i)) & 0xffff
  const ratios = ['3/4', '4/5', '1/1', '5/7', '2/3', '5/6', '4/5', '7/9', '3/4', '5/8', '1/1', '4/5']
  const aspectRatio = ratios[seed % ratios.length]

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setLiked(!liked)
    onLike?.(dish)
  }

  return (
    <div ref={cardRef} className="dish-card" onClick={() => onTap(dish)}>
      {/* Photo */}
      <div style={{ position: 'relative', aspectRatio, overflow: 'hidden', background: gradient }}>
        {!showFallback ? (
          <img
            src={dish.fotoUrl!}
            alt={dish.nombre}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="dish-card-gradient">
            <span>{dish.nombre}</span>
          </div>
        )}

        {/* Like */}
        <button className="dish-card-like" onClick={handleLike}>
          <svg width="15" height="15" viewBox="0 0 24 24"
            fill={liked ? '#F4A623' : 'none'}
            stroke={liked ? '#F4A623' : 'rgba(255,255,255,0.8)'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        <span className="dish-card-badge">
          {dish.restaurante}
          {userLocation && dish.restauranteLat && dish.restauranteLng && (
            <span style={{ marginLeft: 4, opacity: 0.7 }}>
              · {formatDistance(distanceKm(userLocation.lat, userLocation.lng, dish.restauranteLat, dish.restauranteLng))}
            </span>
          )}
        </span>

        {/* Oferta */}
        {dish.enOferta && <span className="dish-card-oferta">Oferta</span>}
      </div>

      {/* Info */}
      <div className="dish-card-info">
        <h3 className="dish-card-name">
          {dish.nombre}
          {dish.dieta.tipo === 'VEGAN' && <span title="Vegano" style={{ marginLeft: 4 }}>🌱</span>}
          {dish.dieta.tipo === 'VEGETARIAN' && <span title="Vegetariano" style={{ marginLeft: 4 }}>🥬</span>}
        </h3>

        <p className="dish-card-price">
          {dish.enOferta && dish.precioDescuento != null ? (
            <>
              <span className="dish-card-price-sale">
                ${dish.precioDescuento.toLocaleString('es-CL')}
              </span>
              <span className="dish-card-price-original">
                ${dish.precio.toLocaleString('es-CL')}
              </span>
            </>
          ) : (
            <>${dish.precio.toLocaleString('es-CL')}</>
          )}
        </p>


      </div>
    </div>
  )
}

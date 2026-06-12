'use client'

import { useState } from 'react'
import type { FeedDish } from '../types'
import { getCategoryGradient } from '../lib/categories'

export default function DishCard({
  dish,
  onTap,
  onLike,
}: {
  dish: FeedDish
  onTap: (dish: FeedDish) => void
  onLike?: (dish: FeedDish) => void
}) {
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [liked, setLiked] = useState(false)

  const gradient = getCategoryGradient(dish.categoriaNorm)
  const showFallback = !dish.fotoUrl || imgError

  const handleLike = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setLiked(!liked)
    onLike?.(dish)
  }

  return (
    <div
      onClick={() => onTap(dish)}
      role="button"
      tabIndex={0}
      className="w-full text-left rounded-xl overflow-hidden bg-white/[0.04] active:scale-[0.97] transition-transform break-inside-avoid mb-2.5 cursor-pointer"
    >
      {/* Photo */}
      <div className="relative w-full" style={{ minHeight: 140 }}>
        {!showFallback && (
          <img
            src={dish.fotoUrl!}
            alt={dish.nombre}
            className={`w-full block object-cover transition-opacity duration-300 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            loading="lazy"
            decoding="async"
          />
        )}
        {(showFallback || !imgLoaded) && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: gradient, minHeight: 160 }}
          >
            <span
              className="text-white/70 text-base font-semibold text-center px-4 leading-snug"
              style={{ fontFamily: 'var(--font-feed-display), serif' }}
            >
              {dish.nombre}
            </span>
          </div>
        )}

        {/* Like */}
        <div
          onClick={handleLike}
          onTouchEnd={handleLike}
          role="button"
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center z-10"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill={liked ? '#ef4444' : 'none'}
            stroke={liked ? '#ef4444' : 'rgba(255,255,255,0.8)'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </div>

        {/* Category badge */}
        <div className="absolute bottom-2 left-2 z-10">
          <span className="text-[9px] font-medium bg-black/50 backdrop-blur-sm text-white/70 px-2 py-0.5 rounded-full">
            {dish.categoriaNorm}
          </span>
        </div>

        {/* Oferta badge */}
        {dish.enOferta && (
          <div className="absolute top-2 left-2 z-10">
            <span className="text-[9px] font-bold bg-green-500 text-white px-2 py-0.5 rounded-full">
              Oferta
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-2.5 py-2.5 space-y-0.5">
        <h3
          className="text-[13px] font-semibold leading-snug line-clamp-2 text-white/90"
          style={{ fontFamily: 'var(--font-feed-display), serif' }}
        >
          {dish.nombre}
        </h3>

        <div className="flex items-baseline gap-1.5">
          {dish.enOferta && dish.precioDescuento != null ? (
            <>
              <span className="text-green-400 text-[13px] font-bold">
                ${dish.precioDescuento.toLocaleString('es-CL')}
              </span>
              <span className="text-white/25 text-[11px] line-through">
                ${dish.precio.toLocaleString('es-CL')}
              </span>
            </>
          ) : (
            <span className="text-[#F4A623] text-[13px] font-bold">
              ${dish.precio.toLocaleString('es-CL')}
            </span>
          )}
        </div>

        {/* Stars */}
        <div className="flex items-center gap-0.5 pt-0.5">
          {[1, 2, 3, 4, 5].map(star => (
            <svg
              key={star}
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill={dish.avgRating != null && star <= Math.round(dish.avgRating) ? '#F4A623' : 'none'}
              stroke={dish.avgRating != null && star <= Math.round(dish.avgRating) ? '#F4A623' : 'rgba(255,255,255,0.12)'}
              strokeWidth="2"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          ))}
          {dish.ratingCount > 0 && (
            <span className="text-white/25 text-[9px] ml-0.5">({dish.ratingCount})</span>
          )}
        </div>

        <p className="text-white/30 text-[11px] truncate">{dish.restaurante}</p>
      </div>
    </div>
  )
}

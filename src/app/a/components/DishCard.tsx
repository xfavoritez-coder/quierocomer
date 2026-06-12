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

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation()
    setLiked(!liked)
    onLike?.(dish)
  }

  return (
    <button
      onClick={() => onTap(dish)}
      className="w-full text-left rounded-2xl overflow-hidden bg-white/5 transition-transform active:scale-[0.97] group relative break-inside-avoid mb-3"
    >
      {/* Foto */}
      <div className="relative w-full" style={{ minHeight: 160 }}>
        {!showFallback && (
          <img
            src={dish.fotoUrl!}
            alt={dish.nombre}
            className={`w-full object-cover transition-opacity duration-300 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        )}
        {(showFallback || !imgLoaded) && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: gradient }}
          >
            <span
              className="text-white/80 text-lg font-semibold text-center px-4 leading-tight"
              style={{ fontFamily: 'var(--font-feed-display), serif' }}
            >
              {dish.nombre}
            </span>
          </div>
        )}

        {/* Like button */}
        <button
          onClick={handleLike}
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-all hover:bg-black/60 z-10"
          aria-label={liked ? 'Quitar me gusta' : 'Me gusta'}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={liked ? '#ef4444' : 'none'}
            stroke={liked ? '#ef4444' : 'white'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {/* Badge de categoría */}
        <div className="absolute bottom-2.5 left-2.5 z-10">
          <span className="text-[10px] font-medium bg-black/50 backdrop-blur-sm text-white/80 px-2 py-0.5 rounded-full">
            {dish.categoriaNorm}
          </span>
        </div>

        {/* Badge de oferta */}
        {dish.enOferta && (
          <div className="absolute top-2.5 left-2.5 z-10">
            <span className="text-[10px] font-semibold bg-green-500/90 text-white px-2 py-0.5 rounded-full">
              Oferta
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <h3
          className="text-[15px] font-semibold leading-snug line-clamp-2 text-white"
          style={{ fontFamily: 'var(--font-feed-display), serif' }}
        >
          {dish.nombre}
        </h3>

        <div className="flex items-center gap-1.5">
          {dish.enOferta && dish.precioDescuento != null ? (
            <>
              <span className="text-green-400 text-sm font-semibold">
                ${dish.precioDescuento.toLocaleString('es-CL')}
              </span>
              <span className="text-white/30 text-xs line-through">
                ${dish.precio.toLocaleString('es-CL')}
              </span>
            </>
          ) : (
            <span className="text-[#F4A623] text-sm font-semibold">
              ${dish.precio.toLocaleString('es-CL')}
            </span>
          )}
        </div>

        {/* Estrellas */}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map(star => (
            <svg
              key={star}
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill={
                dish.avgRating != null && star <= Math.round(dish.avgRating)
                  ? '#F4A623'
                  : 'none'
              }
              stroke={
                dish.avgRating != null && star <= Math.round(dish.avgRating)
                  ? '#F4A623'
                  : 'rgba(255,255,255,0.2)'
              }
              strokeWidth="2"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          ))}
          {dish.ratingCount > 0 && (
            <span className="text-white/30 text-[10px] ml-0.5">
              ({dish.ratingCount})
            </span>
          )}
        </div>

        <p className="text-white/40 text-xs truncate">
          {dish.restaurante}
        </p>
      </div>
    </button>
  )
}

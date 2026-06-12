'use client'

import { useState, useEffect } from 'react'
import type { FeedDish } from '../types'
import { getCategoryGradient } from '../lib/categories'

export default function DishModal({
  dish,
  reason,
  onClose,
  onLike,
  onSave,
  onAntojo,
  onPass,
  onRate,
}: {
  dish: FeedDish
  reason?: string | null
  onClose: () => void
  onLike: (dish: FeedDish) => void
  onSave: (dish: FeedDish) => void
  onAntojo: (dish: FeedDish) => void
  onPass: (dish: FeedDish) => void
  onRate: (dish: FeedDish, stars: number) => void
}) {
  const [imgError, setImgError] = useState(false)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [userRating, setUserRating] = useState(0)
  const [showAntojoSheet, setShowAntojoSheet] = useState(false)
  const [antojoConfirmed, setAntojoConfirmed] = useState(false)

  const gradient = getCategoryGradient(dish.categoriaNorm)

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Close on escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleLike = () => {
    setLiked(!liked)
    onLike(dish)
  }

  const handleSave = () => {
    setSaved(!saved)
    onSave(dish)
  }

  const handlePass = () => {
    onPass(dish)
    onClose()
  }

  const handleAntojo = () => {
    setShowAntojoSheet(true)
    setAntojoConfirmed(true)
    onAntojo(dish)
  }

  const handleRate = (stars: number) => {
    setUserRating(stars)
    onRate(dish, stars)
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal bottom sheet */}
      <div className="fixed inset-x-0 bottom-0 z-[70] max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-[#161616] animate-slide-up">
        <div className="max-w-[460px] mx-auto">
          {/* Drag handle */}
          <div className="sticky top-0 z-10 flex justify-center pt-3 pb-2 bg-[#161616] rounded-t-3xl">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          {/* Hero image */}
          <div className="relative w-full aspect-[4/3] overflow-hidden">
            {dish.fotoUrl && !imgError ? (
              <img
                src={dish.fotoUrl}
                alt={dish.nombre}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: gradient }}
              >
                <span
                  className="text-white/70 text-2xl font-bold text-center px-8"
                  style={{ fontFamily: 'var(--font-feed-display), serif' }}
                >
                  {dish.nombre}
                </span>
              </div>
            )}

            {/* Gradient overlay bottom */}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#161616] to-transparent" />

            {/* Category badge */}
            <div className="absolute top-4 left-4">
              <span className="text-xs font-medium bg-black/50 backdrop-blur-sm text-white/80 px-3 py-1 rounded-full">
                {dish.categoriaNorm}
              </span>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {/* Oferta badge */}
            {dish.enOferta && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2">
                <span className="text-xs font-semibold bg-green-500/90 text-white px-3 py-1 rounded-full">
                  En oferta
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="px-5 pb-6 -mt-4 relative space-y-4">
            {/* Title + price */}
            <div>
              <h2
                className="text-2xl font-bold leading-tight text-white"
                style={{ fontFamily: 'var(--font-feed-display), serif' }}
              >
                {dish.nombre}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                {dish.enOferta && dish.precioDescuento != null ? (
                  <>
                    <span className="text-green-400 text-lg font-bold">
                      ${dish.precioDescuento.toLocaleString('es-CL')}
                    </span>
                    <span className="text-white/30 text-sm line-through">
                      ${dish.precio.toLocaleString('es-CL')}
                    </span>
                  </>
                ) : (
                  <span className="text-[#F4A623] text-lg font-bold">
                    ${dish.precio.toLocaleString('es-CL')}
                  </span>
                )}
              </div>
            </div>

            {/* Recommendation reason */}
            {reason && (
              <p className="text-[#F4A623]/70 text-xs font-medium italic">
                {reason}
              </p>
            )}

            {/* Rating - interactive */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map(star => {
                  const filled = userRating > 0
                    ? star <= userRating
                    : dish.avgRating != null && star <= Math.round(dish.avgRating)
                  return (
                    <button
                      key={star}
                      onClick={() => handleRate(star)}
                      className="p-0.5 transition-transform hover:scale-110"
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill={filled ? '#F4A623' : 'none'}
                        stroke={filled ? '#F4A623' : 'rgba(255,255,255,0.2)'}
                        strokeWidth="2"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                  )
                })}
              </div>
              <span className="text-white/30 text-xs">
                {userRating > 0
                  ? 'Tu calificación'
                  : dish.ratingCount > 0
                    ? `${dish.avgRating?.toFixed(1)} (${dish.ratingCount})`
                    : 'Sin calificaciones'}
              </span>
            </div>

            {/* Restaurant */}
            <a
              href={`/carta/${dish.restauranteSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white/5 rounded-xl p-3 hover:bg-white/8 transition-colors"
            >
              {dish.restauranteLogo ? (
                <img
                  src={dish.restauranteLogo}
                  alt={dish.restaurante}
                  className="w-10 h-10 rounded-full object-cover bg-white/10"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/50 text-sm font-bold">
                  {dish.restaurante.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{dish.restaurante}</p>
                {dish.restauranteDireccion && (
                  <p className="text-white/40 text-xs truncate">{dish.restauranteDireccion}</p>
                )}
              </div>
              <span className="text-white/30 text-xs">Ver carta</span>
            </a>

            {/* Description */}
            {dish.descripcion && (
              <p className="text-white/50 text-sm leading-relaxed">
                {dish.descripcion}
              </p>
            )}

            {/* Diet badges */}
            {(dish.dieta.tipo !== 'OMNIVORE' || dish.dieta.sinGluten || dish.dieta.sinLactosa || dish.dieta.esPicante) && (
              <div className="flex flex-wrap gap-1.5">
                {dish.dieta.tipo === 'VEGAN' && (
                  <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Vegano</span>
                )}
                {dish.dieta.tipo === 'VEGETARIAN' && (
                  <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Vegetariano</span>
                )}
                {dish.dieta.sinGluten && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Sin gluten</span>
                )}
                {dish.dieta.sinLactosa && (
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">Sin lactosa</span>
                )}
                {dish.dieta.esPicante && (
                  <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Picante</span>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-6 py-2">
              <button
                onClick={handlePass}
                className="flex flex-col items-center gap-1 text-white/40 hover:text-white/60 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                  </svg>
                </div>
                <span className="text-[10px]">Paso</span>
              </button>

              <button
                onClick={handleLike}
                className={`flex flex-col items-center gap-1 transition-colors ${liked ? 'text-red-500' : 'text-white/40 hover:text-white/60'}`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${liked ? 'bg-red-500/20' : 'bg-white/5 hover:bg-white/10'}`}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill={liked ? '#ef4444' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </div>
                <span className="text-[10px]">Me gusta</span>
              </button>

              <button
                onClick={handleSave}
                className={`flex flex-col items-center gap-1 transition-colors ${saved ? 'text-[#F4A623]' : 'text-white/40 hover:text-white/60'}`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${saved ? 'bg-[#F4A623]/20' : 'bg-white/5 hover:bg-white/10'}`}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill={saved ? '#F4A623' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <span className="text-[10px]">Guardar</span>
              </button>
            </div>

            {/* CTA Se me antoja */}
            {!antojoConfirmed ? (
              <button
                onClick={handleAntojo}
                className="w-full py-3.5 rounded-2xl bg-[#F4A623] text-black font-bold text-base transition-all hover:bg-[#e09a1f] active:scale-[0.98]"
                style={{ fontFamily: 'var(--font-feed-body), sans-serif' }}
              >
                Se me antoja
              </button>
            ) : !showAntojoSheet ? (
              <div className="text-center text-[#F4A623] text-sm font-medium py-3">
                Guardado en tus antojos
              </div>
            ) : (
              /* Antojo mini-sheet */
              <div className="space-y-2 animate-fade-in">
                <p className="text-center text-[#F4A623] text-sm font-medium">
                  Guardado en tus antojos
                </p>
                <a
                  href={`/carta/${dish.restauranteSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3 rounded-xl bg-white/5 text-center text-white text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  Ver carta del local
                </a>
                {dish.restauranteDireccion && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dish.restauranteDireccion + ' ' + dish.restaurante)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-3 rounded-xl bg-white/5 text-center text-white text-sm font-medium hover:bg-white/10 transition-colors"
                  >
                    Cómo llegar
                  </a>
                )}
                <button
                  onClick={() => setShowAntojoSheet(false)}
                  className="w-full py-2 text-white/30 text-xs"
                >
                  Cerrar
                </button>
              </div>
            )}

            {/* Comments placeholder */}
            <div className="pt-2 border-t border-white/5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white/60">
                  Comentarios {dish.commentCount > 0 && `(${dish.commentCount})`}
                </h3>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Escribe un comentario..."
                  className="flex-1 bg-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:bg-white/8 transition-colors"
                />
                <button className="px-4 py-2.5 rounded-xl bg-[#F4A623]/20 text-[#F4A623] text-sm font-medium hover:bg-[#F4A623]/30 transition-colors">
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </>
  )
}

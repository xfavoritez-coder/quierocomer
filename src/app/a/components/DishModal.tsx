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
  const gradient = getCategoryGradient(dish.categoriaNorm)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <>
      <div className="dish-modal-overlay" onClick={onClose} />
      <div className="dish-modal">
        <div style={{ maxWidth: 480, margin: '0 auto' }}>
          <div className="dish-modal-handle"><div /></div>

          {/* Hero image */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden', background: '#1a1a1a' }}>
            {dish.fotoUrl && !imgError ? (
              <img src={dish.fotoUrl} alt={dish.nombre}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={() => setImgError(true)} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: gradient }}>
                <span style={{ fontFamily: 'var(--font-feed-display), serif', fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textAlign: 'center', padding: '0 32px' }}>
                  {dish.nombre}
                </span>
              </div>
            )}
            {/* Gradient bottom */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to top, #161616, transparent)' }} />
            {/* Close */}
            <button onClick={onClose} style={{
              position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.8)',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            {dish.enOferta && <span className="dish-card-oferta" style={{ top: 16 }}>En oferta</span>}
          </div>

          {/* Action row: pass/like left — save right */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px 0' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <ActionBtn icon="pass" label="Paso" active={false} color="#fff"
                onClick={() => { onPass(dish); onClose() }} />
              <ActionBtn icon="heart" label="Me gusta" active={liked} color="#F4A623"
                onClick={() => { setLiked(!liked); onLike(dish) }} />
            </div>
            <ActionBtn icon="save" label="Guardar" active={saved} color="#F4A623"
              onClick={() => { setSaved(!saved); onSave(dish) }} />
          </div>

          {/* Content */}
          <div style={{ padding: '16px 20px 32px' }}>
            {/* Name + Price */}
            <h2 style={{
              fontFamily: 'var(--font-feed-display), serif',
              fontSize: 22, fontWeight: 700, color: '#fff',
              margin: '0 0 4px', lineHeight: 1.25,
            }}>
              {dish.nombre}
              {dish.dieta.tipo === 'VEGAN' && <span style={{ marginLeft: 6 }}>🌱</span>}
              {dish.dieta.tipo === 'VEGETARIAN' && <span style={{ marginLeft: 6 }}>🥬</span>}
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              {dish.enOferta && dish.precioDescuento != null ? (
                <>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#4ade80' }}>
                    ${dish.precioDescuento.toLocaleString('es-CL')}
                  </span>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through' }}>
                    ${dish.precio.toLocaleString('es-CL')}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 18, fontWeight: 700, color: '#F4A623' }}>
                  ${dish.precio.toLocaleString('es-CL')}
                </span>
              )}

              <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 14 }}>·</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{dish.categoriaNorm}</span>
            </div>

            {/* Reason */}
            {reason && (
              <p style={{ color: 'rgba(244,166,35,0.5)', fontSize: 12, fontStyle: 'italic', margin: '0 0 14px' }}>
                {reason}
              </p>
            )}

            {/* Stars */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 2 }}>
                {[1, 2, 3, 4, 5].map(star => {
                  const filled = userRating > 0 ? star <= userRating : dish.avgRating != null && star <= Math.round(dish.avgRating)
                  return (
                    <button key={star} onClick={() => { setUserRating(star); onRate(dish, star) }}
                      style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24"
                        fill={filled ? '#F4A623' : 'none'}
                        stroke={filled ? '#F4A623' : 'rgba(255,255,255,0.12)'}
                        strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                  )
                })}
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
                {userRating > 0 ? 'Tu calificación' : dish.ratingCount > 0 ? `${dish.avgRating?.toFixed(1)} (${dish.ratingCount})` : 'Califica este plato'}
              </span>
            </div>

            {/* Description */}
            {dish.descripcion && (
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, margin: '0 0 16px' }}>
                {dish.descripcion}
              </p>
            )}

            {/* Diet badges */}
            {(dish.dieta.sinGluten || dish.dieta.sinLactosa || dish.dieta.esPicante) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {dish.dieta.sinGluten && <span style={badgeStyle('#f59e0b')}>Sin gluten</span>}
                {dish.dieta.sinLactosa && <span style={badgeStyle('#3b82f6')}>Sin lactosa</span>}
                {dish.dieta.esPicante && <span style={badgeStyle('#ef4444')}>Picante</span>}
              </div>
            )}

            {/* Restaurant */}
            <a href={`/qr/${dish.restauranteSlug}`} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: 12, borderRadius: 12,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                textDecoration: 'none', marginBottom: 16,
              }}>
              {dish.restauranteLogo ? (
                <img src={dish.restauranteLogo} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', background: 'rgba(255,255,255,0.1)' }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: 700 }}>
                  {dish.restaurante.charAt(0)}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dish.restaurante}</p>
                {dish.restauranteDireccion && (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dish.restauranteDireccion}</p>
                )}
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>Ver carta →</span>
            </a>

            {/* Comments */}
            <div style={{ paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.4)', margin: '0 0 10px' }}>
                Comentarios {dish.commentCount > 0 && `(${dish.commentCount})`}
              </h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" placeholder="Escribe un comentario..."
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#fff', outline: 'none',
                  }} />
                <button style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(244,166,35,0.12)', border: 'none',
                  color: '#F4A623', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const badgeStyle = (color: string): React.CSSProperties => ({
  fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20,
  background: `${color}20`, color,
})

function ActionBtn({ icon, label, active, color, onClick }: {
  icon: 'pass' | 'heart' | 'save'; label: string; active: boolean; color: string; onClick: () => void
}) {
  const icons = {
    pass: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </svg>,
    heart: <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? color : 'none'} stroke={active ? color : 'currentColor'} strokeWidth="2" strokeLinecap="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>,
    save: <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? color : 'none'} stroke={active ? color : 'currentColor'} strokeWidth="2" strokeLinecap="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>,
  }

  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      background: 'none', border: 'none', cursor: 'pointer',
      color: active ? color : 'rgba(255,255,255,0.4)',
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: '50%',
        background: active ? `${color}15` : 'rgba(255,255,255,0.05)',
        border: `1px solid ${active ? `${color}30` : 'rgba(255,255,255,0.08)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icons[icon]}
      </div>
      <span style={{ fontSize: 10 }}>{label}</span>
    </button>
  )
}

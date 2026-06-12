'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import type { FeedDish } from '../types'
import { getCategoryGradient } from '../lib/categories'
import { keywordAffinity } from '../lib/keywords'
import type { FeedProfile } from '../lib/scoring'
import { affinity } from '../lib/scoring'

export default function DishModal({
  dish,
  allDishes,
  profile,
  reason,
  onClose,
  onLike,
  onSave,
  onPass,
  onRate,
  onDishTap,
}: {
  dish: FeedDish
  allDishes: FeedDish[]
  profile: FeedProfile
  reason?: string | null
  onClose: () => void
  onLike: (dish: FeedDish) => void
  onSave: (dish: FeedDish) => void
  onPass: (dish: FeedDish) => void
  onRate: (dish: FeedDish, stars: number) => void
  onDishTap: (dish: FeedDish) => void
}) {
  const [imgError, setImgError] = useState(false)
  const [thumbUp, setThumbUp] = useState(false)
  const [thumbDown, setThumbDown] = useState(false)
  const [saved, setSaved] = useState(false)
  const [userRating, setUserRating] = useState(0)
  const [showLocalFicha, setShowLocalFicha] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const gradient = getCategoryGradient(dish.categoriaNorm)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Swipe down to close
  const touchStart = useRef(0)
  const handleTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientY }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientY - touchStart.current
    if (diff > 100 && modalRef.current && modalRef.current.scrollTop <= 0) onClose()
  }

  // Related dishes: use the scoring engine, not just keyword match
  const relatedDishes = useMemo(() => {
    return allDishes
      .filter(d => d.id !== dish.id && d.fotoUrl)
      .map(d => ({ dish: d, score: affinity(d, profile) + (d.categoriaNorm === dish.categoriaNorm ? 3 : 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map(x => x.dish)
  }, [dish, allDishes, profile])

  // Restaurant dishes
  const restDishes = useMemo(() =>
    allDishes.filter(d => d.restauranteId === dish.restauranteId && d.id !== dish.id && d.fotoUrl).slice(0, 8),
    [dish, allDishes]
  )

  return (
    <>
      <div className="dish-modal-overlay" onClick={onClose} />
      <div className="dish-modal" ref={modalRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div style={{ maxWidth: 480, margin: '0 auto', position: 'relative' }}>

          {/* Sticky close button */}
          <button onClick={onClose} style={{
            position: 'sticky', top: 12, float: 'right', marginRight: 16,
            width: 40, height: 40, borderRadius: '50%', zIndex: 10,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            color: 'rgba(255,255,255,0.8)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          {/* Hero image with action buttons inside */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden', background: '#1a1a1a', marginTop: -34 }}>
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

          </div>

          {/* Content */}
          <div style={{ padding: '16px 20px 0' }}>
            {/* Name + actions row */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 4 }}>
              <h2 style={{
                fontFamily: 'var(--font-feed-display), serif',
                fontSize: 22, fontWeight: 700, color: '#fff',
                margin: 0, lineHeight: 1.25, flex: 1, minWidth: 0,
              }}>
                {dish.nombre}
                {dish.dieta.tipo === 'VEGAN' && <span style={{ marginLeft: 6 }}>🌱</span>}
                {dish.dieta.tipo === 'VEGETARIAN' && <span style={{ marginLeft: 6 }}>🥬</span>}
              </h2>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-start', marginTop: -6 }}>
                <PhotoBtn active={thumbUp} color="#4ade80" onClick={() => { setThumbUp(true); onLike(dish) }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={thumbUp ? '#4ade80' : 'none'} stroke={thumbUp ? '#4ade80' : '#fff'} strokeWidth="2" strokeLinecap="round">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                  </svg>
                </PhotoBtn>
                <PhotoBtn active={thumbDown} color="#ef4444" onClick={() => { setThumbDown(true); onPass(dish) }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={thumbDown ? '#ef4444' : '#fff'} strokeWidth="2" strokeLinecap="round">
                    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                  </svg>
                </PhotoBtn>
                <PhotoBtn active={saved} color="#F4A623" onClick={() => { setSaved(!saved); onSave(dish) }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? '#F4A623' : 'none'} stroke={saved ? '#F4A623' : '#fff'} strokeWidth="2" strokeLinecap="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </PhotoBtn>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              {dish.enOferta && dish.precioDescuento != null ? (
                <>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#4ade80' }}>${dish.precioDescuento.toLocaleString('es-CL')}</span>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through' }}>${dish.precio.toLocaleString('es-CL')}</span>
                </>
              ) : (
                <span style={{ fontSize: 18, fontWeight: 700, color: '#F4A623' }}>${dish.precio.toLocaleString('es-CL')}</span>
              )}
              <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{dish.categoriaNorm}</span>
            </div>

            {reason && (
              <p style={{ color: 'rgba(244,166,35,0.5)', fontSize: 12, fontStyle: 'italic', margin: '0 0 12px' }}>{reason}</p>
            )}


            {dish.descripcion && (
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5, margin: '0 0 14px' }}>{dish.descripcion}</p>
            )}

            {/* Restaurant row */}
            <button onClick={() => setShowLocalFicha(!showLocalFicha)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 12px', borderRadius: 12, textAlign: 'left',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer',
            }}>
              {dish.restauranteLogo ? (
                <img src={dish.restauranteLogo} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', background: 'rgba(255,255,255,0.1)' }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 700 }}>
                  {dish.restaurante.charAt(0)}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dish.restaurante}</p>
                {dish.restauranteDireccion && (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '1px 0 0' }}>{dish.restauranteDireccion}</p>
                )}
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round"
                style={{ transform: showLocalFicha ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {/* Local ficha — no link to carta, just maps + dishes */}
            {showLocalFicha && (
              <div style={{ padding: '12px 0', animation: 'fadeIn 0.2s ease-out' }}>
                {dish.restauranteDireccion && (
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dish.restauranteDireccion + ' ' + dish.restaurante)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', padding: '10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 10 }}>
                    📍 Cómo llegar
                  </a>
                )}
                {restDishes.length > 0 && (
                  <>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '0 0 8px' }}>Más de {dish.restaurante}</p>
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                      {restDishes.map(d => (
                        <div key={d.id} onClick={() => onDishTap(d)} style={{
                          flexShrink: 0, width: 110, cursor: 'pointer', borderRadius: 10, overflow: 'hidden',
                          background: 'rgba(255,255,255,0.04)',
                        }}>
                          <img src={d.fotoUrl!} alt={d.nombre} style={{ width: 110, height: 80, objectFit: 'cover', display: 'block' }} />
                          <div style={{ padding: '6px 8px' }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre}</p>
                            <p style={{ fontSize: 10, color: '#F4A623', margin: '2px 0 0', fontWeight: 600 }}>${d.precio.toLocaleString('es-CL')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Related dishes — masonry style like the feed */}
          {relatedDishes.length > 0 && (
            <div style={{ padding: '16px 12px 32px', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 12px', paddingLeft: 4 }}>También te podría gustar</p>
              <div style={{ display: 'flex', gap: 10 }}>
                {[0, 1].map(col => (
                  <div key={col} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {relatedDishes.filter((_, i) => i % 2 === col).map(d => {
                      const seed = d.id.charCodeAt(0) + d.id.charCodeAt(d.id.length - 1)
                      const ratios = ['3/4', '4/5', '1/1', '5/7']
                      return (
                        <div key={d.id} onClick={() => onDishTap(d)} style={{
                          cursor: 'pointer', borderRadius: 12, overflow: 'hidden',
                          background: 'rgba(255,255,255,0.03)',
                        }}>
                          <img src={d.fotoUrl!} alt={d.nombre} style={{ width: '100%', aspectRatio: ratios[seed % ratios.length], objectFit: 'cover', display: 'block' }} />
                          <div style={{ padding: '8px 10px' }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre}</p>
                            <p style={{ fontSize: 11, color: '#F4A623', margin: '2px 0 0', fontWeight: 600 }}>${d.precio.toLocaleString('es-CL')}</p>
                            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: '1px 0 0' }}>{d.restaurante}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function PhotoBtn({ active, color, onClick, children }: {
  active: boolean; color: string; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button onClick={onClick} style={{
      width: 40, height: 40, borderRadius: '50%',
      background: active ? `${color}30` : 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      border: active ? `1px solid ${color}50` : '1px solid rgba(255,255,255,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', padding: 0, transition: 'all 0.15s',
    }}>
      {children}
    </button>
  )
}

'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import type { FeedDish } from '../types'
import { getCategoryGradient } from '../lib/categories'
import { extractKeywords, keywordAffinity } from '../lib/keywords'
import type { FeedProfile } from '../lib/scoring'
import { getSimilarDishIds } from '../lib/feed-actions'
import DishCard from './DishCard'

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
  const [showReviews, setShowReviews] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentSent, setCommentSent] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const gradient = getCategoryGradient(dish.categoriaNorm)

  // Deterministic fake rating per dish
  let fakeSeed = 0
  for (let i = 0; i < dish.id.length; i++) fakeSeed = (fakeSeed * 31 + dish.id.charCodeAt(i)) & 0xffff
  const fakeRating = dish.avgRating ?? Number(((fakeSeed % 10) * 0.1 + 4.0).toFixed(1))
  const fakeCount = dish.ratingCount || (fakeSeed % 80 + 15)
  const displayRating = userRating > 0 ? userRating : fakeRating

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Swipe: horizontal = like/dislike, vertical down = close
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const [swipeX, setSwipeX] = useState(0)
  const [liked, setLiked] = useState(false)
  const [disliked, setDisliked] = useState(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (modalRef.current && modalRef.current.scrollTop > 0) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current)
    if (Math.abs(dx) > 15 && Math.abs(dx) > dy) {
      setSwipeX(dx)
    }
  }
  const [flyAway, setFlyAway] = useState<'left' | 'right' | null>(null)

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(swipeX) > 80) {
      const direction = swipeX > 0 ? 'right' : 'left'
      if (swipeX > 0) { onLike(dish) } else { onPass(dish) }
      setFlyAway(direction)
      setTimeout(() => onClose(), 300)
    } else if (dy > 100 && modalRef.current && modalRef.current.scrollTop <= 0) {
      onClose()
    }
    setSwipeX(0)
  }

  // Related dishes: embedding similarity (pgvector) with keyword fallback
  const [embeddingSimilarIds, setEmbeddingSimilarIds] = useState<string[] | null>(null)

  useEffect(() => {
    getSimilarDishIds(dish.id).then(ids => {
      if (ids.length > 0) setEmbeddingSimilarIds(ids)
    }).catch(() => {})
  }, [dish.id])

  const relatedDishes = useMemo(() => {
    // If we have embedding-based results, use those
    if (embeddingSimilarIds && embeddingSimilarIds.length > 0) {
      const dishMap = new Map(allDishes.filter(d => d.fotoUrl).map(d => [d.id, d]))
      return embeddingSimilarIds
        .map(id => dishMap.get(id))
        .filter(Boolean) as FeedDish[]
    }

    // Fallback: keyword similarity
    const thisKws = new Set(extractKeywords(dish.nombre, dish.descripcion))

    return allDishes
      .filter(d => d.id !== dish.id && d.fotoUrl)
      .map(d => {
        let score = 0
        const dKws = extractKeywords(d.nombre, d.descripcion)
        for (const kw of dKws) if (thisKws.has(kw)) score += 4
        if (d.categoriaNorm === dish.categoriaNorm) score += 3
        for (const kw of dKws) {
          const kwScore = profile.keywordScores[kw] ?? 0
          if (kwScore > 0) score += 1
        }
        const catScore = profile.categoryScores[d.categoriaNorm] ?? 0
        if (catScore > 0) score += catScore * 0.1
        score += Math.random() * 2
        return { dish: d, score }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map(x => x.dish)
  }, [dish, allDishes, profile, embeddingSimilarIds])

  // Restaurant dishes
  const restDishes = useMemo(() =>
    allDishes.filter(d => d.restauranteId === dish.restauranteId && d.id !== dish.id && d.fotoUrl).slice(0, 8),
    [dish, allDishes]
  )

  return (
    <>
      <div className="dish-modal-overlay" onClick={onClose} />
      <div className="dish-modal" ref={modalRef} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        style={{
          transform: flyAway ? `translateX(${flyAway === 'right' ? '120%' : '-120%'}) rotate(${flyAway === 'right' ? '15' : '-15'}deg)`
            : swipeX !== 0 ? `translateX(${swipeX * 0.3}px) rotate(${swipeX * 0.02}deg)` : undefined,
          transition: flyAway ? 'transform 0.3s ease-in' : swipeX === 0 ? 'transform 0.2s ease' : 'none',
          opacity: flyAway ? 0.5 : 1,
        }}>
        <div style={{ maxWidth: 480, margin: '0 auto', position: 'relative' }}>

          {/* Swipe indicator */}
          {Math.abs(swipeX) > 40 && (
            <div style={{
              position: 'absolute', top: 20, left: swipeX > 0 ? 20 : undefined, right: swipeX < 0 ? 20 : undefined,
              zIndex: 15, padding: '8px 16px', borderRadius: 10,
              background: swipeX > 0 ? 'rgba(244,166,35,0.9)' : 'rgba(239,68,68,0.9)',
              color: '#fff',
              fontSize: 14, fontWeight: 700,
            }}>
              {swipeX > 0 ? '👍 Me gusta' : '👎 Paso'}
            </div>
          )}

          {/* Liked/disliked badge */}
          {(liked || disliked) && (
            <div style={{
              position: 'absolute', top: 16, right: 56, zIndex: 12,
              padding: '6px 12px', borderRadius: 8,
              background: liked ? 'rgba(244,166,35,0.85)' : 'rgba(255,255,255,0.15)',
              color: liked ? '#000' : '#fff',
              fontSize: 11, fontWeight: 700,
              boxShadow: liked ? '0 2px 8px rgba(244,166,35,0.3)' : 'none',
            }}>
              {liked ? 'Me antojé 🤤' : 'Paso 👎'}
            </div>
          )}

          {/* Hero image */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden', background: '#1a1a1a' }}>
            {/* Close button inside photo */}
            <button onClick={onClose} style={{
              position: 'absolute', top: 12, right: 12, zIndex: 10,
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              color: 'rgba(255,255,255,0.8)',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
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
                {dish.dieta.tipo === 'VEGAN' && <DietTag emoji="🌱" label="Vegano" />}
                {dish.dieta.tipo === 'VEGETARIAN' && <DietTag emoji="🥬" label="Vegetariano" />}
                {dish.dieta.sinGluten && <DietTag emoji="🌾" label="Sin gluten" />}
                {dish.dieta.esPicante && <DietTag emoji="🌶️" label="Picante" />}
              </h2>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-start', marginTop: -6 }}>
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

            {dish.descripcion && (
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, margin: '0 0 14px' }}>{dish.descripcion}</p>
            )}

            {/* Restaurant row */}
            <button onClick={() => setShowLocalFicha(!showLocalFicha)} style={{
              display: 'flex', alignItems: 'center', gap: 14, width: '100%',
              padding: '14px 16px', borderRadius: 14, textAlign: 'left',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer', marginBottom: 14,
            }}>
              {dish.restauranteLogo ? (
                <img src={dish.restauranteLogo} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', background: 'rgba(255,255,255,0.1)' }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 17, fontWeight: 700 }}>
                  {dish.restaurante.charAt(0)}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dish.restaurante}</p>
                {dish.restauranteDireccion && (
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', margin: '3px 0 0' }}>{dish.restauranteDireccion}</p>
                )}
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round"
                style={{ transform: showLocalFicha ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {/* Local ficha */}
            {showLocalFicha && (
              <div style={{ padding: '0 0 12px', animation: 'fadeIn 0.2s ease-out' }}>
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

            {/* Rating + Comments — expandable */}
            <button onClick={() => setShowReviews(!showReviews)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', borderRadius: 14, marginBottom: 14,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              cursor: 'pointer', textAlign: 'left',
            }}>
              {/* Stars compact */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#F4A623' }}>{displayRating.toFixed(1)}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#F4A623" stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>
                  {fakeCount} valoraciones
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: '2px 0 0' }}>
                  {userRating > 0 ? 'Ya valoraste este plato' : 'Toca para valorar y comentar'}
                </p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round"
                style={{ transform: showReviews ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {showReviews && (
              <div style={{
                padding: '16px', borderRadius: 14, marginBottom: 14, marginTop: -8,
                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                animation: 'fadeIn 0.2s ease-out',
              }}>
                {/* Stars interactive */}
                <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 10px' }}>
                  Tu valoración
                </p>
                <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                  {[1, 2, 3, 4, 5].map(star => {
                    const filled = star <= (userRating || Math.round(displayRating))
                    return (
                      <button key={star} onClick={() => { setUserRating(star); onRate(dish, star) }}
                        style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24"
                          fill={filled ? '#F4A623' : 'none'} stroke={filled ? '#F4A623' : 'rgba(255,255,255,0.15)'} strokeWidth="1.5">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>
                    )
                  })}
                </div>

                {/* Comment input */}
                <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 8px' }}>
                  Comentario {dish.commentCount > 0 && <span style={{ fontWeight: 400 }}>({dish.commentCount})</span>}
                </p>
                {!commentSent ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="text" value={commentText} onChange={e => setCommentText(e.target.value)}
                      placeholder="¿Qué te pareció este plato?"
                      style={{
                        flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 12, padding: '12px 14px', fontSize: 14, color: '#fff', outline: 'none',
                      }} />
                    <button onClick={() => {
                      if (commentText.trim()) {
                        import('../lib/feed-actions').then(({ commentDish }) => commentDish(dish.id, commentText))
                        setCommentSent(true)
                        setCommentText('')
                      }
                    }} style={{
                      padding: '12px 16px', borderRadius: 12,
                      background: commentText.trim() ? '#F4A623' : 'rgba(255,255,255,0.05)',
                      border: 'none', color: commentText.trim() ? '#000' : 'rgba(255,255,255,0.3)',
                      fontSize: 14, fontWeight: 600, cursor: 'pointer',
                    }}>
                      Enviar
                    </button>
                  </div>
                ) : (
                  <div style={{
                    padding: '12px 16px', borderRadius: 12,
                    background: 'rgba(244,166,35,0.06)', border: '1px solid rgba(244,166,35,0.1)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F4A623" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span style={{ fontSize: 13, color: '#F4A623', fontWeight: 500 }}>Comentario enviado</span>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Related dishes — same DishCard as feed with swipe */}
          {relatedDishes.length > 0 && (
            <div style={{ padding: '16px 0 32px', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 12px', paddingLeft: 16 }}>También te podría gustar</p>
              <div style={{ display: 'flex', gap: 10, padding: '0 12px' }}>
                {[0, 1].map(col => (
                  <div key={col} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {relatedDishes.filter((_, i) => i % 2 === col).map(d => (
                      <DishCard
                        key={d.id}
                        dish={d}
                        onTap={onDishTap}
                        onLike={onLike}
                        onDislike={onPass}
                      />
                    ))}
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

function DietTag({ emoji, label }: { emoji: string; label: string }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', marginLeft: 5, cursor: 'pointer' }}
      onClick={(e) => { e.stopPropagation(); setShow(!show) }}>
      {emoji}
      {show && (
        <>
          <div onClick={(e) => { e.stopPropagation(); setShow(false) }} style={{ position: 'fixed', inset: 0, zIndex: 70 }} />
          <span style={{
            position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(30,30,30,0.95)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
            padding: '6px 12px', fontSize: 12, fontWeight: 500, color: '#fff',
            whiteSpace: 'nowrap', zIndex: 71,
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}>
            {label}
          </span>
        </>
      )}
    </span>
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

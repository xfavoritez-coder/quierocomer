'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import type { FeedDish } from '../types'
import { getCategoryGradient } from '../lib/categories'
import { extractKeywords } from '../lib/keywords'
import type { FeedProfile } from '../lib/scoring'
import { getSimilarDishIds } from '../lib/feed-actions'
import DishCard from './DishCard'

export default function DishModal({
  dish,
  allDishes,
  profile,
  reason,
  onClose,
  onSave,
  onDishTap,
  hideRelated,
}: {
  dish: FeedDish
  allDishes: FeedDish[]
  profile: FeedProfile
  reason?: string | null
  hideRelated?: boolean
  onClose: () => void
  onSave: (dish: FeedDish) => void
  onDishTap: (dish: FeedDish) => void
}) {
  const [imgError, setImgError] = useState(false)
  const [saved, setSaved] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const gradient = getCategoryGradient(dish.categoriaNorm)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Swipe down to close
  const touchStartY = useRef(0)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (dy > 100 && modalRef.current && modalRef.current.scrollTop <= 0) {
      onClose()
    }
  }

  // Related dishes — scored by similarity
  const [visibleRelated, setVisibleRelated] = useState(20)
  const [embeddingSimilarIds, setEmbeddingSimilarIds] = useState<string[] | null>(null)

  useEffect(() => {
    getSimilarDishIds(dish.id).then(ids => {
      if (ids.length > 0) setEmbeddingSimilarIds(ids)
    }).catch(() => {})
  }, [dish.id])

  const relatedDishes = useMemo(() => {
    const candidates = allDishes.filter(d => d.fotoUrl && d.id !== dish.id)

    // Build score map from embeddings (if available)
    const embeddingRank = new Map<string, number>()
    if (embeddingSimilarIds) {
      embeddingSimilarIds.forEach((id, i) => embeddingRank.set(id, 1 - i / embeddingSimilarIds.length))
    }

    const thisKws = new Set(extractKeywords(dish.nombre, dish.descripcion))

    return candidates
      .map(d => {
        let score = 0
        // Embedding similarity (strongest signal)
        const embScore = embeddingRank.get(d.id) ?? 0
        score += embScore * 10
        // Same category
        if (d.categoriaNorm === dish.categoriaNorm) score += 3
        // Keyword overlap
        const dKws = extractKeywords(d.nombre, d.descripcion)
        for (const kw of dKws) if (thisKws.has(kw)) score += 4
        // User preference
        const catScore = profile.categoryScores[d.categoriaNorm] ?? 0
        if (catScore > 0) score += Math.min(catScore * 0.1, 3)
        for (const kw of dKws) {
          const kwScore = profile.keywordScores[kw] ?? 0
          if (kwScore > 0) score += 1
        }
        return { dish: d, score }
      })
      .sort((a, b) => b.score - a.score)
      .map(x => x.dish)
  }, [dish, allDishes, profile, embeddingSimilarIds])

  // Infinite scroll for related dishes inside modal
  useEffect(() => {
    const el = modalRef.current
    if (!el) return
    const handleScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 600 && visibleRelated < relatedDishes.length) {
        setVisibleRelated(prev => Math.min(prev + 20, relatedDishes.length))
      }
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [visibleRelated, relatedDishes.length])

  // Restaurant dishes — related first (same leaf), up to 5
  const restDishes = useMemo(() => {
    const candidates = allDishes.filter(d => d.restauranteId === dish.restauranteId && d.id !== dish.id && d.fotoUrl)
    const sameLeaf = candidates.filter(d => d.categoriaNorm === dish.categoriaNorm)
    const others = candidates.filter(d => d.categoriaNorm !== dish.categoriaNorm)
    return [...sameLeaf, ...others].slice(0, 5)
  }, [dish, allDishes])

  return (
    <>
      <div className="dish-modal-overlay" onClick={onClose} />
      <div className="dish-modal" ref={modalRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div style={{ maxWidth: 480, margin: '0 auto', position: 'relative' }}>

          {/* Close button — sticky */}
          <div style={{ position: 'sticky', top: 0, zIndex: 15, display: 'flex', justifyContent: 'flex-end', padding: '10px 12px', marginBottom: -46 }}>
            <button onClick={onClose} style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              color: 'rgba(255,255,255,0.8)',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

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
          </div>

          {/* Content */}
          <div style={{ padding: '16px 20px 0' }}>
            {/* Category label — above name */}
            {dish.categoriaNorm && (
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
                {dish.categoriaNorm}
              </span>
            )}

            {/* Name + save */}
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

            {dish.precio != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                {dish.enOferta && dish.precioDescuento != null ? (
                  <>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#4ade80' }}>${dish.precioDescuento.toLocaleString('es-CL')}</span>
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through' }}>${dish.precio.toLocaleString('es-CL')}</span>
                  </>
                ) : (
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#F4A623' }}>${dish.precio.toLocaleString('es-CL')}</span>
                )}
                <span title="Los precios pueden variar" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 15, height: 15, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.18)', fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', cursor: 'default', flexShrink: 0, lineHeight: 1 }}>i</span>
              </div>
            )}

            {dish.descripcion && (
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, margin: '0 0 14px' }}>{dish.descripcion}</p>
            )}

            {/* Restaurant row */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14, width: '100%',
              padding: '14px 16px', borderRadius: 14,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              marginBottom: 12,
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
            </div>

            {/* Google Maps link */}
            {dish.restauranteDireccion && (
              <a href={
                dish.restauranteLat && dish.restauranteLng
                  ? `https://maps.google.com/?q=${dish.restauranteLat},${dish.restauranteLng}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dish.restauranteDireccion + ' ' + dish.restaurante)}`
              }
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', padding: '10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', textDecoration: 'none', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 16 }}>
                📍 Cómo llegar
              </a>
            )}
          </div>

          {/* Más de [restaurante] — always visible, full bleed */}
          {restDishes.length > 0 && (
            <div style={{ paddingBottom: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.35)', margin: '0 0 10px', paddingLeft: 20 }}>
                Más de {dish.restaurante}
              </p>
              {/* Scroll strip with fixed "ver carta" button on right */}
              <div style={{ position: 'relative' }}>
                {/* gradient fade before "ver carta" */}
                <div style={{
                  position: 'absolute', right: 72, top: 0, bottom: 4,
                  width: 36, background: 'linear-gradient(to right, transparent, #111)',
                  zIndex: 2, pointerEvents: 'none',
                }} />
                {/* "ver carta" fixed button */}
                <a
                  href={`/${dish.restauranteSlug}`}
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute', right: 0, top: 0, bottom: 4, width: 72,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 4, background: '#111', zIndex: 3, textDecoration: 'none',
                    borderLeft: '1px solid rgba(255,255,255,0.06)',
                  }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F4A623" strokeWidth="2" strokeLinecap="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#F4A623', textAlign: 'center', lineHeight: 1.2 }}>ver{'\n'}carta</span>
                </a>
                {/* scrollable photos */}
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingLeft: 20, paddingRight: 80, paddingBottom: 4, scrollbarWidth: 'none' }}>
                  {restDishes.map(d => (
                    <div key={d.id} onClick={() => onDishTap(d)} style={{
                      flexShrink: 0, width: 110, cursor: 'pointer', borderRadius: 10, overflow: 'hidden',
                      background: 'rgba(255,255,255,0.04)',
                    }}>
                      <img src={d.fotoUrl!} alt={d.nombre} style={{ width: 110, height: 80, objectFit: 'cover', display: 'block' }} />
                      <div style={{ padding: '6px 8px' }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre}</p>
                        {d.precio != null && <p style={{ fontSize: 10, color: '#F4A623', margin: '2px 0 0', fontWeight: 600 }}>${d.precio.toLocaleString('es-CL')}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Related dishes */}
          {!hideRelated && relatedDishes.length > 0 && (
            <div style={{ padding: '16px 0 32px', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)', margin: '0 0 12px', paddingLeft: 16 }}>También te podría gustar</p>
              <div style={{ display: 'flex', gap: 10, padding: '0 12px' }}>
                {[0, 1].map(col => (
                  <div key={col} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {relatedDishes.slice(0, visibleRelated).filter((_, i) => i % 2 === col).map(d => (
                      <DishCard
                        key={d.id}
                        dish={d}
                        onTap={onDishTap}
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

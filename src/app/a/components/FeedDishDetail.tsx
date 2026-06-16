'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import type { FeedDish } from '../types'
import { getCategoryGradient, isValidQcCategory } from '../lib/categories'
import { extractKeywords } from '../lib/keywords'
import type { FeedProfile } from '../lib/scoring'
import { getSimilarDishIds } from '../lib/feed-actions'
import { distanceKm, formatDistance } from '../lib/geo'
import DishCard from './DishCard'

export default function FeedDishDetail({
  dish,
  allDishes,
  dishPool,
  profile,
  onClose,
  onSave,
  onDishTap,
  onCategoryClick,
  hideRelated,
  userLocation,
}: {
  dish: FeedDish
  allDishes: FeedDish[]
  dishPool?: FeedDish[]
  profile: FeedProfile
  onClose: () => void
  onSave: (dish: FeedDish) => void
  onDishTap: (dish: FeedDish) => void
  onCategoryClick?: (category: string) => void
  hideRelated?: boolean
  userLocation?: { lat: number; lng: number } | null
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentIndex = allDishes.findIndex(d => d.id === dish.id)
  const [activeIdx, setActiveIdx] = useState(currentIndex >= 0 ? currentIndex : 0)
  const [visible, setVisible] = useState(true)
  const programmaticScrollRef = useRef(false)

  // Lock body scroll
  useEffect(() => {
    const savedY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${savedY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.overflow = ''
      window.scrollTo(0, savedY)
    }
  }, [])

  // Scroll to current dish on mount
  useEffect(() => {
    const el = scrollRef.current
    if (el && currentIndex >= 0) {
      programmaticScrollRef.current = true
      el.scrollTo({ left: currentIndex * el.clientWidth, behavior: 'instant' as any })
      setTimeout(() => { programmaticScrollRef.current = false }, 300)
    }
  }, [currentIndex])

  // Observe which slide is active
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let mounted = false
    const timer = setTimeout(() => { mounted = true }, 400)
    const slides = el.querySelectorAll('[data-slide]')
    const obs = new IntersectionObserver((entries) => {
      if (!mounted || programmaticScrollRef.current) return
      entries.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio > 0.6) {
          const idx = parseInt((e.target as HTMLElement).dataset.slide || '0')
          setActiveIdx(idx)
        }
      })
    }, { root: el, threshold: [0.6] })
    slides.forEach(s => obs.observe(s))
    return () => { clearTimeout(timer); obs.disconnect() }
  }, [allDishes.length])

  const close = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 120,
      background: '#0e0e0e',
      opacity: visible ? 1 : 0, transition: 'opacity 0.2s ease-out',
    }}>
      {/* Horizontal scroll — native snap */}
      <div
        ref={scrollRef}
        style={{
          display: 'flex', width: '100%', height: '100%',
          overflowX: 'scroll', scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' as any,
        }}
      >
        {allDishes.map((d, idx) => {
          const distance = Math.abs(idx - activeIdx)
          // Only render nearby slides
          if (distance > 3) return <div key={d.id} data-slide={idx} style={{ flex: '0 0 100%', width: '100vw', scrollSnapAlign: 'start' }} />
          return (
            <DishSlide
              key={d.id}
              dish={d}
              index={idx}
              isActive={idx === activeIdx}
              onClose={close}
              onSave={onSave}
              onDishTap={onDishTap}
              onCategoryClick={onCategoryClick}
              allDishes={allDishes}
              dishPool={dishPool}
              profile={profile}
              hideRelated={hideRelated}
              userLocation={userLocation}
            />
          )
        })}
      </div>

      <style>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}

/* ── Individual dish slide ── */
function DishSlide({
  dish, index, isActive, onClose, onSave, onDishTap, onCategoryClick,
  allDishes, dishPool, profile, hideRelated, userLocation,
}: {
  dish: FeedDish; index: number; isActive: boolean;
  onClose: () => void; onSave: (d: FeedDish) => void; onDishTap: (d: FeedDish) => void;
  onCategoryClick?: (category: string) => void;
  allDishes: FeedDish[]; dishPool?: FeedDish[]; profile: FeedProfile; hideRelated?: boolean;
  userLocation?: { lat: number; lng: number } | null;
}) {
  const [saved, setSaved] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [showLocal, setShowLocal] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const [visibleRelated, setVisibleRelated] = useState(10)
  const [restScrollEnd, setRestScrollEnd] = useState(false)
  const [restScrollStart, setRestScrollStart] = useState(true)
  const slideRef = useRef<HTMLDivElement>(null)
  const restScrollRef = useRef<HTMLDivElement>(null)
  const pullY = useRef<number | null>(null)
  const gradient = getCategoryGradient(dish.categoriaNorm)

  const dist = userLocation && dish.restauranteLat && dish.restauranteLng
    ? distanceKm(userLocation.lat, userLocation.lng, dish.restauranteLat, dish.restauranteLng) : null

  // Related dishes
  const [embeddingSimilarIds, setEmbeddingSimilarIds] = useState<string[] | null>(null)
  useEffect(() => {
    if (!isActive || hideRelated) return
    getSimilarDishIds(dish.id).then(ids => {
      if (ids.length > 0) setEmbeddingSimilarIds(ids)
    }).catch(() => {})
  }, [dish.id, isActive, hideRelated])

  const relatedDishes = useMemo(() => {
    if (hideRelated) return []
    const pool = dishPool && dishPool.length > 0 ? dishPool : allDishes
    const candidates = pool.filter(d => d.fotoUrl && d.id !== dish.id && d.restauranteId !== dish.restauranteId)
    const embRank = new Map<string, number>()
    if (embeddingSimilarIds) {
      embeddingSimilarIds.forEach((id, i) => embRank.set(id, 1 - i / embeddingSimilarIds.length))
    }
    const thisKws = new Set(extractKeywords(dish.nombre, dish.descripcion))
    const scored = candidates.map(d => {
      let relevance = embRank.get(d.id) ? (embRank.get(d.id)! * 10) : 0
      if (d.categoriaNorm === dish.categoriaNorm) relevance += 3
      const dKws = extractKeywords(d.nombre, d.descripcion)
      for (const kw of dKws) { if (thisKws.has(kw)) relevance += 4 }
      const dist = userLocation && d.restauranteLat && d.restauranteLng
        ? distanceKm(userLocation.lat, userLocation.lng, d.restauranteLat, d.restauranteLng)
        : null
      return { dish: d, relevance, dist }
    })

    const sorted = userLocation
      ? scored.sort((a, b) => {
          if (a.dist === null && b.dist === null) return b.relevance - a.relevance
          if (a.dist === null) return 1
          if (b.dist === null) return -1
          return a.dist !== b.dist ? a.dist - b.dist : b.relevance - a.relevance
        })
      : scored.sort((a, b) => b.relevance - a.relevance)

    // Máx 2 platos por local para que haya variedad
    const perLocal = new Map<string, number>()
    const result: FeedDish[] = []
    for (const x of sorted) {
      const count = perLocal.get(x.dish.restauranteId) ?? 0
      if (count >= 2) continue
      perLocal.set(x.dish.restauranteId, count + 1)
      result.push(x.dish)
      if (result.length >= 20) break
    }
    return result
  }, [dish, allDishes, dishPool, embeddingSimilarIds, hideRelated, userLocation])

  // Infinite scroll for related dishes inside slide
  useEffect(() => {
    const el = slideRef.current
    if (!el) return
    const handleScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 600 && visibleRelated < relatedDishes.length) {
        setVisibleRelated(prev => Math.min(prev + 10, relatedDishes.length))
      }
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [visibleRelated, relatedDishes.length])

  // Restaurant dishes
  const restDishes = useMemo(() =>
    allDishes.filter(d => d.restauranteId === dish.restauranteId && d.id !== dish.id && d.fotoUrl).slice(0, 8),
    [dish, allDishes]
  )

  return (
    <div
      ref={slideRef}
      data-slide={index}
      onTouchStart={e => { pullY.current = e.touches[0].clientY }}
      onTouchEnd={e => {
        if (pullY.current === null) return
        const dy = e.changedTouches[0].clientY - pullY.current
        pullY.current = null
        if (slideRef.current && slideRef.current.scrollTop <= 0 && dy > 100) onClose()
      }}
      style={{
        flex: '0 0 100%', width: '100vw', minHeight: '100%',
        scrollSnapAlign: 'start', scrollSnapStop: 'always',
        overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'none',
        background: '#fff',
      }}
    >
      {/* Photo — big hero (close button inside to avoid extra space) */}
      <div style={{ position: 'relative', width: '100%', height: 'min(55vh, 420px)', overflow: 'hidden' }}>
        {/* Close button — fixed so it stays visible while scrolling */}
        <button onClick={onClose} style={{
          position: 'fixed', top: 14, right: 14, zIndex: 130,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(0,0,0,0.35)', border: 'none',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff',
        }}>
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="1" y1="1" x2="13" y2="13" />
            <line x1="13" y1="1" x2="1" y2="13" />
          </svg>
        </button>
        {dish.fotoUrl ? (
          <>
            <img src={dish.fotoUrl} alt={dish.nombre}
              onLoad={() => setImgLoaded(true)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s' }} />
            {!imgLoaded && <div className="skeleton-shimmer" style={{ position: 'absolute', inset: 0 }} />}
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', background: gradient, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 48, opacity: 0.5 }}>🍽</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '16px 20px 20px' }}>
        {/* Name + save */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 3 }}>
          <h2 style={{
            fontFamily: 'var(--font-feed-display), serif',
            fontSize: 24, fontWeight: 700, color: '#111', margin: 0, lineHeight: 1.2, flex: 1,
          }}>
            {dish.nombre}
            {dish.dieta.tipo === 'VEGAN' && <span style={{ marginLeft: 6, fontSize: 16 }}>🌱</span>}
            {dish.dieta.tipo === 'VEGETARIAN' && <span style={{ marginLeft: 6, fontSize: 16 }}>🥬</span>}
          </h2>
          <button onClick={() => { setSaved(!saved); onSave(dish) }} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexShrink: 0, marginTop: 2,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill={saved ? '#F4A623' : 'none'} stroke={saved ? '#F4A623' : 'rgba(0,0,0,0.25)'} strokeWidth="2" strokeLinecap="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>


        {/* Price */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          {dish.enOferta && dish.precioDescuento != null ? (
            <>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#4ade80' }}>${dish.precioDescuento.toLocaleString('es-CL')}</span>
              <span style={{ fontSize: 14, color: 'rgba(0,0,0,0.3)', textDecoration: 'line-through' }}>${dish.precio.toLocaleString('es-CL')}</span>
            </>
          ) : (
            <span style={{ fontSize: 20, fontWeight: 700, color: '#F4A623' }}>${dish.precio.toLocaleString('es-CL')}</span>
          )}
        </div>

        {/* Description */}
        {dish.descripcion && (
          <p style={{ fontSize: 17, color: 'rgba(0,0,0,0.7)', lineHeight: 1.6, margin: '0 0 16px' }}>
            {dish.descripcion}
          </p>
        )}

        {/* Restaurant — abre Google Maps al tocar */}
        <a href={
            dish.googleMapsUrl
              ? dish.googleMapsUrl
              : dish.restauranteLat && dish.restauranteLng
                ? `https://maps.google.com/?q=${dish.restauranteLat},${dish.restauranteLng}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((dish.restauranteDireccion ?? '') + ' ' + dish.restaurante)}`
          }
          target="_blank" rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
            padding: '14px 16px', borderRadius: 14, textAlign: 'left',
            background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.07)',
            textDecoration: 'none', marginBottom: 14, boxSizing: 'border-box',
          }}>
          {dish.restauranteLogo && !logoError ? (
            <img src={dish.restauranteLogo} alt="" onError={() => setLogoError(true)}
              style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(0,0,0,0.35)', fontSize: 16, fontWeight: 700 }}>
              {dish.restaurante.charAt(0)}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#111', margin: 0 }}>{dish.restaurante}</p>
            {dish.restauranteDireccion && <p style={{ fontSize: 14, color: 'rgba(0,0,0,0.55)', margin: '2px 0 0' }}>
              {(() => {
                const parts = dish.restauranteDireccion.split(',').map(p => p.trim().replace(/^\d{4,7}\s*/, '')).filter(p => p && !/^\d+$/.test(p) && p !== 'Chile' && p !== 'Región Metropolitana' && p !== 'Region Metropolitana').slice(0, 3)
                if (parts.length === 3) [parts[1], parts[2]] = [parts[2], parts[1]]
                return parts.join(', ')
              })()}
            </p>}
            {dist != null && (
              <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                A {formatDistance(dist)}
              </p>
            )}
            {dish.googleRating != null && (
              <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ color: '#F4A623', fontSize: 12 }}>★</span>
                <span style={{ fontWeight: 600, color: 'rgba(0,0,0,0.65)' }}>{dish.googleRating.toFixed(1)}</span>
                {dish.googleRatingCount != null && (
                  <span style={{ color: 'rgba(0,0,0,0.4)' }}>
                    ({dish.googleRatingCount >= 1000 ? `${(dish.googleRatingCount / 1000).toFixed(1)}k` : dish.googleRatingCount})
                  </span>
                )}
                <span style={{ color: 'rgba(0,0,0,0.3)', fontSize: 11 }}>en Google</span>
              </p>
            )}
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </a>

        {/* Ver carta completa */}
        <a href={`/c/${dish.restauranteSlug}`} target="_blank" rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', padding: '13px 16px', borderRadius: 14, boxSizing: 'border-box',
            background: '#F4A623', color: '#fff', textDecoration: 'none',
            fontSize: 15, fontWeight: 700, marginBottom: 14,
          }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path d="M9 12h6M9 16h4" />
          </svg>
          Ver carta completa
        </a>

        {/* Más platos del local — siempre visible */}
        {restDishes.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 14, color: 'rgba(0,0,0,0.4)', margin: '0 0 8px', fontWeight: 600 }}>Más de {dish.restaurante}</p>
            <div style={{ position: 'relative', overflow: 'hidden', marginRight: -20 }}>
              <div ref={restScrollRef} onScroll={e => { const el = e.currentTarget; setRestScrollEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8); setRestScrollStart(el.scrollLeft <= 0) }} style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingRight: 20 }}>
                {restDishes.map(d => (
                  <div key={d.id} onClick={() => onDishTap(d)} style={{
                    flexShrink: 0, width: 148, cursor: 'pointer', borderRadius: 12, overflow: 'hidden',
                    background: 'rgba(0,0,0,0.04)',
                  }}>
                    <img src={d.fotoUrl!} alt={d.nombre} style={{ width: 148, height: 104, objectFit: 'cover', display: 'block' }} />
                    <div style={{ padding: '5px 7px' }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#111', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre}</p>
                      <p style={{ fontSize: 11, color: '#F4A623', margin: '2px 0 0', fontWeight: 700 }}>${d.precio.toLocaleString('es-CL')}</p>
                    </div>
                  </div>
                ))}
              </div>
              {!restScrollStart && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, bottom: 0, width: 28, pointerEvents: 'none',
                  background: 'linear-gradient(to left, rgba(255,255,255,0) 0%, rgba(255,255,255,0.35) 60%, rgba(255,255,255,0.6) 100%)',
                }} />
              )}
              {!restScrollEnd && (
                <div style={{
                  position: 'absolute', top: 0, right: 0, bottom: 0, width: 28, pointerEvents: 'none',
                  background: 'linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,0.35) 60%, rgba(255,255,255,0.6) 100%)',
                }} />
              )}
            </div>
          </div>
        )}

        {/* Related dishes */}
        {!hideRelated && relatedDishes.length > 0 && (
          <div style={{ paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.07)' }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'rgba(0,0,0,0.4)', margin: '0 0 12px' }}>También te podría gustar</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {[0, 1].map(col => (
                <div key={col} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {relatedDishes.slice(0, visibleRelated).filter((_, i) => i % 2 === col).map(d => (
                    <DishCard key={d.id} dish={d} onTap={onDishTap} userLocation={userLocation} />
                  ))}
                </div>
              ))}
            </div>
            {visibleRelated < relatedDishes.length && (
              <div style={{ display: 'flex', gap: 10, paddingTop: 10 }}>
                {[0, 1].map(col => (
                  <div key={col} style={{ flex: 1 }}>
                    <div className="skeleton-shimmer" style={{ aspectRatio: '3/4', borderRadius: 14 }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

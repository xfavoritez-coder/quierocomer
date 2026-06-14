'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import type { FeedDish } from '../types'
import { getDisplayCategories } from '../lib/categories'
import { extractKeywords } from '../lib/keywords'
import { distanceKm, formatDistance } from '../lib/geo'
import MasonryGrid from '../components/MasonryGrid'
import DishModal from '../components/DishModal'
import SavedList from '../components/SavedList'
import ProfileView from '../components/ProfileView'
import { createEmptyProfile, getRecommendationReason, type FeedProfile } from '../lib/scoring'
import {
  trackInteraction,
  saveDish,
  unsaveDish,
  rateDish,
  updateTasteAction,
} from '../lib/feed-actions'

type View = 'feed' | 'guardados' | 'perfil'

export default function NewHome({
  dishes,
  categoryScores,
  keywordScores,
  totalInteractions,
  vectorScoredIds = [],
}: {
  dishes: FeedDish[]
  categoryScores: Record<string, number>
  keywordScores: Record<string, number>
  totalInteractions: number
  vectorScoredIds?: string[]
}) {
  const [view, setView] = useState<View>('feed')
  const [selectedDish, setSelectedDish] = useState<FeedDish | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationName, setLocationName] = useState<string | null>(null)
  const [locationOpen, setLocationOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [sessionLikedIds, setSessionLikedIds] = useState<Set<string>>(new Set())
  const [sessionDislikedIds, setSessionDislikedIds] = useState<Set<string>>(new Set())
  const [savedDishIds, setSavedDishIds] = useState<Set<string>>(new Set())
  const [visibleCount, setVisibleCount] = useState(20)
  const [showCategoryFade, setShowCategoryFade] = useState(true)
  const categoryScrollRef = useRef<HTMLDivElement>(null)

  // Profile for DishModal
  const profile = useMemo<FeedProfile>(() => {
    const base = createEmptyProfile()
    base.categoryScores = categoryScores
    base.keywordScores = keywordScores
    base.totalInteractions = totalInteractions
    return base
  }, [categoryScores, keywordScores, totalInteractions])

  // Geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        const nearest = dishes
          .filter(d => d.restauranteLat && d.restauranteLng)
          .map(d => ({ d, dist: distanceKm(loc.lat, loc.lng, d.restauranteLat!, d.restauranteLng!) }))
          .sort((a, b) => a.dist - b.dist)[0]
        if (nearest?.d.restauranteDireccion) {
          const commune = nearest.d.restauranteDireccion.split(',').slice(-2, -1)[0]?.trim()
          setLocationName(commune || 'Santiago')
        }
      }, () => {}, { enableHighAccuracy: false, timeout: 5000 })
    }
  }, [dishes])

  // Communes for location dropdown
  const communes = useMemo(() => {
    const set = new Set<string>()
    dishes.forEach(d => {
      if (d.restauranteDireccion) {
        const parts = d.restauranteDireccion.split(',')
        const commune = parts.length >= 2 ? parts[parts.length - 2].trim() : null
        if (commune && commune !== 'Chile') set.add(commune)
      }
    })
    return [...set].sort()
  }, [dishes])

  // Available categories
  const allCategories = useMemo(() => getDisplayCategories(), [])
  const categories = useMemo(() => {
    const available = new Set(dishes.map(d => d.categoriaNorm))
    return allCategories.filter(c => available.has(c.norm))
  }, [dishes, allCategories])

  // Feed dishes — pgvector when available, fallback to keyword scoring
  const feedDishes = useMemo(() => {
    let filtered = dishes.filter(d => d.fotoUrl)

    // Category filter
    if (activeCategory) {
      filtered = filtered.filter(d => d.categoriaNorm === activeCategory)
    }

    // Remove disliked
    filtered = filtered.filter(d => !sessionDislikedIds.has(d.id))

    // ── pgvector path: use server-scored order ──
    if (vectorScoredIds.length > 0 && !activeCategory) {
      const dishMap = new Map(filtered.map(d => [d.id, d]))
      // Start with pgvector order (taste similarity from DB)
      const vectorOrdered: FeedDish[] = []
      for (const id of vectorScoredIds) {
        const d = dishMap.get(id)
        if (d) { vectorOrdered.push(d); dishMap.delete(id) }
      }
      // Append remaining dishes not in vector results (discovery)
      const remaining = [...dishMap.values()].sort(() => Math.random() - 0.5)
      const combined = [...vectorOrdered, ...remaining]

      // Boost session likes to top
      const boosted: FeedDish[] = []
      const rest: FeedDish[] = []
      for (const d of combined) {
        if (sessionLikedIds.has(d.id)) boosted.push(d)
        else rest.push(d)
      }

      // Max 3 consecutive same category
      const source = [...boosted, ...rest]
      const final: FeedDish[] = []
      const rem = [...source]
      while (rem.length > 0) {
        const recent = final.slice(-3).map(d => d.categoriaNorm)
        const allSame = recent.length === 3 && recent.every(c => c === recent[0])
        if (allSame) {
          const diffIdx = rem.findIndex(d => d.categoriaNorm !== recent[0])
          if (diffIdx >= 0) { final.push(rem.splice(diffIdx, 1)[0]); continue }
        }
        final.push(rem.shift()!)
      }
      return final
    }

    // ── Fallback: keyword scoring (cold start or category filter) ──
    const mergedKw: Record<string, number> = { ...keywordScores }
    for (const d of dishes) {
      const kws = extractKeywords(d.nombre, d.descripcion)
      if (sessionLikedIds.has(d.id)) for (const kw of kws) mergedKw[kw] = (mergedKw[kw] ?? 0) + 8
      if (sessionDislikedIds.has(d.id)) for (const kw of kws) mergedKw[kw] = (mergedKw[kw] ?? 0) - 12
    }

    const scored = filtered.map(d => {
      let score = 0
      score += Math.min((categoryScores[d.categoriaNorm] ?? 0) * 0.2, 8)
      const kws = extractKeywords(d.nombre, d.descripcion)
      let kwTotal = 0
      for (const kw of kws) kwTotal += (mergedKw[kw] ?? 0)
      score += Math.min(kwTotal, 10)
      return { dish: d, score }
    })

    scored.sort((a, b) => b.score - a.score)

    // 70/15/15 mix
    const total = scored.length
    const scoredCount = Math.ceil(total * 0.7)
    const popularCount = Math.ceil(total * 0.15)
    const topScored = scored.slice(0, scoredCount)
    const topIds = new Set(topScored.map(s => s.dish.id))
    const popular = scored.filter(s => !topIds.has(s.dish.id)).sort((a, b) => b.dish.popularityScore - a.dish.popularityScore).slice(0, popularCount)
    const usedIds = new Set([...topIds, ...popular.map(p => p.dish.id)])
    const discovery = scored.filter(s => !usedIds.has(s.dish.id)).sort(() => Math.random() - 0.5)

    const result: FeedDish[] = []
    let sI = 0, pI = 0, dI = 0
    for (let i = 0; i < total; i++) {
      if (i % 7 === 5 && pI < popular.length) result.push(popular[pI++].dish)
      else if (i % 7 === 6 && dI < discovery.length) result.push(discovery[dI++].dish)
      else if (sI < topScored.length) result.push(topScored[sI++].dish)
      else if (pI < popular.length) result.push(popular[pI++].dish)
      else if (dI < discovery.length) result.push(discovery[dI++].dish)
    }

    // Max 3 consecutive same category
    const final: FeedDish[] = []
    const rem = [...result]
    while (rem.length > 0) {
      const recent = final.slice(-3).map(d => d.categoriaNorm)
      const allSame = recent.length === 3 && recent.every(c => c === recent[0])
      if (allSame) {
        const diffIdx = rem.findIndex(d => d.categoriaNorm !== recent[0])
        if (diffIdx >= 0) { final.push(rem.splice(diffIdx, 1)[0]); continue }
      }
      final.push(rem.shift()!)
    }
    return final
  }, [dishes, activeCategory, categoryScores, keywordScores, sessionLikedIds, sessionDislikedIds, vectorScoredIds])

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 800 && visibleCount < feedDishes.length) {
        setVisibleCount(prev => Math.min(prev + 20, feedDishes.length))
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [visibleCount, feedDishes.length])

  // Reset visible count on category change
  useEffect(() => { setVisibleCount(20) }, [activeCategory])

  // Handlers
  const handleLike = useCallback((dish: FeedDish) => {
    setSessionLikedIds(prev => new Set([...prev, dish.id]))
    setSessionDislikedIds(prev => { const n = new Set(prev); n.delete(dish.id); return n })
    trackInteraction(dish.id, 'LIKE', dish.categoriaNorm, dish.precioDescuento ?? dish.precio).catch(() => {})
    updateTasteAction(dish.id, 'LIKE').catch(() => {})
  }, [])

  const handleDislike = useCallback((dish: FeedDish) => {
    setSessionDislikedIds(prev => new Set([...prev, dish.id]))
    setSessionLikedIds(prev => { const n = new Set(prev); n.delete(dish.id); return n })
    trackInteraction(dish.id, 'PASS', dish.categoriaNorm, dish.precioDescuento ?? dish.precio).catch(() => {})
    updateTasteAction(dish.id, 'DISLIKE').catch(() => {})
  }, [])

  const handleUndo = useCallback((dish: FeedDish) => {
    setSessionDislikedIds(prev => { const n = new Set(prev); n.delete(dish.id); return n })
    setSessionLikedIds(prev => { const n = new Set(prev); n.delete(dish.id); return n })
    updateTasteAction(dish.id, 'UNDO').catch(() => {})
  }, [])

  const handleDishTap = useCallback((d: FeedDish) => {
    setSelectedDish(d)
    trackInteraction(d.id, 'TAP', d.categoriaNorm, d.precioDescuento ?? d.precio).catch(() => {})
  }, [])

  const handleDishSave = useCallback((dish: FeedDish) => {
    setSavedDishIds(prev => new Set([...prev, dish.id]))
    saveDish(dish.id, 'SAVED').catch(() => {})
    updateTasteAction(dish.id, 'FAVORITE').catch(() => {})
  }, [])

  const handleDishRate = useCallback((dish: FeedDish, stars: number) => {
    rateDish(dish.id, stars).catch(() => {})
  }, [])

  const handleRemoveSaved = useCallback((dishId: string) => {
    setSavedDishIds(prev => { const n = new Set(prev); n.delete(dishId); return n })
    setSessionLikedIds(prev => { const n = new Set(prev); n.delete(dishId); return n })
    unsaveDish(dishId).catch(() => {})
  }, [])

  // Dishes for guardados view
  const likedDishes = useMemo(() =>
    [...sessionLikedIds].map(id => dishes.find(d => d.id === id)).filter(Boolean) as FeedDish[],
    [sessionLikedIds, dishes]
  )
  const savedDishes = useMemo(() =>
    [...savedDishIds].map(id => dishes.find(d => d.id === id)).filter(Boolean) as FeedDish[],
    [savedDishIds, dishes]
  )

  // Category scroll fade
  const handleCategoryScroll = useCallback(() => {
    const el = categoryScrollRef.current
    if (!el) return
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 20
    setShowCategoryFade(!atEnd)
  }, [])

  const selectedReason = selectedDish ? getRecommendationReason(selectedDish, profile) : null

  const hour = new Date().getHours()
  const greeting = hour >= 5 && hour < 12 ? 'desayunar' : hour >= 12 && hour < 18 ? 'almorzar' : 'cenar'

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh' }}>

      {/* ─── Header: logo centered + hamburger ─── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(14,14,14,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '14px 16px', display: 'flex', alignItems: 'center',
      }}>
        <div style={{ width: 36 }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{
            fontFamily: 'var(--font-feed-display), serif',
            fontSize: 19, fontWeight: 700, color: '#fff',
          }}>
            Quiero<span style={{ color: '#F4A623' }}>Comer</span>
          </span>
        </div>
        <button onClick={() => setMenuOpen(true)} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 6,
          color: 'rgba(255,255,255,0.5)', width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </header>

      {/* ─── Hamburger menu ─── */}
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{
            position: 'fixed', inset: 0, zIndex: 55,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 56,
            width: 280, maxWidth: '80vw',
            background: '#141414', borderLeft: '1px solid rgba(255,255,255,0.06)',
            padding: '0 20px 40px', display: 'flex', flexDirection: 'column',
            animation: 'slideRight 0.2s ease-out', overflow: 'hidden',
          }}>
            {/* Logo watermark */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              fontFamily: 'var(--font-feed-display), serif',
              fontSize: 60, fontWeight: 700, color: 'rgba(255,255,255,0.02)',
              whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none',
            }}>
              QC
            </div>

            {/* Close */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 0' }}>
              <button onClick={() => setMenuOpen(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4,
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Logo in menu */}
            <div style={{
              textAlign: 'center', marginBottom: 24, paddingBottom: 16,
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <span style={{
                fontFamily: 'var(--font-feed-display), serif',
                fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.15)',
              }}>
                Quiero<span style={{ color: 'rgba(244,166,35,0.2)' }}>Comer</span>
              </span>
            </div>

            {/* Menu items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative', zIndex: 1 }}>
              {[
                { label: '🏠 Inicio', action: () => { setMenuOpen(false); setView('feed'); window.scrollTo(0, 0) } },
                { label: '🔍 Buscar', href: '/a/search' },
                { label: '💛 Favoritos', action: () => { setMenuOpen(false); setView('guardados'); window.scrollTo(0, 0) } },
                { label: '👤 Mi perfil', action: () => { setMenuOpen(false); setView('perfil'); window.scrollTo(0, 0) } },
              ].map((item, i) => (
                item.href ? (
                  <a key={i} href={item.href} style={{
                    display: 'block', padding: '14px 16px', borderRadius: 12, fontSize: 15, fontWeight: 500,
                    color: '#fff', textDecoration: 'none', background: 'rgba(255,255,255,0.03)',
                  }}>
                    {item.label}
                  </a>
                ) : (
                  <button key={i} onClick={item.action} style={{
                    display: 'block', width: '100%', padding: '14px 16px', borderRadius: 12, fontSize: 15, fontWeight: 500,
                    color: '#fff', background: 'rgba(255,255,255,0.03)', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}>
                    {item.label}
                  </button>
                )
              ))}
            </div>
          </div>
        </>
      )}

      {/* ─── Feed View ─── */}
      {view === 'feed' && (
        <>
          {/* Greeting + location */}
          <div style={{
            padding: '14px 20px 0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          }}>
            <h2 style={{
              fontFamily: 'var(--font-feed-display), serif',
              fontSize: 20, fontWeight: 700, color: '#fff', margin: 0,
            }}>
              ¿Qué se te antoja?
            </h2>

            {/* Location button */}
            <button onClick={() => {
              if (!userLocation) {
                navigator.geolocation.getCurrentPosition(pos => {
                  const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
                  setUserLocation(loc)
                  const nearest = dishes
                    .filter(d => d.restauranteLat && d.restauranteLng)
                    .map(d => ({ d, dist: distanceKm(loc.lat, loc.lng, d.restauranteLat!, d.restauranteLng!) }))
                    .sort((a, b) => a.dist - b.dist)[0]
                  if (nearest?.d.restauranteDireccion) {
                    setLocationName(nearest.d.restauranteDireccion.split(',').slice(-2, -1)[0]?.trim() || 'Santiago')
                  }
                }, () => {}, { enableHighAccuracy: false, timeout: 5000 })
              } else {
                setLocationOpen(!locationOpen)
              }
            }} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 12px', borderRadius: 20,
              background: locationName ? 'rgba(244,166,35,0.08)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${locationName ? 'rgba(244,166,35,0.15)' : 'rgba(255,255,255,0.08)'}`,
              cursor: 'pointer', flexShrink: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={locationName ? '#F4A623' : 'rgba(255,255,255,0.4)'} strokeWidth="2" strokeLinecap="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span style={{
                fontSize: 12, fontWeight: 500, maxWidth: 100,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: locationName ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.35)',
              }}>
                {locationName || 'Ubicación'}
              </span>
              {locationName && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round"
                  style={{ transform: locationOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              )}
            </button>
          </div>

          {/* Location dropdown */}
          {locationOpen && (
            <>
              <div onClick={() => setLocationOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 44 }} />
              <div style={{
                position: 'absolute', top: 110, right: 20, zIndex: 45,
                background: 'rgba(20,20,20,0.97)', backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14,
                padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                maxHeight: 280, overflowY: 'auto', minWidth: 200,
              }}>
                <button onClick={() => {
                  setLocationOpen(false)
                  navigator.geolocation.getCurrentPosition(pos => {
                    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
                    setUserLocation(loc)
                    const nearest = dishes
                      .filter(d => d.restauranteLat && d.restauranteLng)
                      .map(d => ({ d, dist: distanceKm(loc.lat, loc.lng, d.restauranteLat!, d.restauranteLng!) }))
                      .sort((a, b) => a.dist - b.dist)[0]
                    if (nearest?.d.restauranteDireccion) {
                      setLocationName(nearest.d.restauranteDireccion.split(',').slice(-2, -1)[0]?.trim() || 'Santiago')
                    }
                  }, () => {}, { enableHighAccuracy: false, timeout: 5000 })
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '10px 14px', borderRadius: 10, background: 'rgba(244,166,35,0.08)',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  fontSize: 13, fontWeight: 600, color: '#F4A623', marginBottom: 4,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F4A623" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
                  </svg>
                  Usar mi ubicación
                </button>
                {communes.map(commune => (
                  <button key={commune} onClick={() => {
                    setLocationName(commune)
                    setUserLocation(null)
                    setLocationOpen(false)
                  }} style={{
                    display: 'block', width: '100%', padding: '10px 14px', borderRadius: 10,
                    background: locationName === commune ? 'rgba(244,166,35,0.1)' : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontSize: 13, fontWeight: locationName === commune ? 600 : 400,
                    color: locationName === commune ? '#F4A623' : '#fff',
                  }}>
                    {commune}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ─── Categories — sticky ─── */}
          <div style={{
            position: 'sticky', top: 55, zIndex: 35,
            background: 'rgba(14,14,14,0.95)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            padding: '12px 0 8px',
          }}>
            <div style={{ position: 'relative' }}>
              <div
                ref={categoryScrollRef}
                onScroll={handleCategoryScroll}
                style={{
                  display: 'flex', gap: 16, overflowX: 'auto', padding: '0 20px 4px',
                  scrollbarWidth: 'none', msOverflowStyle: 'none',
                }}
              >
                <CategoryCircle icon="🔥" label="Todo" active={!activeCategory}
                  onClick={() => setActiveCategory(null)} />
                {categories.map(cat => (
                  <CategoryCircle
                    key={cat.norm}
                    icon={cat.icon}
                    label={cat.label}
                    active={activeCategory === cat.norm}
                    onClick={() => setActiveCategory(activeCategory === cat.norm ? null : cat.norm)}
                  />
                ))}
              </div>
              {showCategoryFade && (
                <div style={{
                  position: 'absolute', top: 0, right: 0, bottom: 4, width: 50,
                  background: 'linear-gradient(to left, rgba(14,14,14,0.95), transparent)',
                  pointerEvents: 'none',
                }} />
              )}
            </div>
          </div>

          {/* Feed info */}
          <div style={{ padding: '4px 20px 8px', color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
            {feedDishes.length} platos
            {activeCategory && ` en ${categories.find(c => c.norm === activeCategory)?.label || activeCategory}`}
          </div>

          {/* Feed masonry */}
          {feedDishes.length > 0 ? (
            <MasonryGrid
              dishes={feedDishes.slice(0, visibleCount)}
              onDishTap={handleDishTap}
              onDishLike={handleLike}
              onDishDislike={handleDislike}
              onDishUndo={handleUndo}
              userLocation={userLocation}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
              No hay platos en esta categoría
            </div>
          )}
        </>
      )}

      {/* ─── Guardados View ─── */}
      {view === 'guardados' && (
        <>
          <div style={{ padding: '16px 20px 8px' }}>
            <button onClick={() => setView('feed')} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)',
              display: 'flex', alignItems: 'center', gap: 6, padding: 0, fontSize: 13,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Volver
            </button>
          </div>
          <SavedList
            antojos={likedDishes}
            saved={savedDishes}
            onDishTap={handleDishTap}
            onRemove={handleRemoveSaved}
          />
        </>
      )}

      {/* ─── Perfil View ─── */}
      {view === 'perfil' && (
        <>
          <div style={{ padding: '16px 20px 8px' }}>
            <button onClick={() => setView('feed')} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)',
              display: 'flex', alignItems: 'center', gap: 6, padding: 0, fontSize: 13,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Volver
            </button>
          </div>
          <ProfileView
            profile={profile}
            diet={{ isVegan: false, isVegetarian: false, isGlutenFree: false, isLactoseFree: false }}
            dishes={dishes}
            onReset={() => {}}
            onUpdateDiet={() => {}}
          />
        </>
      )}

      {/* ─── DishModal ─── */}
      {selectedDish && (
        <DishModal
          key={selectedDish.id}
          dish={selectedDish}
          allDishes={dishes}
          profile={profile}
          reason={selectedReason}
          onClose={() => setSelectedDish(null)}
          onLike={handleLike}
          onSave={handleDishSave}
          onPass={handleDislike}
          onRate={handleDishRate}
          onDishTap={handleDishTap}
        />
      )}

      {/* ─── Floating buttons (bigger) ─── */}
      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 50, display: 'flex', gap: 12, pointerEvents: 'none',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        <button onClick={() => { setView('feed'); window.scrollTo({ top: 0, behavior: 'smooth' }) }} title="Inicio" style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'rgba(20,20,20,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', pointerEvents: 'auto', color: 'rgba(255,255,255,0.7)',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </button>
        <a href="/a/search" style={{
          width: 52, height: 52, borderRadius: '50%',
          background: 'rgba(20,20,20,0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', pointerEvents: 'auto', color: 'rgba(255,255,255,0.7)',
          textDecoration: 'none',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </a>
      </div>
    </div>
  )
}

function CategoryCircle({ icon, label, active, onClick }: {
  icon: string; label: string; active?: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
      WebkitTapHighlightColor: 'transparent',
    }}>
      <div style={{
        width: 60, height: 60, borderRadius: '50%',
        background: active ? 'rgba(244,166,35,0.15)' : 'rgba(255,255,255,0.05)',
        border: active ? '2px solid #F4A623' : '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, transition: 'all 0.2s',
      }}>
        {icon}
      </div>
      <span style={{
        fontSize: 11, fontWeight: active ? 600 : 500,
        color: active ? '#F4A623' : 'rgba(255,255,255,0.45)',
        maxWidth: 64, textAlign: 'center',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    </button>
  )
}

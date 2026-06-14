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
  tasteData,
  userDiet,
}: {
  dishes: FeedDish[]
  categoryScores: Record<string, number>
  keywordScores: Record<string, number>
  totalInteractions: number
  vectorScoredIds?: string[]
  tasteData?: { antojoSessionDate: string | null; antojoDishIds: string[]; antojoRejectIds: string[]; tasteEmbeddingsCount: number; hasGustoVector: boolean }
  userDiet?: { isVegan: boolean; isVegetarian: boolean; isGlutenFree: boolean; isLactoseFree: boolean }
}) {
  const [view, setView] = useState<View>('feed')
  const [activeDiet, setActiveDiet] = useState(userDiet)
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
  const [locationQuery, setLocationQuery] = useState('')
  const categoryScrollRef = useRef<HTMLDivElement>(null)

  // Profile for DishModal — refreshable
  const [liveProfile, setLiveProfile] = useState<FeedProfile | null>(null)
  const [liveTasteData, setLiveTasteData] = useState(tasteData)
  const profile = useMemo<FeedProfile>(() => {
    if (liveProfile) return liveProfile
    const base = createEmptyProfile()
    base.categoryScores = categoryScores
    base.keywordScores = keywordScores
    base.totalInteractions = totalInteractions
    return base
  }, [categoryScores, keywordScores, totalInteractions, liveProfile])

  // Refresh profile data when entering profile view
  useEffect(() => {
    if (view !== 'perfil') return
    import('../lib/feed-actions').then(({ getProfileData }) =>
      getProfileData().then(data => {
        if (!data) return
        const p = createEmptyProfile()
        p.categoryScores = data.categoryScores
        p.keywordScores = data.keywordScores
        p.totalInteractions = data.totalInteractions
        setLiveProfile(p)
        setLiveTasteData(data.tasteData)
        setActiveDiet(data.diet)
      })
    ).catch(() => {})
  }, [view])

  // Geolocation — IP fallback + GPS upgrade
  const [gpsLabel, setGpsLabel] = useState<string | null>(null)

  // Step 1: IP-based city detection (no permission needed) — sets locationName to filter feed
  useEffect(() => {
    if (locationName || userLocation) return // already have location
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(data => {
        if (data.city) {
          setLocationName(data.city)
        }
      })
      .catch(() => {})
  }, [])

  // Step 2: GPS upgrade (if permission already granted, silently upgrade)
  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        if (result.state === 'granted') {
          // Permission already granted — get precise location silently
          navigator.geolocation.getCurrentPosition(pos => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
            setUserLocation(loc)
            const nearest = dishes
              .filter(d => d.restauranteLat && d.restauranteLng)
              .map(d => ({ d, dist: distanceKm(loc.lat, loc.lng, d.restauranteLat!, d.restauranteLng!) }))
              .sort((a, b) => a.dist - b.dist)[0]
            if (nearest?.d.restauranteDireccion) {
              const parts = nearest.d.restauranteDireccion.split(',').map(p => p.trim())
                .filter(p => p && p !== 'Chile' && p !== 'Región Metropolitana' && !p.match(/^\d/) && !p.match(/^Av\.?\s/i))
              const commune = parts.length >= 2 ? parts[parts.length - 2] : parts[parts.length - 1]
              setGpsLabel(commune || 'Cerca de ti')
            }
          }, () => {}, { enableHighAccuracy: false, timeout: 5000 })
        }
        // If not granted, don't ask — IP label is enough
      }).catch(() => {})
    } else {
      // No permissions API — try GPS directly (will prompt user)
      navigator.geolocation?.getCurrentPosition(pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        const nearest = dishes
          .filter(d => d.restauranteLat && d.restauranteLng)
          .map(d => ({ d, dist: distanceKm(loc.lat, loc.lng, d.restauranteLat!, d.restauranteLng!) }))
          .sort((a, b) => a.dist - b.dist)[0]
        if (nearest?.d.restauranteDireccion) {
          const parts = nearest.d.restauranteDireccion.split(',').map(p => p.trim())
            .filter(p => p && p !== 'Chile' && p !== 'Región Metropolitana' && !p.match(/^\d/) && !p.match(/^Av\.?\s/i))
          const commune = parts.length >= 2 ? parts[parts.length - 2] : parts[parts.length - 1]
          setGpsLabel(commune || 'Cerca de ti')
        } else {
          setGpsLabel('Cerca de ti')
        }
      }, () => {}, { enableHighAccuracy: false, timeout: 5000 })
    }
  }, [dishes])

  // Communes for location dropdown
  const communes = useMemo(() => {
    const set = new Set<string>()
    dishes.forEach(d => {
      if (d.restauranteDireccion) {
        const parts = d.restauranteDireccion.split(',').map(p => p.trim()).filter(p => p && p !== 'Chile' && p !== 'Región Metropolitana')
        // Add commune (second-to-last) and city (last) if they look like place names
        for (let i = Math.max(0, parts.length - 2); i < parts.length; i++) {
          const p = parts[i]
          if (p && p.length > 2 && !p.match(/^\d/) && !p.match(/^Av\.?\s|^Calle\s/i)) set.add(p)
        }
      }
    })
    return [...set].sort()
  }, [dishes])

  // Filtered communes for search
  const filteredCommunes = useMemo(() => {
    if (!locationQuery.trim()) return communes
    const q = locationQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return communes.filter(c => c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q))
  }, [communes, locationQuery])

  // Available categories
  const allCategories = useMemo(() => getDisplayCategories(), [])
  const categories = useMemo(() => {
    const available = new Set(dishes.map(d => d.categoriaNorm))
    return allCategories.filter(c => available.has(c.norm))
  }, [dishes, allCategories])

  // Feed dishes — pgvector when available, fallback to keyword scoring
  const feedDishes = useMemo(() => {
    let filtered = dishes.filter(d => d.fotoUrl)

    // Diet filter
    if (activeDiet?.isVegan) {
      filtered = filtered.filter(d => d.dieta.tipo === 'VEGAN')
    } else if (activeDiet?.isVegetarian) {
      filtered = filtered.filter(d => d.dieta.tipo === 'VEGAN' || d.dieta.tipo === 'VEGETARIAN')
    }
    if (activeDiet?.isGlutenFree) {
      filtered = filtered.filter(d => d.dieta.sinGluten)
    }

    // Location filter
    if (locationName) {
      // Filter by commune/city name in address
      const locNorm = locationName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const inCommune = filtered.filter(d => {
        if (!d.restauranteDireccion) return false
        const addr = d.restauranteDireccion.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        return addr.includes(locNorm)
      })
      if (inCommune.length > 0) filtered = inCommune
    }
    // GPS: filter to <3km, sort by distance. Show only truly nearby restaurants.
    if (userLocation && !locationName) {
      const withDist = filtered
        .filter(d => d.restauranteLat && d.restauranteLng)
        .map(d => ({
          dish: d,
          dist: distanceKm(userLocation.lat, userLocation.lng, d.restauranteLat!, d.restauranteLng!)
        }))
        .sort((a, b) => a.dist - b.dist)
      const nearby = withDist.filter(x => x.dist < 3)
      if (nearby.length >= 5) {
        filtered = nearby.map(x => x.dish)
      } else {
        // Not enough nearby, show closest 30
        filtered = withDist.slice(0, 30).map(x => x.dish)
      }
    }

    // Category filter
    if (activeCategory) {
      filtered = filtered.filter(d => d.categoriaNorm === activeCategory)
    }

    // Remove disliked
    filtered = filtered.filter(d => !sessionDislikedIds.has(d.id))

    // ── pgvector path: use server-scored order + session boosts ──
    if (vectorScoredIds.length > 0 && !activeCategory) {
      // Build session category preferences
      const likedCats = new Set<string>()
      const likedTypes = new Set<string>()
      const dislikedCats: Record<string, number> = {}
      const dislikedTypes: Record<string, number> = {}
      for (const d of filtered) {
        if (sessionLikedIds.has(d.id)) { likedCats.add(d.categoriaNorm); likedTypes.add(d.categoriaTipo) }
      }
      for (const d of dishes) {
        if (sessionDislikedIds.has(d.id)) {
          dislikedCats[d.categoriaNorm] = (dislikedCats[d.categoriaNorm] ?? 0) + 1
          dislikedTypes[d.categoriaTipo] = (dislikedTypes[d.categoriaTipo] ?? 0) + 1
        }
      }

      const dishMap = new Map(filtered.map(d => [d.id, d]))
      const vectorOrdered: FeedDish[] = []
      for (const id of vectorScoredIds) {
        const d = dishMap.get(id)
        if (d) { vectorOrdered.push(d); dishMap.delete(id) }
      }
      const remaining = [...dishMap.values()].sort(() => Math.random() - 0.5)
      const combined = [...vectorOrdered, ...remaining]

      // Reorder: boost liked categories, penalize disliked ones
      const boosted: FeedDish[] = []
      const similar: FeedDish[] = []
      const rest: FeedDish[] = []
      const penalized: FeedDish[] = []
      for (const d of combined) {
        if (sessionLikedIds.has(d.id)) boosted.push(d)
        else if ((dislikedCats[d.categoriaNorm] ?? 0) >= 2 || (dislikedTypes[d.categoriaTipo] ?? 0) >= 3) penalized.push(d)
        else if (likedCats.has(d.categoriaNorm) || likedTypes.has(d.categoriaTipo)) similar.push(d)
        else rest.push(d)
      }
      // Similar first, then rest, penalized at the bottom
      const reordered = [...boosted]
      let sIdx = 0, rIdx = 0
      while (sIdx < similar.length || rIdx < rest.length) {
        if (sIdx < similar.length) reordered.push(similar[sIdx++])
        if (sIdx < similar.length) reordered.push(similar[sIdx++])
        if (rIdx < rest.length) reordered.push(rest[rIdx++])
      }
      reordered.push(...penalized)

      // Max 3 consecutive same category
      const final: FeedDish[] = []
      const rem = [...reordered]
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
    // Build session-boosted keyword and category scores
    const mergedKw: Record<string, number> = { ...keywordScores }
    const sessionCatBoost: Record<string, number> = {}
    for (const d of dishes) {
      if (sessionLikedIds.has(d.id)) {
        const kws = extractKeywords(d.nombre, d.descripcion)
        for (const kw of kws) mergedKw[kw] = (mergedKw[kw] ?? 0) + 8
        // Boost category aggressively for session likes
        sessionCatBoost[d.categoriaNorm] = (sessionCatBoost[d.categoriaNorm] ?? 0) + 15
        // Also boost same dishType (food/dessert/drink)
        if (d.categoriaTipo) sessionCatBoost[`_type_${d.categoriaTipo}`] = (sessionCatBoost[`_type_${d.categoriaTipo}`] ?? 0) + 10
      }
      if (sessionDislikedIds.has(d.id)) {
        const kws = extractKeywords(d.nombre, d.descripcion)
        for (const kw of kws) mergedKw[kw] = (mergedKw[kw] ?? 0) - 15
        // Penalize category hard — 2+ dislikes in same category = strong signal
        sessionCatBoost[d.categoriaNorm] = (sessionCatBoost[d.categoriaNorm] ?? 0) - 20
        // Also penalize dishType (e.g., reject drinks → all drinks drop)
        if (d.categoriaTipo) sessionCatBoost[`_type_${d.categoriaTipo}`] = (sessionCatBoost[`_type_${d.categoriaTipo}`] ?? 0) - 12
      }
    }

    const scored = filtered.map(d => {
      let score = 0
      // DB category score
      score += Math.min((categoryScores[d.categoriaNorm] ?? 0) * 0.2, 8)
      // Session category boost (much stronger, immediate effect)
      score += (sessionCatBoost[d.categoriaNorm] ?? 0)
      // Session dishType boost (e.g., like a dessert → all desserts rise)
      score += (sessionCatBoost[`_type_${d.categoriaTipo}`] ?? 0) * 0.5
      // Keywords
      const kws = extractKeywords(d.nombre, d.descripcion)
      let kwTotal = 0
      for (const kw of kws) kwTotal += (mergedKw[kw] ?? 0)
      score += Math.min(kwTotal, 15)
      return { dish: d, score }
    })

    scored.sort((a, b) => b.score - a.score)

    const hasSessionPreference = sessionLikedIds.size > 0 || sessionDislikedIds.size > 0

    let result: FeedDish[]

    if (hasSessionPreference) {
      // User has expressed preferences this session → respect score order directly
      // Just add a small discovery element every 10th dish
      const byScore = scored.map(s => s.dish)
      result = []
      const discoveryPool = byScore.filter(d => d.popularityScore <= 1).sort(() => Math.random() - 0.5)
      let dIdx = 0
      for (let i = 0; i < byScore.length; i++) {
        result.push(byScore[i])
        if (i > 0 && i % 10 === 0 && dIdx < discoveryPool.length) {
          result.push(discoveryPool[dIdx++])
        }
      }
    } else {
      // No session preference → classic 70/15/15 mix
      const total = scored.length
      const scoredCount = Math.ceil(total * 0.7)
      const popularCount = Math.ceil(total * 0.15)
      const topScored = scored.slice(0, scoredCount)
      const topIds = new Set(topScored.map(s => s.dish.id))
      const popular = scored.filter(s => !topIds.has(s.dish.id)).sort((a, b) => b.dish.popularityScore - a.dish.popularityScore).slice(0, popularCount)
      const usedIds = new Set([...topIds, ...popular.map(p => p.dish.id)])
      const discovery = scored.filter(s => !usedIds.has(s.dish.id)).sort(() => Math.random() - 0.5)

      result = []
      let sI = 0, pI = 0, dI = 0
      for (let i = 0; i < total; i++) {
        if (i % 7 === 5 && pI < popular.length) result.push(popular[pI++].dish)
        else if (i % 7 === 6 && dI < discovery.length) result.push(discovery[dI++].dish)
        else if (sI < topScored.length) result.push(topScored[sI++].dish)
        else if (pI < popular.length) result.push(popular[pI++].dish)
        else if (dI < discovery.length) result.push(discovery[dI++].dish)
      }
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
  }, [dishes, activeCategory, categoryScores, keywordScores, sessionLikedIds, sessionDislikedIds, vectorScoredIds, locationName, userLocation, activeDiet])

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
        background: '#0e0e0e',
        padding: '10px 16px', display: 'flex', alignItems: 'center',
      }}>
        <div style={{ width: 36 }} />
        <a href="/a" style={{ flex: 1, textAlign: 'center', textDecoration: 'none', cursor: 'pointer' }}>
          <span style={{
            fontFamily: 'var(--font-feed-display), serif',
            fontSize: 20, fontWeight: 700, color: '#fff',
          }}>
            Quiero<span style={{ color: '#F4A623' }}>Comer</span>
          </span>
        </a>
        <button onClick={() => setMenuOpen(true)} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 6,
          color: 'rgba(255,255,255,0.5)', width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </header>
      <div style={{ height: 1, background: '#222' }} />

      {/* ─── Hamburger menu — slide from right ─── */}
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{
            position: 'fixed', inset: 0, zIndex: 55,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 56,
            width: 300, maxWidth: '85vw',
            background: '#111',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            animation: 'slideRight 0.25s ease-out',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{
                fontFamily: 'var(--font-feed-display), Georgia, serif',
                fontSize: 22, fontWeight: 700, letterSpacing: -0.5, color: '#fff',
              }}>
                Quiero<span style={{ color: '#F4A623' }}>Comer</span>
              </div>
              <button onClick={() => setMenuOpen(false)} style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)', border: 'none',
                cursor: 'pointer', color: 'rgba(255,255,255,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { label: 'Inicio', color: '#F4A623', active: view === 'feed',
                  icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>,
                  action: () => { setMenuOpen(false); setView('feed'); window.scrollTo(0, 0) } },
                { label: 'Favoritos', color: '#F4A623',
                  icon: <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.8 8.2 2.7 4.5 6.4 4.5c2 0 3.5 1 4.3 2.3.8-1.3 2.3-2.3 4.3-2.3 3.7 0 5.6 3.7 4 7.3C19.5 16.4 12 21 12 21z" /></svg>,
                  action: () => { setMenuOpen(false); setView('guardados'); window.scrollTo(0, 0) } },
                { label: 'Mi perfil', color: '#855bd8',
                  icon: <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c.7-4.2 3.8-7 8-7s7.3 2.8 8 7H4z" /></svg>,
                  action: () => { setMenuOpen(false); setView('perfil'); window.scrollTo(0, 0) } },
              ].map((item, i) => {
                const s: React.CSSProperties = {
                  position: 'relative', display: 'flex', alignItems: 'center', gap: 16,
                  padding: '14px 16px', borderRadius: 14,
                  color: '#fff', textDecoration: 'none',
                  fontSize: 17, fontWeight: 600,
                  background: item.active ? 'rgba(244,166,35,0.08)' : 'transparent',
                  border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'background 0.15s',
                }
                const inner = (
                  <>
                    {item.active && (
                      <div style={{
                        position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                        width: 3, height: 24, borderRadius: 999,
                        background: '#F4A623', boxShadow: '0 0 12px rgba(245,164,0,0.4)',
                      }} />
                    )}
                    <span style={{ color: item.color, display: 'flex', flexShrink: 0 }}>{item.icon}</span>
                    {item.label}
                  </>
                )
                return (
                  <button key={i} onClick={item.action} style={s}>{inner}</button>
                )
              })}

            </nav>

            {/* Footer */}
            <div style={{
              padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.06)',
              textAlign: 'center',
            }}>
              <span style={{
                fontFamily: 'var(--font-feed-display), Georgia, serif',
                fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.1)',
              }}>
                Quiero<span style={{ color: 'rgba(244,166,35,0.15)' }}>Comer</span>
              </span>
            </div>
          </div>
        </>
      )}

      {/* ─── Feed View ─── */}
      {view === 'feed' && (
        <>

          {/* ─── Categories — sticky ─── */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 35,
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

          {/* Contextual greeting + location */}
          <div style={{
            padding: '6px 20px 10px', position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          }}>
            <p style={{
              fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.3)', margin: 0,
              fontFamily: 'var(--font-feed-display), serif', flex: 1, minWidth: 0,
            }}>
              {activeCategory
                ? `Lo mejor en ${categories.find(c => c.norm === activeCategory)?.label || activeCategory}`
                : '¿Qué se te antoja?'}
            </p>

            <button onClick={() => setLocationOpen(!locationOpen)} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 20, flexShrink: 0,
              background: 'none', border: '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={(locationName || userLocation) ? '#F4A623' : 'rgba(255,255,255,0.3)'} strokeWidth="2" strokeLinecap="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span style={{
                fontSize: 14, color: (locationName || userLocation) ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)',
                maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {locationName || gpsLabel || 'Ubicación'}
              </span>
            </button>

            {/* Location dropdown */}
            {locationOpen && (
              <>
                <div onClick={() => setLocationOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 44 }} />
                <div style={{
                  position: 'absolute', top: '100%', right: 20, zIndex: 45,
                  background: 'rgba(20,20,20,0.97)', backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14,
                  padding: 8, marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  maxHeight: 320, overflowY: 'auto', width: 240,
                }}>
                  <button onClick={() => {
                    setLocationOpen(false)
                    setLocationName(null)
                    setGpsLabel('Buscando...')
                    navigator.geolocation.getCurrentPosition(pos => {
                      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
                      setUserLocation(loc)
                      // Derive city name from nearest restaurant
                      const nearest = dishes
                        .filter(d => d.restauranteLat && d.restauranteLng)
                        .map(d => ({ d, dist: distanceKm(loc.lat, loc.lng, d.restauranteLat!, d.restauranteLng!) }))
                        .sort((a, b) => a.dist - b.dist)[0]
                      if (nearest?.d.restauranteDireccion) {
                        const parts = nearest.d.restauranteDireccion.split(',').map(p => p.trim())
                          .filter(p => p && p !== 'Chile' && p !== 'Región Metropolitana' && !p.match(/^\d/) && !p.match(/^Av\.?\s/i))
                        const commune = parts.length >= 2 ? parts[parts.length - 2] : parts[parts.length - 1]
                        setGpsLabel(commune || 'Cerca de ti')
                      } else {
                        setGpsLabel('Cerca de ti')
                      }
                    }, () => { setGpsLabel('Sin acceso GPS') }, { enableHighAccuracy: false, timeout: 8000 })
                  }} style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '10px 12px', borderRadius: 10, background: 'rgba(244,166,35,0.08)',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontSize: 13, fontWeight: 600, color: '#F4A623', marginBottom: 6,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F4A623" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
                    </svg>
                    Usar mi ubicación
                  </button>

                  {/* Ver todo — clear filters */}
                  <button onClick={() => {
                    setLocationName(null); setUserLocation(null); setGpsLabel(null)
                    setLocationOpen(false); setLocationQuery('')
                  }} style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: 6,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                    Ver todo
                  </button>

                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0 6px' }} />

                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 10px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.05)', marginBottom: 6,
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round">
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                    <input type="text" placeholder="Buscar comuna..." value={locationQuery}
                      onChange={e => setLocationQuery(e.target.value)}
                      style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 12 }} />
                  </div>

                  {filteredCommunes.map(commune => (
                    <button key={commune} onClick={() => {
                      setLocationName(commune)
                      setLocationOpen(false); setLocationQuery('')
                    }} style={{
                      display: 'block', width: '100%', padding: '9px 12px', borderRadius: 8,
                      background: locationName === commune ? 'rgba(244,166,35,0.1)' : 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      fontSize: 13, fontWeight: locationName === commune ? 600 : 400,
                      color: locationName === commune ? '#F4A623' : 'rgba(255,255,255,0.7)',
                    }}>
                      {commune}
                    </button>
                  ))}
                  {filteredCommunes.length === 0 && (
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: 12, margin: 0 }}>
                      Sin resultados
                    </p>
                  )}
                </div>
              </>
            )}
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
            diet={activeDiet ?? { isVegan: false, isVegetarian: false, isGlutenFree: false, isLactoseFree: false }}
            tasteData={liveTasteData ?? tasteData}
            dishes={dishes}
            onReset={() => { import('../lib/feed-actions').then(({ resetProfile }) => resetProfile()); window.location.reload() }}
            onUpdateDiet={(d) => { setActiveDiet(d); import('../lib/feed-actions').then(({ completeOnboarding }) => completeOnboarding(d)) }}
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
        width: 50, height: 50, borderRadius: '50%',
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

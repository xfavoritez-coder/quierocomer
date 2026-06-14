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

// ─── Meal time detection (aligned with taste-engine periods) ───────
type MealSlot = 'desayuno' | 'brunch' | 'almuerzo' | 'once' | 'cena' | 'madrugada'

const MEAL_SLOTS: { id: MealSlot; label: string; emoji: string; feedFilter: 'desayuno' | 'almuerzo_cena' }[] = [
  { id: 'desayuno',  label: 'Desayuno',  emoji: '🌅', feedFilter: 'desayuno' },
  { id: 'brunch',    label: 'Brunch',    emoji: '🥐', feedFilter: 'desayuno' },
  { id: 'almuerzo',  label: 'Almuerzo',  emoji: '☀️', feedFilter: 'almuerzo_cena' },
  { id: 'once',      label: 'Once',      emoji: '🍵', feedFilter: 'desayuno' },
  { id: 'cena',      label: 'Cena',      emoji: '🌙', feedFilter: 'almuerzo_cena' },
  { id: 'madrugada', label: 'Antojo nocturno', emoji: '🦉', feedFilter: 'almuerzo_cena' },
]

function detectMealSlot(): MealSlot {
  const h = new Date().getHours()
  if (h >= 6 && h < 10) return 'desayuno'
  if (h >= 10 && h < 12) return 'brunch'
  if (h >= 12 && h < 15) return 'almuerzo'
  if (h >= 15 && h < 19) return 'once'
  if (h >= 19 && h < 23) return 'cena'
  return 'madrugada'
}

type View = 'feed' | 'guardados' | 'historial' | 'perfil'

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
  const [activeMeal, setActiveMeal] = useState<MealSlot>(detectMealSlot)
  const [mealPickerOpen, setMealPickerOpen] = useState(false)
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
          // Permission already granted — GPS takes priority over IP
          navigator.geolocation.getCurrentPosition(pos => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
            setUserLocation(loc)
            setLocationName(null) // Clear IP-based city filter, GPS filter takes over
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
        setLocationName(null) // GPS takes priority
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

  // Cities and communes for location dropdown
  const CITY_NAMES = new Set(['Santiago', 'Santiago Centro', 'Valparaíso', 'La Serena', 'Victoria'])
  const { cities, communes } = useMemo(() => {
    const citySet = new Set<string>()
    const communeSet = new Set<string>()
    dishes.forEach(d => {
      if (d.restauranteDireccion) {
        const parts = d.restauranteDireccion.split(',').map(p => p.trim())
          .filter(p => p && p !== 'Chile' && p !== 'Región Metropolitana' && p !== 'Araucanía' && !p.match(/^\d/) && !p.match(/^Av\.?\s|^Calle\s/i))
        if (parts.length >= 3) {
          const city = parts[parts.length - 1]
          const commune = parts[parts.length - 2]
          if (city && CITY_NAMES.has(city)) citySet.add(city)
          if (commune && !CITY_NAMES.has(commune)) communeSet.add(commune)
        } else if (parts.length === 2) {
          const last = parts[parts.length - 1]
          if (CITY_NAMES.has(last)) citySet.add(last)
          else communeSet.add(last)
        }
      }
    })
    return { cities: [...citySet].sort(), communes: [...communeSet].sort() }
  }, [dishes])

  // Filtered locations for search
  const { filteredCities, filteredCommunes } = useMemo(() => {
    if (!locationQuery.trim()) return { filteredCities: cities, filteredCommunes: communes }
    const q = locationQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return {
      filteredCities: cities.filter(c => c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)),
      filteredCommunes: communes.filter(c => c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)),
    }
  }, [cities, communes, locationQuery])

  // Available categories
  const allCategories = useMemo(() => getDisplayCategories(), [])
  const categories = useMemo(() => {
    const available = new Set(dishes.map(d => d.categoriaNorm))
    return allCategories.filter(c => available.has(c.norm))
  }, [dishes, allCategories])

  // Feed dishes — reacts to likes/dislikes in real-time
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

    // Remove interacted dishes
    filtered = filtered.filter(d => !sessionLikedIds.has(d.id) && !sessionDislikedIds.has(d.id))

    // Meal time: separate matching vs non-matching dishes
    const mealFilter = MEAL_SLOTS.find(s => s.id === activeMeal)?.feedFilter ?? 'almuerzo_cena'
    const mealMatch = filtered.filter(d => d.mealTime === mealFilter)
    const mealRest = filtered.filter(d => d.mealTime !== mealFilter)

    // ── pgvector path: use server-scored order ──
    if (vectorScoredIds.length > 0 && !activeCategory) {
      // Order both groups by vector score, meal-matching first
      const orderByVector = (list: FeedDish[]) => {
        const map = new Map(list.map(d => [d.id, d]))
        const ordered: FeedDish[] = []
        for (const id of vectorScoredIds) {
          const d = map.get(id)
          if (d) { ordered.push(d); map.delete(id) }
        }
        return [...ordered, ...map.values()]
      }
      const combined = [...orderByVector(mealMatch), ...orderByVector(mealRest)]

      // Max 3 consecutive same category
      const final: FeedDish[] = []
      const rem = [...combined]
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

    // ── Fallback: keyword scoring with real-time session boosts ──
    const mergedKw: Record<string, number> = { ...keywordScores }
    const sessionCatBoost: Record<string, number> = {}
    for (const d of dishes) {
      if (sessionLikedIds.has(d.id)) {
        const kws = extractKeywords(d.nombre, d.descripcion)
        for (const kw of kws) mergedKw[kw] = (mergedKw[kw] ?? 0) + 8
        sessionCatBoost[d.categoriaNorm] = (sessionCatBoost[d.categoriaNorm] ?? 0) + 15
        if (d.categoriaTipo) sessionCatBoost[`_type_${d.categoriaTipo}`] = (sessionCatBoost[`_type_${d.categoriaTipo}`] ?? 0) + 10
      }
      if (sessionDislikedIds.has(d.id)) {
        const kws = extractKeywords(d.nombre, d.descripcion)
        for (const kw of kws) mergedKw[kw] = (mergedKw[kw] ?? 0) - 15
        sessionCatBoost[d.categoriaNorm] = (sessionCatBoost[d.categoriaNorm] ?? 0) - 20
        if (d.categoriaTipo) sessionCatBoost[`_type_${d.categoriaTipo}`] = (sessionCatBoost[`_type_${d.categoriaTipo}`] ?? 0) - 12
      }
    }

    const scored = filtered.map(d => {
      let score = 0
      score += Math.min((categoryScores[d.categoriaNorm] ?? 0) * 0.2, 8)
      score += (sessionCatBoost[d.categoriaNorm] ?? 0)
      score += (sessionCatBoost[`_type_${d.categoriaTipo}`] ?? 0) * 0.5
      const kws = extractKeywords(d.nombre, d.descripcion)
      let kwTotal = 0
      for (const kw of kws) kwTotal += (mergedKw[kw] ?? 0)
      score += Math.min(kwTotal, 15)
      // Boost dishes that match the active meal time
      if (d.mealTime === mealFilter) score += 10
      return { dish: d, score }
    })

    scored.sort((a, b) => b.score - a.score)

    let result: FeedDish[] = scored.map(s => s.dish)

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
  }, [dishes, activeCategory, categoryScores, keywordScores, sessionLikedIds, sessionDislikedIds, vectorScoredIds, locationName, userLocation, activeDiet, activeMeal])

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

  const currentMealSlot = MEAL_SLOTS.find(s => s.id === activeMeal)!

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
                { label: 'Me han gustado', color: '#22c55e',
                  icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" /></svg>,
                  action: () => { setMenuOpen(false); setView('historial'); window.scrollTo(0, 0) } },
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

          {/* Contextual greeting + meal time + location */}
          <div style={{
            padding: '6px 20px 10px', position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {activeCategory ? (
                <p style={{
                  fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.3)', margin: 0,
                  fontFamily: 'var(--font-feed-display), serif',
                }}>
                  Lo mejor en {categories.find(c => c.norm === activeCategory)?.label || activeCategory}
                </p>
              ) : (
                <button
                  onClick={() => setMealPickerOpen(!mealPickerOpen)}
                  style={{
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    textAlign: 'left', display: 'block', width: '100%',
                  }}
                >
                  <p style={{
                    fontSize: 17, fontWeight: 700, color: 'rgba(255,255,255,0.55)', margin: 0,
                    fontFamily: 'var(--font-feed-display), serif',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span>{currentMealSlot.emoji}</span>
                    <span>{currentMealSlot.label}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                      stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: mealPickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </p>
                  <p style={{
                    fontSize: 12, color: 'rgba(255,255,255,0.2)', margin: '1px 0 0',
                    fontWeight: 400,
                  }}>
                    ¿Qué se te antoja?
                  </p>
                </button>
              )}
            </div>

            <button onClick={() => setLocationOpen(!locationOpen)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 22, flexShrink: 0,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={(locationName || userLocation) ? '#F4A623' : 'rgba(255,255,255,0.3)'} strokeWidth="2" strokeLinecap="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span style={{
                fontSize: 13, color: (locationName || userLocation) ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)',
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

                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 10px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)', marginBottom: 6, marginTop: 6,
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round">
                      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                    </svg>
                    <input type="text" placeholder="Buscar comuna o ciudad..." value={locationQuery}
                      onChange={e => setLocationQuery(e.target.value)}
                      className="location-search-input"
                      style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 13 }} />
                  </div>

                  {/* Cities */}
                  {filteredCities.length > 0 && (
                    <>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', margin: '4px 12px 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Ciudades</p>
                      {filteredCities.map(city => (
                        <button key={city} onClick={() => {
                          setLocationName(city)
                          setLocationOpen(false); setLocationQuery('')
                        }} style={{
                          display: 'block', width: '100%', padding: '9px 12px', borderRadius: 8,
                          background: locationName === city ? 'rgba(244,166,35,0.1)' : 'transparent',
                          border: 'none', cursor: 'pointer', textAlign: 'left',
                          fontSize: 13, fontWeight: locationName === city ? 600 : 400,
                          color: locationName === city ? '#F4A623' : 'rgba(255,255,255,0.7)',
                        }}>
                          {city}
                        </button>
                      ))}
                    </>
                  )}

                  {/* Separator */}
                  {filteredCities.length > 0 && filteredCommunes.length > 0 && (
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 12px' }} />
                  )}

                  {/* Communes */}
                  {filteredCommunes.length > 0 && (
                    <>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', margin: '4px 12px 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Comunas</p>
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
                    </>
                  )}
                  {filteredCities.length === 0 && filteredCommunes.length === 0 && (
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: 12, margin: 0 }}>
                      Sin resultados
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Meal time picker dropdown */}
            {mealPickerOpen && !activeCategory && (
              <>
                <div onClick={() => setMealPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 44 }} />
                <div style={{
                  position: 'absolute', top: '100%', left: 20, zIndex: 45,
                  background: 'rgba(20,20,20,0.97)', backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14,
                  padding: 6, marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  width: 200,
                }}>
                  {MEAL_SLOTS.map(slot => (
                    <button key={slot.id} onClick={() => {
                      setActiveMeal(slot.id)
                      setMealPickerOpen(false)
                    }} style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '10px 12px', borderRadius: 10,
                      background: activeMeal === slot.id ? 'rgba(244,166,35,0.1)' : 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}>
                      <span style={{ fontSize: 16 }}>{slot.emoji}</span>
                      <span style={{
                        fontSize: 14,
                        fontWeight: activeMeal === slot.id ? 600 : 400,
                        color: activeMeal === slot.id ? '#F4A623' : 'rgba(255,255,255,0.6)',
                      }}>
                        {slot.label}
                      </span>
                      {slot.id === detectMealSlot() && activeMeal !== slot.id && (
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginLeft: 'auto' }}>ahora</span>
                      )}
                    </button>
                  ))}
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

      {/* ─── Historial (Me han gustado) View ─── */}
      {view === 'historial' && (
        <>
          <div style={{ padding: '16px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => setView('feed')} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)',
              display: 'flex', alignItems: 'center', gap: 6, padding: 0, fontSize: 13,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Volver
            </button>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
              {likedDishes.length} plato{likedDishes.length !== 1 ? 's' : ''}
            </span>
          </div>
          <h2 style={{
            fontFamily: 'var(--font-feed-display), serif',
            fontSize: 18, fontWeight: 700, color: '#fff', margin: 0,
            padding: '0 20px 12px',
          }}>
            Me han gustado
          </h2>
          {likedDishes.length > 0 ? (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3,
              padding: '0 3px 100px',
            }}>
              {likedDishes.map(d => (
                <div key={d.id} onClick={() => handleDishTap(d)} style={{
                  position: 'relative', aspectRatio: '1', overflow: 'hidden',
                  cursor: 'pointer', background: '#1a1a1a',
                }}>
                  {d.fotoUrl ? (
                    <img src={d.fotoUrl} alt={d.nombre}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      loading="lazy" />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', fontSize: 12, padding: 8, textAlign: 'center',
                    }}>
                      {d.nombre}
                    </div>
                  )}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                    padding: '20px 6px 6px',
                  }}>
                    <p style={{
                      fontSize: 11, fontWeight: 600, color: '#fff', margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {d.nombre}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.3)' }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>👍</p>
              <p style={{ fontSize: 14 }}>Aún no tienes platos que te gusten</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.15)', marginTop: 4 }}>Desliza hacia la derecha en el feed</p>
            </div>
          )}
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

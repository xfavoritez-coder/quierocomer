'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import type { FeedDish } from '../types'
import { distanceKm } from '../lib/geo'
import MasonryGrid from '../components/MasonryGrid'
import FeedDishDetail from '../components/FeedDishDetail'
import SavedList from '../components/SavedList'
import ProfileView from '../components/ProfileView'
import { createEmptyProfile, getRecommendationReason, type FeedProfile } from '../lib/scoring'
import {
  trackInteraction,
  saveDish,
  unsaveDish,
  updateTasteAction,
} from '../lib/feed-actions'

// ─── Meal time detection ──────────────────────────────────────────
type MealSlot = 'desayuno' | 'almuerzo' | 'cena'

const MealIcons = {
  desayuno: (color: string) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" /><line x1="6" y1="2" x2="6" y2="4" /><line x1="10" y1="2" x2="10" y2="4" /><line x1="14" y1="2" x2="14" y2="4" />
    </svg>
  ),
  almuerzo: (color: string) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  cena: (color: string) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
}

const MEAL_SLOTS: { id: MealSlot; label: string; feedFilter: 'desayuno' | 'almuerzo_cena' }[] = [
  { id: 'desayuno', label: 'Desayuno', feedFilter: 'desayuno' },
  { id: 'almuerzo', label: 'Almuerzo', feedFilter: 'almuerzo_cena' },
  { id: 'cena',     label: 'Cena',     feedFilter: 'almuerzo_cena' },
]

function detectMealSlot(): MealSlot {
  const h = new Date().getHours()
  if (h >= 6 && h < 12) return 'desayuno'
  if (h >= 12 && h < 19) return 'almuerzo'
  return 'cena'
}

type View = 'feed' | 'perfil' | 'all-liked' | 'all-saved'

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
  const [hideRelated, setHideRelated] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationName, setLocationName] = useState<string | null>(null)
  const [locationOpen, setLocationOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeMeal, setActiveMeal] = useState<MealSlot>(detectMealSlot)
  const [mealPickerOpen, setMealPickerOpen] = useState(false)
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [searchInput, setSearchInput] = useState(searchParams.get('q') || '')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterMeal, setFilterMeal] = useState<'all' | 'desayuno' | 'almuerzo_cena'>(detectMealSlot() === 'desayuno' ? 'desayuno' : 'almuerzo_cena')
  const [filterSort, setFilterSort] = useState<'recent' | 'price-asc' | 'price-desc' | 'popular'>('recent')
  const [filterMaxKm, setFilterMaxKm] = useState(20)
  const [filterDiet, setFilterDiet] = useState<'all' | 'VEGAN' | 'VEGETARIAN'>('all')
  const [savedDishIds, setSavedDishIds] = useState<Set<string>>(new Set())
  const [visibleCount, setVisibleCount] = useState(10)
  const [locationQuery, setLocationQuery] = useState('')

  // Profile for DishModal — refreshable
  const [liveProfile, setLiveProfile] = useState<FeedProfile | null>(null)
  const [liveTasteData, setLiveTasteData] = useState(tasteData)
  const [likeCount, setLikeCount] = useState(0)
  const [passCount, setPassCount] = useState(0)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const profile = useMemo<FeedProfile>(() => {
    if (liveProfile) return liveProfile
    const base = createEmptyProfile()
    base.categoryScores = categoryScores
    base.keywordScores = keywordScores
    base.totalInteractions = totalInteractions
    return base
  }, [categoryScores, keywordScores, totalInteractions, liveProfile])

  // Viewed/saved dishes for profile — loaded from server
  const [viewedDishIds, setViewedDishIds] = useState<string[]>([])
  const [likedDishIds, setLikedDishIds] = useState<Set<string>>(new Set())

  // Load profile data from server when entering perfil view
  useEffect(() => {
    if (view !== 'perfil') return
    import('../lib/feed-actions').then(({ getProfileData }) =>
      getProfileData().then(data => {
        if (!data) return
        const p = createEmptyProfile()
        p.categoryScores = data.categoryScores
        p.keywordScores = data.keywordScores
        p.totalInteractions = data.totalInteractions
        p.likedDishIds = new Set(data.likedDishIds ?? [])
        setLiveProfile(p)
        setLiveTasteData(data.tasteData)
        setActiveDiet(data.diet)
        setLikeCount(data.likeCount ?? 0)
        setPassCount(data.passCount ?? 0)
        setDisplayName(data.displayName ?? null)
        if (data.likedDishIds?.length) setLikedDishIds(new Set(data.likedDishIds))
        if (data.viewedDishIds?.length) setViewedDishIds(data.viewedDishIds)
      })
    ).catch(() => {})
  }, [view])

  // Geolocation — IP fallback + GPS upgrade
  const [gpsLabel, setGpsLabel] = useState<string | null>(null)

  // Location: ask GPS directly on mount, fallback to IP
  useEffect(() => {
    if (userLocation) return

    const reverseGeocode = async (lat: number, lng: number) => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16`)
        const data = await res.json()
        const addr = data.address
        // Show neighborhood/suburb or road name
        return addr.suburb || addr.neighbourhood || addr.road || addr.city_district || addr.city || 'Cerca de ti'
      } catch { return null }
    }

    const onGPS = async (pos: GeolocationPosition) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      setUserLocation(loc)
      setLocationName(null)
      // Reverse geocode for accurate label
      const label = await reverseGeocode(loc.lat, loc.lng)
      setGpsLabel(label || 'Cerca de ti')
    }

    const onGPSError = () => {
      // Fallback to IP
      fetch('https://ipapi.co/json/')
        .then(r => r.json())
        .then(data => { if (data.city) setLocationName(data.city) })
        .catch(() => {})
    }

    // Request GPS with high accuracy
    navigator.geolocation?.getCurrentPosition(onGPS, onGPSError, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 60000,
    })
  }, [])


  // Cities and communes for location dropdown
  const CITY_NAMES = new Set(['Santiago', 'Santiago Centro', 'Valparaíso', 'La Serena', 'Victoria'])
  const { cities, communes } = useMemo(() => {
    // Extract from dishes + add static Santiago communes
    const citySet = new Set<string>(['Santiago'])
    const communeSet = new Set<string>([
      'Ñuñoa', 'Providencia', 'Las Condes', 'Vitacura', 'La Reina',
      'La Florida', 'Peñalolén', 'Macul', 'San Miguel', 'Maipú',
      'Independencia', 'Recoleta', 'Estación Central', 'Lo Barnechea',
      'San Joaquín', 'Huechuraba', 'Quinta Normal', 'Pudahuel', 'Cerrillos',
      'La Cisterna', 'San Bernardo', 'Puente Alto', 'Conchalí',
    ])
    dishes.forEach(d => {
      if (d.restauranteDireccion) {
        const parts = d.restauranteDireccion.split(',').map(p => p.trim())
          .filter(p => p && p !== 'Chile' && p !== 'Región Metropolitana' && !p.match(/^\d/) && !p.match(/^Av\.?\s|^Calle\s/i))
        if (parts.length >= 2) {
          const commune = parts[parts.length - 2] || parts[parts.length - 1]
          if (commune && commune.length > 2) communeSet.add(commune)
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

  // Search suggestions
  const suggestions = useMemo(() => {
    if (!searchInput.trim() || searchInput.length < 2) return []
    const q = searchInput.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const results: { label: string; type: 'categoria' | 'restaurante' | 'plato' }[] = []
    const seen = new Set<string>()

    // Categories
    const cats = [...new Set(dishes.map(d => d.categoriaNorm))]
    for (const cat of cats) {
      if (cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q) && !seen.has(cat)) {
        seen.add(cat)
        results.push({ label: cat, type: 'categoria' })
      }
    }

    // Restaurants
    for (const d of dishes) {
      const name = d.restaurante
      if (!seen.has(name) && name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)) {
        seen.add(name)
        results.push({ label: name, type: 'restaurante' })
      }
    }

    // Dishes (top 5)
    let dishCount = 0
    for (const d of dishes) {
      if (dishCount >= 5) break
      if (d.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q) && !seen.has(d.nombre)) {
        seen.add(d.nombre)
        results.push({ label: d.nombre, type: 'plato' })
        dishCount++
      }
    }

    return results.slice(0, 8)
  }, [searchInput, dishes])

  const executeSearch = useCallback((query: string) => {
    setSearchQuery(query)
    setSearchInput(query)
    setShowSuggestions(false)
    // Update URL
    const url = new URL(window.location.href)
    if (query) url.searchParams.set('q', query)
    else url.searchParams.delete('q')
    window.history.replaceState({}, '', url.toString())
  }, [])

  // Feed dishes — simple filter + sort, no swipe state
  const feedDishes = useMemo(() => {
    let filtered = dishes.filter(d => d.fotoUrl)

    // Location filter
    if (locationName) {
      const locNorm = locationName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const inCommune = filtered.filter(d => {
        if (!d.restauranteDireccion) return false
        const addr = d.restauranteDireccion.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        return addr.includes(locNorm)
      })
      if (inCommune.length > 0) filtered = inCommune
    }
    // Distance filter — uses slider value (filterMaxKm) or GPS auto
    if (userLocation && !locationName) {
      const maxDist = filterMaxKm < 20 ? filterMaxKm : 999
      const withDist = filtered
        .filter(d => d.restauranteLat && d.restauranteLng)
        .map(d => ({
          dish: d,
          dist: distanceKm(userLocation.lat, userLocation.lng, d.restauranteLat!, d.restauranteLng!)
        }))
        .sort((a, b) => a.dist - b.dist)
      const nearby = withDist.filter(x => x.dist <= maxDist)
      if (nearby.length >= 3) {
        filtered = nearby.map(x => x.dish)
      } else {
        filtered = withDist.slice(0, 30).map(x => x.dish)
      }
    }

    // Category filter
    if (activeCategory) {
      filtered = filtered.filter(d => d.categoriaNorm === activeCategory)
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      filtered = filtered.filter(d => {
        const name = d.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        const rest = d.restaurante.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        const desc = (d.descripcion || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        return name.includes(q) || rest.includes(q) || desc.includes(q) || d.categoriaNorm.toLowerCase().includes(q)
      })
    }

    // Meal time filter (from filter dropdown)
    if (filterMeal !== 'all') {
      filtered = filtered.filter(d => d.mealTime === filterMeal)
    }

    // Diet filter
    if (filterDiet === 'VEGAN') filtered = filtered.filter(d => d.dieta.tipo === 'VEGAN')
    else if (filterDiet === 'VEGETARIAN') filtered = filtered.filter(d => d.dieta.tipo === 'VEGAN' || d.dieta.tipo === 'VEGETARIAN')

    // Sort based on filter selection
    let combined: FeedDish[]
    if (filterSort === 'price-asc') {
      combined = [...filtered].sort((a, b) => (a.precioDescuento ?? a.precio) - (b.precioDescuento ?? b.precio))
    } else if (filterSort === 'price-desc') {
      combined = [...filtered].sort((a, b) => (b.precioDescuento ?? b.precio) - (a.precioDescuento ?? a.precio))
    } else if (filterSort === 'popular') {
      combined = [...filtered].sort((a, b) => b.popularityScore - a.popularityScore)
    } else {
      // Default: vector rank + category/keyword scoring
      const vectorRank = vectorScoredIds.length > 0 && !activeCategory
        ? new Map(vectorScoredIds.map((id, i) => [id, 1 - i / vectorScoredIds.length]))
        : undefined
      combined = filtered
        .map(d => {
          let score = 0
          if (vectorRank) {
            const vScore = vectorRank.get(d.id) ?? 0
            const catRaw = categoryScores[d.categoriaNorm] ?? 0
            const catNorm = catRaw > 0 ? Math.min(Math.log2(catRaw + 1) / 6, 1) : 0
            score = vScore * 0.6 + catNorm * 0.4
          } else {
            score += Math.min((categoryScores[d.categoriaNorm] ?? 0) * 0.2, 8)
          }
          return { dish: d, score }
        })
        .sort((a, b) => b.score - a.score)
        .map(s => s.dish)
    }

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
  }, [dishes, activeCategory, categoryScores, keywordScores, vectorScoredIds, locationName, userLocation, searchQuery, filterMeal, filterSort, filterDiet, filterMaxKm])

  // Infinite scroll — check every 500ms if near bottom
  useEffect(() => {
    const check = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1000) {
        setVisibleCount(prev => {
          if (prev < feedDishes.length) return Math.min(prev + 10, feedDishes.length)
          return prev
        })
      }
    }
    const interval = setInterval(check, 500)
    window.addEventListener('scroll', check, { passive: true })
    return () => { clearInterval(interval); window.removeEventListener('scroll', check) }
  }, [feedDishes.length])

  // Reset visible count on any filter change
  useEffect(() => { setVisibleCount(10) }, [activeCategory, filterMeal, filterSort, filterDiet, filterMaxKm, searchQuery, locationName])

  // Handlers
  const handleDishTap = useCallback((d: FeedDish) => {
    setSelectedDish(d)
    setHideRelated(false)
    trackInteraction(d.id, 'TAP', d.categoriaNorm, d.precioDescuento ?? d.precio).catch(() => {})
  }, [])

  const handleLikedDishTap = useCallback((d: FeedDish) => {
    setSelectedDish(d)
    setHideRelated(true)
  }, [])

  const handleDishSave = useCallback((dish: FeedDish) => {
    setSavedDishIds(prev => new Set([...prev, dish.id]))
    saveDish(dish.id, 'SAVED').catch(() => {})
    updateTasteAction(dish.id, 'FAVORITE').catch(() => {})
  }, [])

  const handleRemoveSaved = useCallback((dishId: string) => {
    setSavedDishIds(prev => { const n = new Set(prev); n.delete(dishId); return n })
    unsaveDish(dishId).catch(() => {})
  }, [])

  // Dishes for guardados view
  const likedDishes = useMemo(() =>
    [...likedDishIds].map(id => dishes.find(d => d.id === id)).filter(Boolean) as FeedDish[],
    [likedDishIds, dishes]
  )
  const savedDishes = useMemo(() =>
    [...savedDishIds].map(id => dishes.find(d => d.id === id)).filter(Boolean) as FeedDish[],
    [savedDishIds, dishes]
  )
  const viewedDishes = useMemo(() =>
    viewedDishIds.map(id => dishes.find(d => d.id === id)).filter(Boolean) as FeedDish[],
    [viewedDishIds, dishes]
  )

  const selectedReason = selectedDish ? getRecommendationReason(selectedDish, profile) : null

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh' }}>

      {/* ─── Header: logo + location + hamburger ─── */}
      <header style={{
        background: '#0e0e0e',
        padding: '10px 16px', display: 'flex', alignItems: 'center',
      }}>
        <a href="/" style={{ textDecoration: 'none', cursor: 'pointer', flexShrink: 0 }}>
          <span style={{
            fontFamily: 'var(--font-feed-display), serif',
            fontSize: 22, fontWeight: 700, color: '#fff',
          }}>
            Quiero<span style={{ color: '#F4A623' }}>Comer</span>
          </span>
        </a>

        {/* Location — text style, clickeable */}
        <button onClick={() => setLocationOpen(!locationOpen)} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={(locationName || userLocation) ? '#F4A623' : 'rgba(255,255,255,0.25)'} strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
          <span style={{
            fontSize: 14, fontWeight: 500,
            color: (locationName || gpsLabel) ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {locationName || gpsLabel || 'Seleccionar ubicación'}
          </span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <button onClick={() => setMenuOpen(true)} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 6, flexShrink: 0,
          color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </header>

      {/* ─── Search + Filter — sticky ─── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 35,
        padding: '6px 16px 8px', display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(14,14,14,0.97)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" strokeLinecap="round"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 2 }}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={searchInputRef}
            className="feed-search-input"
            type="text" value={searchInput}
            onChange={e => { setSearchInput(e.target.value); setShowSuggestions(true); setSearchQuery(e.target.value) }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={e => { if (e.key === 'Enter') { executeSearch(searchInput); searchInputRef.current?.blur() } }}
            placeholder="Buscar plato o restaurante..."
            style={{
              width: '100%', padding: '10px 36px 10px 34px', borderRadius: 14, fontSize: 16,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
              color: '#fff', outline: 'none', boxSizing: 'border-box',
            }}
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); executeSearch('') }} style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'rgba(255,255,255,0.3)', zIndex: 2,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && searchInput.length >= 2 && (
            <>
              <div onClick={() => setShowSuggestions(false)} style={{ position: 'fixed', inset: 0, zIndex: 36 }} />
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 37, marginTop: 4,
                background: 'rgba(20,20,20,0.97)', backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden',
              }}>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => executeSearch(s.label)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>
                      {s.type === 'categoria' ? '📂' : s.type === 'restaurante' ? '🏪' : '🍽'}
                    </span>
                    <div>
                      <p style={{ fontSize: 14, color: '#fff', margin: 0 }}>{s.label}</p>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', margin: '1px 0 0' }}>
                        {s.type === 'categoria' ? 'Categoría' : s.type === 'restaurante' ? 'Restaurante' : 'Plato'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Filter button */}
        <button onClick={() => setFilterOpen(!filterOpen)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '10px', borderRadius: 14, flexShrink: 0,
          background: filterSort !== 'recent' || filterDiet !== 'all' || filterMeal !== 'all'
            ? 'rgba(244,166,35,0.15)' : 'rgba(255,255,255,0.06)',
          border: filterSort !== 'recent' || filterDiet !== 'all' || filterMeal !== 'all'
            ? '1px solid rgba(244,166,35,0.3)' : '1px solid rgba(255,255,255,0.08)',
          cursor: 'pointer', alignSelf: 'stretch',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke={filterSort !== 'recent' || filterDiet !== 'all' || filterMeal !== 'all' ? '#F4A623' : 'rgba(255,255,255,0.4)'}
            strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="12" y1="18" x2="20" y2="18" />
            <circle cx="6" cy="12" r="2" fill="currentColor" /><circle cx="14" cy="18" r="2" fill="currentColor" />
          </svg>
        </button>
      </div>

      {/* ─── Filter sheet ─── */}
      {filterOpen && (
        <>
          <div onClick={() => setFilterOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 81,
            maxHeight: '90vh', overflowY: 'auto',
            padding: '12px 16px', boxSizing: 'border-box',
            background: 'radial-gradient(circle at top left, rgba(255,170,30,0.06), transparent 35%), #121212',
            borderRadius: '24px 24px 0 0',
            animation: 'slideUp 0.25s ease-out',
          }}>
            {/* Drag handle */}
            <div style={{ width: 40, height: 5, background: '#555', borderRadius: 999, margin: '0 auto 16px' }} />

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#f5f5f5' }}>Filtros</h2>
              <button onClick={() => setFilterOpen(false)} style={{
                width: 44, height: 44, borderRadius: 999,
                border: '1px solid #333', background: '#191919', color: '#aaa',
                fontSize: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>×</button>
            </div>

            {/* Distancia */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ color: '#f6a51a', fontSize: 20 }}>📍</span>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f5f5f5' }}>Distancia</h3>
              </div>
              <div style={{ border: '1px solid #2c2c2c', borderRadius: 22, padding: '22px 18px', background: 'rgba(255,255,255,0.025)' }}>
                <p style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700, color: '#f5f5f5' }}>
                  Hasta <strong style={{ color: '#f6a51a', marginLeft: 8 }}>{filterMaxKm < 20 ? `${filterMaxKm} km` : 'Sin límite'}</strong>
                </p>
                <div style={{ position: 'relative', height: 6, background: '#3a3a3a', borderRadius: 999 }}>
                  <div style={{ width: `${(filterMaxKm / 20) * 100}%`, height: '100%', background: '#f6a51a', borderRadius: 999 }} />
                  <div style={{ position: 'absolute', left: `${(filterMaxKm / 20) * 100}%`, top: '50%', width: 28, height: 28, background: '#f6a51a', borderRadius: 999, transform: 'translate(-50%, -50%)' }} />
                </div>
                <input type="range" min={1} max={20} value={filterMaxKm}
                  onChange={e => setFilterMaxKm(Number(e.target.value))}
                  style={{ width: '100%', height: 28, appearance: 'none', background: 'transparent', cursor: 'pointer', position: 'relative', marginTop: -17, opacity: 0 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8e8e8e', fontSize: 14, marginTop: 8 }}>
                  <span>1 km</span><span>5 km</span><span>10 km</span><span>20 km</span>
                </div>
              </div>
            </div>

            {/* Momento */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ color: '#f6a51a', fontSize: 20 }}>🕒</span>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f5f5f5' }}>Momento</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { id: 'desayuno' as const, label: 'Desayuno', emoji: '🌅' },
                  { id: 'almuerzo_cena' as const, label: 'Almuerzo', emoji: '☀️' },
                  { id: 'almuerzo_cena' as const, label: 'Cena', emoji: '🌙' },
                  { id: 'all' as const, label: 'Todos', emoji: '▦' },
                ].map((m, i) => (
                  <button key={i} onClick={() => setFilterMeal(m.id)} style={{
                    minHeight: 76, borderRadius: 16,
                    border: filterMeal === m.id ? '1px solid #a66a13' : '1px solid #303030',
                    background: filterMeal === m.id ? 'rgba(246,165,26,0.08)' : 'rgba(255,255,255,0.025)',
                    color: filterMeal === m.id ? '#f6a51a' : '#cfcfcf',
                    fontSize: 15, display: 'flex', flexDirection: 'column', gap: 14,
                    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}>
                    <span style={{ fontSize: 28 }}>{m.emoji}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dieta */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ color: '#62c945', fontSize: 20 }}>🌿</span>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f5f5f5' }}>Dieta</h3>
              </div>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
                {[
                  { id: 'all' as const, label: '🥩 Carnívoro' },
                  { id: 'VEGAN' as const, label: '🌱 Vegano' },
                  { id: 'VEGETARIAN' as const, label: '🥬 Vegetariano' },
                ].map(d => (
                  <button key={d.id} onClick={() => setFilterDiet(d.id)} style={{
                    border: filterDiet === d.id ? '1px solid #a66a13' : '1px solid #303030',
                    borderRadius: 18, padding: '15px 20px',
                    background: filterDiet === d.id ? 'rgba(246,165,26,0.08)' : 'rgba(255,255,255,0.025)',
                    color: filterDiet === d.id ? '#f6a51a' : '#cfcfcf',
                    fontSize: 16, whiteSpace: 'nowrap', cursor: 'pointer',
                  }}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ordenar */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ color: '#f6a51a', fontSize: 20 }}>↕</span>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f5f5f5' }}>Ordenar por</h3>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {[
                  { id: 'recent' as const, label: 'Últimos agregados' },
                  { id: 'popular' as const, label: 'Más populares' },
                  { id: 'price-asc' as const, label: 'Precio menor a mayor' },
                  { id: 'price-desc' as const, label: 'Precio mayor a menor' },
                ].map(s => (
                  <button key={s.id} onClick={() => setFilterSort(s.id)} style={{
                    border: filterSort === s.id ? '1px solid #a66a13' : '1px solid #303030',
                    borderRadius: 18, padding: '15px 20px',
                    background: filterSort === s.id ? 'rgba(246,165,26,0.08)' : 'rgba(255,255,255,0.025)',
                    color: filterSort === s.id ? '#f6a51a' : '#f5f5f5',
                    fontSize: 16, cursor: 'pointer',
                  }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Spacer for fixed button */}
            <div style={{ height: 80 }} />
          </div>

          {/* Fixed apply button */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 82,
            padding: '12px 18px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
            background: 'linear-gradient(to top, #121212, rgba(18,18,18,0.95))',
          }}>
            <button onClick={() => setFilterOpen(false)} style={{
              width: '100%', height: 56, border: 'none', borderRadius: 18,
              background: '#f6a51a', color: '#111', fontSize: 17, fontWeight: 800, cursor: 'pointer',
            }}>
              Ver {feedDishes.length} platos
            </button>
          </div>
        </>
      )}

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
              <button onClick={() => { setMenuOpen(false); setView('perfil'); window.scrollTo(0, 0) }} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '14px 16px', borderRadius: 14,
                color: '#fff', textDecoration: 'none',
                fontSize: 17, fontWeight: 600,
                background: view === 'perfil' ? 'rgba(244,166,35,0.08)' : 'transparent',
                border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                WebkitTapHighlightColor: 'transparent',
              }}>
                <span style={{ color: '#855bd8', display: 'flex', flexShrink: 0 }}>
                  <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c.7-4.2 3.8-7 8-7s7.3 2.8 8 7H4z" /></svg>
                </span>
                Mi perfil
              </button>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 16px' }} />
              <a href="/qr" style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '14px 16px', borderRadius: 14,
                color: '#fff', textDecoration: 'none',
                fontSize: 17, fontWeight: 600,
                background: 'transparent', border: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}>
                <span style={{ color: '#F4A623', display: 'flex', flexShrink: 0 }}>
                  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
                  </svg>
                </span>
                ¿Tienes un local?
              </a>
              <a href="mailto:hola@quierocomer.cl" style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '14px 16px', borderRadius: 14,
                color: '#fff', textDecoration: 'none',
                fontSize: 17, fontWeight: 600,
                background: 'transparent', border: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', display: 'flex', flexShrink: 0 }}>
                  <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                Contacto
              </a>
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

          {/* Location dropdown anchor */}
          <div style={{ position: 'relative', padding: '0 16px' }}>

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
                      {MealIcons[slot.id](activeMeal === slot.id ? '#F4A623' : 'rgba(255,255,255,0.4)')}
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

          {/* Search results count */}
          {searchQuery.trim() && (
            <p style={{ padding: '0 16px 8px', fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
              {feedDishes.length} resultado{feedDishes.length !== 1 ? 's' : ''} para "{searchQuery}"
            </p>
          )}

          {/* Feed masonry */}
          {feedDishes.length > 0 ? (
            <>
              <MasonryGrid
                dishes={feedDishes.slice(0, visibleCount)}
                onDishTap={handleDishTap}
                userLocation={userLocation}
              />
              {/* Loading skeleton when more dishes are available */}
              {/* Skeleton for loading more */}
              {visibleCount < feedDishes.length && (
                <div style={{ display: 'flex', gap: 10, padding: '10px 12px 40px' }}>
                  {[0, 1].map(col => (
                    <div key={col} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[0, 1].map(i => (
                        <div key={i} className="skeleton-shimmer" style={{
                          aspectRatio: col === 0 ? '3/4' : '4/5',
                          borderRadius: 14, background: 'rgba(255,255,255,0.04)',
                        }} />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
              No hay platos en esta categoría
            </div>
          )}
        </>
      )}

      {/* ─── Perfil View (unified: profile + liked + saved) ─── */}
      {view === 'perfil' && (
        <>
          <ProfileView
            savedDishes={savedDishes}
            viewedDishes={viewedDishes}
            onDishTap={handleLikedDishTap}
            onViewAllSaved={() => { setView('all-saved'); window.scrollTo(0, 0) }}
            onViewAllViewed={() => { setView('all-liked'); window.scrollTo(0, 0) }}
          />
        </>
      )}

      {/* ─── All Liked View ─── */}
      {view === 'all-liked' && (
        <div style={{ padding: '8px 3px 100px' }}>
          <div style={{ padding: '8px 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setView('perfil')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
            <h2 style={{ fontFamily: 'var(--font-feed-display), serif', fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>
              Me han gustado
            </h2>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>({likedDishes.length})</span>
          </div>
          {likedDishes.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
              {likedDishes.map(d => (
                <div key={d.id} onClick={() => handleLikedDishTap(d)} style={{
                  position: 'relative', aspectRatio: '1', overflow: 'hidden',
                  cursor: 'pointer', background: '#1a1a1a',
                }}>
                  {d.fotoUrl ? (
                    <img src={d.fotoUrl} alt={d.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', fontSize: 10, padding: 4, textAlign: 'center' }}>{d.nombre}</div>
                  )}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)', padding: '20px 6px 6px' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.3)' }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>👍</p>
              <p style={{ fontSize: 14 }}>Aún no tienes platos que te gusten</p>
            </div>
          )}
        </div>
      )}

      {/* ─── All Saved View ─── */}
      {view === 'all-saved' && (
        <div style={{ padding: '8px 16px 100px' }}>
          <div style={{ padding: '8px 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setView('perfil')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
            <h2 style={{ fontFamily: 'var(--font-feed-display), serif', fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>
              Guardados
            </h2>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>({savedDishes.length})</span>
          </div>
          <SavedList antojos={[]} saved={savedDishes} onDishTap={handleLikedDishTap} onRemove={handleRemoveSaved} />
        </div>
      )}

      {/* ─── DishModal ─── */}
      {selectedDish && (
        <FeedDishDetail
          key={selectedDish.id}
          dish={selectedDish}
          allDishes={feedDishes}
          profile={profile}
          hideRelated={hideRelated}
          onClose={() => setSelectedDish(null)}
          onSave={handleDishSave}
          onDishTap={handleDishTap}
          userLocation={userLocation}
        />
      )}

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
        fontSize: 13, fontWeight: active ? 600 : 500,
        color: active ? '#F4A623' : 'rgba(255,255,255,0.45)',
        maxWidth: 64, textAlign: 'center',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    </button>
  )
}

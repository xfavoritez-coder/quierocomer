'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import type { FeedDish } from '../types'
import LocationModal from '../components/LocationModal'
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
import { QC_CATEGORIES } from '../lib/categories'
import { slugify } from '@/lib/slugify'

function normStr(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

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
  initialDishId,
}: {
  dishes: FeedDish[]
  categoryScores: Record<string, number>
  keywordScores: Record<string, number>
  totalInteractions: number
  vectorScoredIds?: string[]
  tasteData?: { antojoSessionDate: string | null; antojoDishIds: string[]; antojoRejectIds: string[]; tasteEmbeddingsCount: number; hasGustoVector: boolean }
  userDiet?: { isVegan: boolean; isVegetarian: boolean; isGlutenFree: boolean; isLactoseFree: boolean }
  initialDishId?: string
}) {
  const [view, setView] = useState<View>('feed')
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('qc_theme') === 'dark'
    return false
  })
  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev
      localStorage.setItem('qc_theme', next ? 'dark' : 'light')
      return next
    })
  }
  const [activeDiet, setActiveDiet] = useState(userDiet)
  const [selectedDish, setSelectedDish] = useState<FeedDish | null>(null)
  const [hideRelated, setHideRelated] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationName, setLocationName] = useState<string | null>(null)
  const [locationOpen, setLocationOpen] = useState(false)
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeMeal, setActiveMeal] = useState<MealSlot>(detectMealSlot)
  const [mealPickerOpen, setMealPickerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('q') || ''
    }
    return ''
  })
  const [searchInput, setSearchInput] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('q') || ''
    }
    return ''
  })
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterMeal, setFilterMeal] = useState<'all' | 'desayuno' | 'almuerzo_cena'>(detectMealSlot() === 'desayuno' ? 'desayuno' : 'almuerzo_cena')
  const [filterMealDisplay, setFilterMealDisplay] = useState<'all' | 'desayuno' | 'almuerzo' | 'cena'>(detectMealSlot() === 'desayuno' ? 'desayuno' : detectMealSlot())
  const [filterSort, setFilterSort] = useState<'recent' | 'price-asc' | 'price-desc' | 'popular'>('recent')
  const [filterMaxKm, setFilterMaxKm] = useState(20)
  const [filterDiet, setFilterDiet] = useState<'all' | 'VEGAN' | 'VEGETARIAN'>('all')
  const [savedDishIds, setSavedDishIds] = useState<Set<string>>(new Set())
  const [visibleCount, setVisibleCount] = useState(20)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [locationQuery, setLocationQuery] = useState('')
  const [shuffleSeed, setShuffleSeed] = useState(() => Math.random())

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

  // Location: load saved first, then ask GPS if none saved
  useEffect(() => {
    // Restore saved location from localStorage
    try {
      const saved = localStorage.getItem('qc_location')
      if (saved) {
        const { lat, lng, label } = JSON.parse(saved)
        setUserLocation({ lat, lng })
        setGpsLabel(label)
        setFilterMaxKm(5)
        return // don't auto-request GPS if we have a saved location
      }
    } catch {}

    const buildReverseLabel = (addr: Record<string, string>) => {
      const parts: string[] = []
      if (addr.road) parts.push(addr.road)
      const zone = addr.suburb || addr.neighbourhood || addr.city_district || addr.city || addr.town || addr.village
      if (zone && zone !== addr.road) parts.push(zone)
      return parts.join(', ') || addr.city || 'Cerca de ti'
    }

    const reverseGeocode = async (lat: number, lng: number) => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=16`, { headers: { 'Accept-Language': 'es' } })
        const data = await res.json()
        return buildReverseLabel(data.address)
      } catch { return null }
    }

    const onGPS = async (pos: GeolocationPosition) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      setUserLocation(loc)
      setLocationName(null)
      setFilterMaxKm(5)
      const label = await reverseGeocode(loc.lat, loc.lng) || 'Cerca de ti'
      setGpsLabel(label)
      try { localStorage.setItem('qc_location', JSON.stringify({ lat: loc.lat, lng: loc.lng, label })) } catch {}
    }

    const onGPSError = () => {
      fetch('https://ipapi.co/json/')
        .then(r => r.json())
        .then(data => { if (data.city) setLocationName(data.city) })
        .catch(() => {})
    }

    navigator.geolocation?.getCurrentPosition(onGPS, onGPSError, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 60000,
    })
  }, [])


  // Open initial dish from URL param on mount
  useEffect(() => {
    if (!initialDishId || !dishes.length) return
    const dish = dishes.find(d => d.id === initialDishId)
    if (dish) setSelectedDish(dish)
    // URL is already correct (/p/<id>), no pushState needed
  }, [initialDishId, dishes])

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

  // Server-side search with debounce
  // Índice de búsqueda — pre-construido en cliente, una sola vez
  const dishSearchIndex = useMemo(() =>
    dishes.map(d => ({
      ...d,
      _search: [d.nombre, d.descripcion ?? '', d.restaurante, d.categoriaNorm, ...(d.sabores ?? [])]
        .join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
    })),
    [dishes]
  )

  // Sugerencias — 100% cliente, instantáneas (sin red)
  const suggestions = useMemo(() => {
    if (!searchInput.trim() || searchInput.length < 2) return []
    const q = normStr(searchInput)

    // 1. Categorías QC
    const cats = [...QC_CATEGORIES]
      .filter(c => normStr(c).includes(q))
      .slice(0, 2)
      .map(c => ({ label: c, type: 'categoria' as const, count: 0 }))

    // 2. Ingrediente — si el término aparece en nombre/descripción de varios platos
    const totalMatches = dishSearchIndex.filter(d => d._search.includes(q)).length
    const nameMatches = dishSearchIndex.filter(d => normStr(d.nombre).includes(q)).length
    // Es "ingrediente" cuando hay más platos que lo mencionan que platos cuyo nombre es exactamente ese término
    const ingrediente: { label: string; type: 'ingrediente'; count: number }[] =
      totalMatches > nameMatches + 2
        ? [{ label: searchInput.trim(), type: 'ingrediente', count: totalMatches }]
        : []

    // 3. Locales
    const seenRests = new Set<string>()
    const rests: { label: string; type: 'local'; count: number }[] = []
    for (const d of dishSearchIndex) {
      if (rests.length >= 2) break
      const key = d.restaurante.toLowerCase()
      if (!seenRests.has(key) && normStr(d.restaurante).includes(q)) {
        seenRests.add(key)
        rests.push({ label: d.restaurante, type: 'local', count: 0 })
      }
    }

    // 4. Nombres de plato (solo si no hay sugerencia de ingrediente que lo cubra)
    const seenNames = new Set<string>()
    const platos: { label: string; type: 'plato'; count: number }[] = []
    for (const d of dishSearchIndex) {
      if (platos.length >= 3) break
      const key = d.nombre.toLowerCase()
      if (!seenNames.has(key) && normStr(d.nombre).includes(q)) {
        seenNames.add(key)
        platos.push({ label: d.nombre, type: 'plato', count: 0 })
      }
    }

    return [...cats, ...ingrediente, ...rests, ...platos]
  }, [searchInput, dishSearchIndex])

  // Resultados de búsqueda — también 100% cliente
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null
    const q = normStr(searchQuery)
    return dishSearchIndex.filter(d => d._search.includes(q))
  }, [searchQuery, dishSearchIndex])

  const executeSearch = useCallback((query: string) => {
    setSearchQuery(query)
    setSearchInput(query)
    setShowSuggestions(false)
    const url = new URL(window.location.href)
    if (query) url.searchParams.set('q', query)
    else url.searchParams.delete('q')
    window.history.replaceState({}, '', url.toString())
  }, [])

  // Feed dishes — use server search results if searching, otherwise local filter
  const feedDishes = useMemo(() => {
    // If we have server search results, use those directly
    if (searchResults && searchQuery.trim()) {
      return searchResults
    }

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
      const noiseScale = Math.max(0.5, maxDist * 0.25) // ruido = 25% del radio, mín 0.5km
      const withDist = filtered
        .filter(d => d.restauranteLat && d.restauranteLng)
        .map(d => {
          const dist = distanceKm(userLocation.lat, userLocation.lng, d.restauranteLat!, d.restauranteLng!)
          const noise = seededRandom(shuffleSeed, d.id) * noiseScale
          return { dish: d, dist, sortKey: dist + noise }
        })
        .filter(x => x.dist <= maxDist)
        .sort((a, b) => a.sortKey - b.sortKey)
      filtered = withDist.map(x => x.dish)
    }

    // Category filter
    if (activeCategory) {
      filtered = filtered.filter(d => d.categoriaNorm === activeCategory)
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
  }, [dishes, activeCategory, categoryScores, keywordScores, vectorScoredIds, locationName, userLocation, searchQuery, filterMeal, filterSort, filterDiet, filterMaxKm, searchResults, shuffleSeed])

  // Infinite scroll — IntersectionObserver sobre sentinel al final del feed
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => Math.min(prev + 20, feedDishes.length))
      }
    }, { rootMargin: '400px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [feedDishes.length])

  // Scroll to top + reset visibleCount on filter change
  useEffect(() => {
    setVisibleCount(20)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [activeCategory, filterMeal, filterSort, filterDiet, filterMaxKm, searchQuery, locationName, userLocation])

  // Handlers
  const handleDishTap = useCallback((d: FeedDish) => {
    setSelectedDish(d)
    setHideRelated(false)
    trackInteraction(d.id, 'TAP', d.categoriaNorm, d.precioDescuento ?? d.precio).catch(() => {})
    window.history.pushState({}, '', `/${d.restauranteSlug}/${slugify(d.nombre)}`)
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
    <div className={isDark ? 'dark' : ''} style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', background: isDark ? '#0e0e0e' : '#f5f4f1', color: isDark ? '#fff' : '#111' }}>

      {/* ─── Logo row — NO sticky, scrolls con el contenido ─── */}
      <div style={{
        padding: '10px 16px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <a href="/" style={{ textDecoration: 'none', cursor: 'pointer' }}>
          <span style={{ fontFamily: 'var(--font-feed-display), serif', fontSize: 20, fontWeight: 700, color: '#111' }}>
            Quiero<span style={{ color: '#F4A623' }}>Comer</span>
          </span>
        </a>
        <button onClick={() => setMenuOpen(true)} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 6,
          color: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </div>

      {/* ─── Sticky: search + ubicación/filtros ─── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 35,
        background: isDark ? 'rgba(14,14,14,0.97)' : 'rgba(245,244,241,0.97)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
        padding: '8px 16px 8px', display: 'flex', flexDirection: 'column', gap: 7,
      }}>

        {/* Row 1: Search bar full width */}
        <div style={{ position: 'relative' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="2.5" strokeLinecap="round"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 2 }}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={searchInputRef}
            className="feed-search-input"
            type="text" value={searchInput}
            onChange={e => { setSearchInput(e.target.value); setShowSuggestions(true) }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={e => { if (e.key === 'Enter') { executeSearch(searchInput); searchInputRef.current?.blur() } }}
            placeholder="Buscar plato, restaurante o ingrediente..."
            style={{
              width: '100%', padding: '10px 36px 10px 34px', borderRadius: 999, fontSize: 15,
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              color: isDark ? '#fff' : '#111', outline: 'none', boxSizing: 'border-box',
            }}
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); executeSearch('') }} style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'rgba(0,0,0,0.3)', zIndex: 2,
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
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)', overflow: 'hidden',
              }}>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => {
                    if (s.type === 'categoria') {
                      setActiveCategory(s.label)
                      setSearchInput('')
                      setSearchQuery('')
                      setShowSuggestions(false)
                    } else {
                      executeSearch(s.label)
                    }
                  }} style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left', borderBottom: i < suggestions.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                  }}>
                    <span style={{ fontSize: 15, flexShrink: 0 }}>
                      {s.type === 'categoria' ? '🏷️' : s.type === 'ingrediente' ? '🧂' : s.type === 'local' ? '🏪' : '🍽'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, color: '#111', margin: 0 }}>{s.label}</p>
                      <p style={{ fontSize: 10, color: 'rgba(0,0,0,0.3)', margin: '1px 0 0' }}>
                        {s.type === 'categoria' ? 'Categoría'
                          : s.type === 'ingrediente' ? `Ingrediente · ${s.count} platos`
                          : s.type === 'local' ? 'Local'
                          : 'Plato'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Row 3: Ubicación (izq) + Filtros (der) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Ubicación */}
          <button onClick={() => setLocationModalOpen(true)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: (locationName || gpsLabel) ? 'rgba(244,166,35,0.1)' : 'rgba(0,0,0,0.05)',
            border: `1px solid ${(locationName || gpsLabel) ? 'rgba(244,166,35,0.3)' : 'rgba(0,0,0,0.08)'}`,
            borderRadius: 20, padding: '6px 12px', cursor: 'pointer',
            color: (locationName || gpsLabel) ? '#c97d00' : 'rgba(0,0,0,0.5)',
            fontSize: 12, fontWeight: 500,
            minWidth: 0, maxWidth: 'calc(100% - 100px)', overflow: 'hidden',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {locationName || gpsLabel || 'Ubicación'}
            </span>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Filtros */}
          <button onClick={() => setFilterOpen(!filterOpen)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(244,166,35,0.1)',
            border: '1px solid rgba(244,166,35,0.3)',
            borderRadius: 20, padding: '6px 14px', cursor: 'pointer',
            color: '#c97d00',
            fontSize: 12, fontWeight: 500,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            Filtros
          </button>
        </div>
      </header>

      {/* ─── Filter sheet ─── */}
      {filterOpen && (
        <>
          <div onClick={() => setFilterOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.3)' }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 81,
            maxHeight: '90vh', overflowY: 'auto',
            padding: '12px 16px', boxSizing: 'border-box',
            background: '#fff',
            borderRadius: '24px 24px 0 0',
            animation: 'slideUp 0.25s ease-out',
          }}>
            <button onClick={() => setFilterOpen(false)} style={{
              position: 'absolute', top: 28, right: 16,
              background: 'none', border: 'none', color: 'rgba(0,0,0,0.35)',
              fontSize: 30, lineHeight: 1, padding: 0, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>

            <div style={{ width: 40, height: 5, background: 'rgba(0,0,0,0.12)', borderRadius: 999, margin: '0 auto 16px' }} />

            <div style={{ marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111' }}>Filtros</h2>
            </div>

            {/* Dieta */}
            <div style={{ marginBottom: 22 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="16" height="16" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M2 22 12 2l10 20" /><path d="M12 2c0 6-4 10-4 10s4 4 4 10" /></svg>
                Dieta
              </h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { id: 'all' as const, label: '🍽 Como de todo' },
                  { id: 'VEGAN' as const, label: '🌱 Vegano' },
                  { id: 'VEGETARIAN' as const, label: '🥬 Vegetariano' },
                ].map(d => (
                  <button key={d.id} onClick={() => setFilterDiet(d.id)} style={{
                    border: filterDiet === d.id ? '1.5px solid #F4A623' : '1px solid rgba(0,0,0,0.08)',
                    borderRadius: 14, padding: '10px 16px',
                    background: filterDiet === d.id ? 'rgba(244,166,35,0.07)' : '#fff',
                    color: filterDiet === d.id ? '#c97d00' : 'rgba(0,0,0,0.6)',
                    fontSize: 13, whiteSpace: 'nowrap', cursor: 'pointer',
                  }}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Distancia */}
            <div style={{ marginBottom: 22 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="16" height="16" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                Distancia
              </h3>
              <div style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 14, padding: '16px 14px', background: 'rgba(0,0,0,0.02)' }}>
                <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: '#111' }}>
                  Hasta <strong style={{ color: '#F4A623', marginLeft: 4 }}>{filterMaxKm < 20 ? `${filterMaxKm} km` : 'Sin límite'}</strong>
                </p>
                <div style={{ position: 'relative', height: 5, background: 'rgba(0,0,0,0.1)', borderRadius: 999 }}>
                  <div style={{ width: `${(filterMaxKm / 20) * 100}%`, height: '100%', background: '#F4A623', borderRadius: 999 }} />
                  <div style={{ position: 'absolute', left: `${(filterMaxKm / 20) * 100}%`, top: '50%', width: 22, height: 22, background: '#F4A623', borderRadius: 999, transform: 'translate(-50%, -50%)', boxShadow: '0 1px 4px rgba(244,166,35,0.4)' }} />
                </div>
                <input type="range" min={1} max={20} value={filterMaxKm}
                  onChange={e => setFilterMaxKm(Number(e.target.value))}
                  style={{ width: '100%', height: 22, appearance: 'none', background: 'transparent', cursor: 'pointer', position: 'relative', marginTop: -12, opacity: 0 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(0,0,0,0.35)', fontSize: 11, marginTop: 4 }}>
                  <span>1 km</span><span>5 km</span><span>10 km</span><span>20+ km</span>
                </div>
              </div>
            </div>

            {/* Momento */}
            <div style={{ marginBottom: 22 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="16" height="16" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                Momento
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { display: 'desayuno' as const, meal: 'desayuno' as const, label: 'Desayuno', icon: <svg width="20" height="20" fill="none" stroke="#f59e0b" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" /></svg> },
                  { display: 'almuerzo' as const, meal: 'almuerzo_cena' as const, label: 'Almuerzo', icon: <svg width="20" height="20" fill="none" stroke="#f97316" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /></svg> },
                  { display: 'cena' as const, meal: 'almuerzo_cena' as const, label: 'Cena', icon: <svg width="20" height="20" fill="none" stroke="#6366f1" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg> },
                ].map((m, i) => (
                  <button key={i} onClick={() => { setFilterMeal(m.meal); setFilterMealDisplay(m.display) }} style={{
                    minHeight: 68, borderRadius: 12,
                    border: filterMealDisplay === m.display ? '1.5px solid #F4A623' : '1px solid rgba(0,0,0,0.08)',
                    background: filterMealDisplay === m.display ? 'rgba(244,166,35,0.07)' : '#fff',
                    color: filterMealDisplay === m.display ? '#c97d00' : 'rgba(0,0,0,0.55)',
                    fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6,
                    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}>
                    {m.icon}
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ordenar */}
            <div style={{ marginBottom: 22 }}>
              <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#111', display: 'flex', alignItems: 'center', gap: 7 }}>
                <svg width="16" height="16" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="12" y1="18" x2="20" y2="18" /></svg>
                Ordenar por
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { id: 'recent' as const, label: 'Últimos agregados' },
                  { id: 'popular' as const, label: 'Más populares' },
                  { id: 'price-asc' as const, label: 'Precio ↑' },
                  { id: 'price-desc' as const, label: 'Precio ↓' },
                ].map(s => (
                  <button key={s.id} onClick={() => setFilterSort(s.id)} style={{
                    border: filterSort === s.id ? '1.5px solid #F4A623' : '1px solid rgba(0,0,0,0.08)',
                    borderRadius: 14, padding: '10px 16px',
                    background: filterSort === s.id ? 'rgba(244,166,35,0.07)' : '#fff',
                    color: filterSort === s.id ? '#c97d00' : '#111',
                    fontSize: 13, cursor: 'pointer',
                  }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ height: 80 }} />
          </div>

          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 82,
            padding: '12px 18px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
            background: 'linear-gradient(to top, #fff 60%, transparent)',
          }}>
            <button onClick={() => { setFilterOpen(false); setShuffleSeed(Math.random()); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={{
              width: '100%', height: 52, border: 'none', borderRadius: 16,
              background: '#F4A623', color: '#000', fontSize: 16, fontWeight: 700, cursor: 'pointer',
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
            background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 56,
            width: 280, maxWidth: '85vw',
            background: isDark ? '#141414' : '#fff',
            borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
            animation: 'slideRight 0.25s ease-out',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '18px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'}`,
            }}>
              <span style={{ fontFamily: 'var(--font-feed-display), serif', fontSize: 19, fontWeight: 700, color: '#111' }}>
                Quiero<span style={{ color: '#F4A623' }}>Comer</span>
              </span>
              <button onClick={() => setMenuOpen(false)} style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'rgba(0,0,0,0.05)', border: 'none',
                cursor: 'pointer', color: 'rgba(0,0,0,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav style={{ flex: 1, padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 2, background: isDark ? '#141414' : '#fff' }}>
              <button onClick={() => { setMenuOpen(false); setView('perfil'); window.scrollTo(0, 0) }} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 14px', borderRadius: 12,
                color: '#111', fontSize: 16, fontWeight: 600,
                background: view === 'perfil' ? 'rgba(244,166,35,0.08)' : 'transparent',
                border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                WebkitTapHighlightColor: 'transparent',
              }}>
                <span style={{ color: '#855bd8', display: 'flex', flexShrink: 0 }}>
                  <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c.7-4.2 3.8-7 8-7s7.3 2.8 8 7H4z" /></svg>
                </span>
                Mi perfil
              </button>
              <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '4px 14px' }} />
              <a href="/qr" style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 14px', borderRadius: 12,
                color: '#111', textDecoration: 'none', fontSize: 16, fontWeight: 600,
                WebkitTapHighlightColor: 'transparent',
              }}>
                <span style={{ color: '#F4A623', display: 'flex', flexShrink: 0 }}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
                  </svg>
                </span>
                ¿Tienes un local?
              </a>
              <a href="mailto:hola@quierocomer.cl" style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 14px', borderRadius: 12,
                color: isDark ? '#fff' : '#111', textDecoration: 'none', fontSize: 16, fontWeight: 600,
                WebkitTapHighlightColor: 'transparent',
              }}>
                <span style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)', display: 'flex', flexShrink: 0 }}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                  </svg>
                </span>
                Contacto
              </a>

              {/* Separador */}
              <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)', margin: '8px 14px' }} />

              {/* Toggle dark/light */}
              <button onClick={toggleTheme} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 14px', borderRadius: 12,
                color: isDark ? '#fff' : '#111', fontSize: 16, fontWeight: 600,
                background: 'transparent', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                WebkitTapHighlightColor: 'transparent',
              }}>
                <span style={{ color: isDark ? '#F4A623' : '#555', display: 'flex', flexShrink: 0 }}>
                  {isDark ? (
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round">
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  )}
                </span>
                {isDark ? 'Modo claro' : 'Modo oscuro'}
              </button>
            </nav>
          </div>
        </>
      )}

      {/* ─── Feed View ─── */}
      {view === 'feed' && (
        <>

          {/* Location dropdown anchor */}
          <div style={{ position: 'relative', padding: '0 16px' }}>

            {/* LocationModal */}
            {locationModalOpen && (
              <LocationModal
                onClose={() => setLocationModalOpen(false)}
                onConfirm={({ lat, lng, label }) => {
                  setUserLocation({ lat, lng })
                  setGpsLabel(label)
                  setLocationName(null)
                  setFilterMaxKm(5)
                  setShuffleSeed(Math.random())
                  setLocationModalOpen(false)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                  try { localStorage.setItem('qc_location', JSON.stringify({ lat, lng, label })) } catch {}
                }}
              />
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

          {/* Results count strip */}
          {feedDishes.length > 0 && (
            <div style={{ padding: '6px 16px 4px' }}>
              <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)', margin: 0 }}>
                {searchQuery.trim()
                  ? `${feedDishes.length} resultado${feedDishes.length !== 1 ? 's' : ''} para "${searchQuery}"`
                  : (userLocation || locationName)
                    ? `${feedDishes.length} plato${feedDishes.length !== 1 ? 's' : ''} cerca de ${gpsLabel || locationName}`
                    : `${feedDishes.length} plato${feedDishes.length !== 1 ? 's' : ''} disponibles`}
              </p>
            </div>
          )}

          {/* Feed masonry */}
          {feedDishes.length > 0 ? (
            <>
              <MasonryGrid
                dishes={feedDishes.slice(0, visibleCount)}
                onDishTap={handleDishTap}
                userLocation={userLocation}
              />
              {/* Sentinel — IntersectionObserver lo detecta para cargar más */}
              <div ref={sentinelRef} style={{ height: 1 }} />
              {visibleCount < feedDishes.length && (
                <div style={{ display: 'flex', gap: 10, padding: '10px 12px 40px' }}>
                  {[0, 1].map(col => (
                    <div key={col} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} className="skeleton-shimmer" style={{ aspectRatio: col === 0 ? '3/4' : '4/5', borderRadius: 14 }} />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '80px 30px', color: 'rgba(0,0,0,0.35)' }}>
              <p style={{ fontSize: 40, margin: '0 0 16px' }}>🍽</p>
              <p style={{ fontSize: 17, fontWeight: 600, margin: '0 0 8px', color: 'rgba(0,0,0,0.4)' }}>
                No encontramos platos aquí
              </p>
              <p style={{ fontSize: 14, margin: '0 0 20px', lineHeight: 1.5 }}>
                {searchQuery ? `No hay resultados para "${searchQuery}"` :
                 (locationName || gpsLabel) ? `Aún no tenemos platos en ${locationName || gpsLabel}. Prueba cambiando la ubicación.` :
                 'Intenta cambiar los filtros o la ubicación.'}
              </p>
              {(locationName || gpsLabel) && (
                <button onClick={() => { setLocationName(null); setUserLocation(null); setGpsLabel(null) }} style={{
                  padding: '10px 20px', borderRadius: 14, fontSize: 14, fontWeight: 600,
                  background: 'rgba(244,166,35,0.1)', border: '1px solid rgba(244,166,35,0.25)',
                  color: '#c97d00', cursor: 'pointer',
                }}>
                  Ver todos los platos
                </button>
              )}
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
            <button onClick={() => setView('perfil')} style={{ background: 'none', border: 'none', color: 'rgba(0,0,0,0.4)', cursor: 'pointer', padding: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
            <h2 style={{ fontFamily: 'var(--font-feed-display), serif', fontSize: 18, fontWeight: 700, color: '#111', margin: 0 }}>
              Me han gustado
            </h2>
            <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.25)' }}>({likedDishes.length})</span>
          </div>
          {likedDishes.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
              {likedDishes.map(d => (
                <div key={d.id} onClick={() => handleLikedDishTap(d)} style={{
                  position: 'relative', aspectRatio: '1', overflow: 'hidden',
                  cursor: 'pointer', background: '#f0f0f0',
                }}>
                  {d.fotoUrl ? (
                    <img src={d.fotoUrl} alt={d.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.3)', fontSize: 10, padding: 4, textAlign: 'center' }}>{d.nombre}</div>
                  )}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', padding: '20px 6px 6px' }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(0,0,0,0.3)' }}>
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
            <button onClick={() => setView('perfil')} style={{ background: 'none', border: 'none', color: 'rgba(0,0,0,0.4)', cursor: 'pointer', padding: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
            <h2 style={{ fontFamily: 'var(--font-feed-display), serif', fontSize: 18, fontWeight: 700, color: '#111', margin: 0 }}>
              Guardados
            </h2>
            <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.25)' }}>({savedDishes.length})</span>
          </div>
          <SavedList antojos={[]} saved={savedDishes} onDishTap={handleLikedDishTap} onRemove={handleRemoveSaved} />
        </div>
      )}

      {/* ─── DishModal ─── */}
      {selectedDish && (
        <FeedDishDetail
          key={selectedDish.id}
          dish={selectedDish}
          allDishes={feedDishes.some(d => d.id === selectedDish.id) ? feedDishes : [selectedDish, ...feedDishes]}
          dishPool={dishes}
          profile={profile}
          hideRelated={hideRelated}
          onClose={() => { setSelectedDish(null); window.history.replaceState({}, '', '/') }}
          onSave={handleDishSave}
          onDishTap={handleDishTap}
          onCategoryClick={(cat) => { setActiveCategory(cat); setSelectedDish(null); window.history.replaceState({}, '', '/') }}
          userLocation={userLocation}
        />
      )}

    </div>
  )
}

// ─── Seeded random per (seed, id) — deterministic noise for shuffle ───────────
function seededRandom(seed: number, id: string): number {
  let h = seed * 2654435761
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 0x9e3779b9)
    h ^= h >>> 16
  }
  return (h >>> 0) / 0xffffffff
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

'use client'

import { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { FeedDish } from '../types'
import LocationModal from '../components/LocationModal'
import { distanceKm } from '../lib/geo'
import MasonryGrid from '../components/MasonryGrid'
import FeedDishDetail from '../components/FeedDishDetail'
import SavedList from '../components/SavedList'
import ProfileView from '../components/ProfileView'
import ContactView from '../components/ContactView'
import { createEmptyProfile, getRecommendationReason, type FeedProfile } from '../lib/scoring'
import {
  trackInteraction,
  saveDish,
  unsaveDish,
  updateTasteAction,
  getSavedDishIds,
} from '../lib/feed-actions'
import { QC_PARENTS } from '../lib/categories'
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

type View = 'feed' | 'perfil' | 'all-liked' | 'all-saved' | 'contacto'

export default function NewHome({
  dishes,
  categoryScores,
  keywordScores,
  totalInteractions,
  vectorScoredIds = [],
  tasteData,
  userDiet,
  initialDishId,
  totalDishCount,
  categoryCountMap: categoryCountMapProp,
}: {
  dishes: FeedDish[]
  categoryScores: Record<string, number>
  keywordScores: Record<string, number>
  totalInteractions: number
  vectorScoredIds?: string[]
  tasteData?: { antojoSessionDate: string | null; antojoDishIds: string[]; antojoRejectIds: string[]; tasteEmbeddingsCount: number; hasGustoVector: boolean }
  userDiet?: { isVegan: boolean; isVegetarian: boolean; isGlutenFree: boolean; isLactoseFree: boolean }
  initialDishId?: string
  totalDishCount?: number
  categoryCountMap?: Record<string, number>
}) {
  const [view, setView] = useState<View>('feed')
  const [isDark, setIsDark] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  // useLayoutEffect corre antes del primer paint — sin flash
  useLayoutEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
    const mq = window.matchMedia('(min-width: 768px)')
    setIsDesktop(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev
      localStorage.setItem('qc_theme', next ? 'dark' : 'light')
      document.documentElement.classList.toggle('dark', next)
      return next
    })
  }
  const [activeDiet, setActiveDiet] = useState(userDiet)
  const [selectedDish, setSelectedDish] = useState<FeedDish | null>(null)
  const [hideRelated, setHideRelated] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [desktopMenuOpen, setDesktopMenuOpen] = useState(false)
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
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterMeal, setFilterMeal] = useState<'all' | 'desayuno' | 'almuerzo_cena'>('all')
  const [filterMealDisplay, setFilterMealDisplay] = useState<'all' | 'desayuno' | 'almuerzo' | 'cena'>('all')
  const [filterSort, setFilterSort] = useState<'default' | 'recent' | 'price-asc' | 'price-desc'>('default')
  const [quickNearby, setQuickNearby] = useState(true)
  const [quickPopular, setQuickPopular] = useState(false)
  const [filterMaxKm, setFilterMaxKm] = useState(30)
  const [filterDiet, setFilterDiet] = useState<'all' | 'VEGAN' | 'VEGETARIAN'>('all')
  const [filterCategories, setFilterCategories] = useState<Set<string>>(new Set())
  // Draft state — se usan dentro del panel, solo se aplican al hacer "Guardar cambios"
  const [draftMeal, setDraftMeal] = useState(filterMeal)
  const [draftMealDisplay, setDraftMealDisplay] = useState(filterMealDisplay)
  const [draftSort, setDraftSort] = useState<'default' | 'recent' | 'price-asc' | 'price-desc'>('default')
  const [draftMaxKm, setDraftMaxKm] = useState(filterMaxKm)
  const [draftDiet, setDraftDiet] = useState(filterDiet)
  const [draftCategories, setDraftCategories] = useState<Set<string>>(new Set())
  const [savedDishIds, setSavedDishIds] = useState<Set<string>>(new Set())
  // Server-side search/filter results — null = browse mode (use initial dishes prop)
  const [serverDishes, setServerDishes] = useState<FeedDish[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const searchFetchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [visibleCount, setVisibleCount] = useState(20)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const [headerHeight, setHeaderHeight] = useState(130)
  const [showFloatingSearch, setShowFloatingSearch] = useState(false)
  const headerVisible = useRef(true)
  const lastScrollY = useRef(0)
  const scrollTicking = useRef(false)
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

  // Load saved + viewed dish IDs on mount so they're ready before entering profile
  useEffect(() => {
    getSavedDishIds().then(ids => {
      if (ids.length > 0) setSavedDishIds(new Set(ids))
    }).catch(() => {})
    import('../lib/feed-actions').then(({ getViewedDishIds }) =>
      getViewedDishIds().then(ids => { if (ids.length > 0) setViewedDishIds(ids) })
    ).catch(() => {})
  }, [])

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

  // Categorías y parents estáticos para sugerencias
  const ALL_QC_TERMS = useMemo(() => {
    const terms: string[] = []
    // Parents (categorías madre)
    const parents = ['Comida rápida','Pizza','Sushi','Japonesa','China','Thai','India','Asiática','Peruana','Mariscos','Parrilla','Pastas','Venezolana','Mexicana','Pollo','Empanadas','Saludable','Desayunos','Postres','Bebidas','Entradas']
    // Leaves (subcategorías)
    const leaves = ['Hamburguesas','Completos','Sándwiches','Papas fritas','Pizzas','Ramen','Gyoza','Ceviches','Pollo y alitas','Ensaladas','Bowls','Cafetería','Amasandería','Helados','Smoothies','Milkshakes']
    return [...new Set([...parents, ...leaves])]
  }, [])

  // Sugerencias unificadas — 100% cliente, instantáneas (sin red)
  const searchSuggestions = useMemo(() => {
    const trimmed = searchInput.trim()
    if (trimmed.length < 2) return null
    const q = normStr(trimmed)

    const results: { text: string; type: 'plato' | 'restaurante' | 'categoría' | 'ingrediente' }[] = []

    // 1. Categorías QC (estáticas)
    for (const cat of ALL_QC_TERMS) {
      if (normStr(cat).includes(q)) {
        results.push({ text: cat, type: 'categoría' })
        if (results.filter(r => r.type === 'categoría').length >= 3) break
      }
    }

    // 2. Buscar en platos
    const matches = dishSearchIndex.filter(d => d._search.includes(q))

    // Restaurantes que hacen match en nombre
    const seenRestaurants = new Set<string>()
    for (const d of matches) {
      if (normStr(d.restaurante).includes(q) && !seenRestaurants.has(d.restaurante)) {
        seenRestaurants.add(d.restaurante)
        results.push({ text: d.restaurante, type: 'restaurante' })
        if (seenRestaurants.size >= 3) break
      }
    }

    // Ingredientes / sabores que hacen match
    const seenIngredients = new Set<string>()
    for (const d of matches) {
      for (const sab of (d.sabores ?? [])) {
        if (normStr(sab).includes(q) && !seenIngredients.has(sab)) {
          seenIngredients.add(sab)
          results.push({ text: sab, type: 'ingrediente' })
          if (seenIngredients.size >= 3) break
        }
      }
    }

    // Nombres de platos que hacen match directo en el nombre
    const seenDishes = new Set<string>()
    for (const d of matches) {
      if (normStr(d.nombre).includes(q) && !seenDishes.has(d.nombre)) {
        seenDishes.add(d.nombre)
        results.push({ text: d.nombre, type: 'plato' })
        if (seenDishes.size >= 5) break
      }
    }

    return results.length ? results : null
  }, [searchInput, dishSearchIndex, ALL_QC_TERMS])

  const [showSuggestions, setShowSuggestions] = useState(false)

  const executeSearch = useCallback((query: string) => {
    const trimmed = query.trim()
    setSearchQuery(trimmed)
    setSearchInput(trimmed)
    // Clear category pill when searching so it doesn't conflict with the query
    if (trimmed) setActiveCategory(null)
    if (typeof window !== 'undefined') {
      const url = trimmed ? `/?q=${encodeURIComponent(trimmed)}` : '/'
      window.history.replaceState(null, '', url)
    }
  }, [])

  // Server-side fetch — triggered by search, category pill, diet, location, distance filter
  const fetchServerDishes = useCallback(async (params: {
    q?: string; categoryPill?: string | null; diet?: string
    maxKm?: number; categories?: string[]; locationName?: string | null
    lat?: number | null; lng?: number | null
  }) => {
    setIsSearching(true)
    try {
      const url = new URLSearchParams()
      if (params.q) url.set('q', params.q)
      if (params.categoryPill) url.set('categoryPill', params.categoryPill)
      if (params.diet && params.diet !== 'all') url.set('diet', params.diet)
      if (params.maxKm && params.maxKm < 30) url.set('maxKm', String(params.maxKm))
      if (params.categories?.length) url.set('categories', params.categories.join(','))
      if (params.locationName) url.set('locationName', params.locationName)
      if (params.lat != null) url.set('lat', String(params.lat))
      if (params.lng != null) url.set('lng', String(params.lng))
      const res = await fetch(`/api/dishes/search?${url}`)
      if (!res.ok) throw new Error()
      const data: FeedDish[] = await res.json()
      setServerDishes(data)
    } catch {
      setServerDishes(null) // en error, mostrar platos iniciales en vez de resultados stale
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Determine if any filter requires a server fetch
  const needsServerFetch = !!(
    searchQuery || activeCategory || filterDiet !== 'all' ||
    filterCategories.size > 0 || locationName ||
    (filterMaxKm < 30 && userLocation)
  )

  useEffect(() => {
    if (!needsServerFetch) {
      setServerDishes(null)
      return
    }
    // Debounce for search typing; immediate for other filters
    const delay = searchQuery && !activeCategory && filterDiet === 'all' && filterCategories.size === 0 ? 350 : 0
    if (searchFetchRef.current) clearTimeout(searchFetchRef.current)
    searchFetchRef.current = setTimeout(() => {
      fetchServerDishes({
        q: searchQuery,
        categoryPill: activeCategory,
        diet: filterDiet,
        maxKm: filterMaxKm,
        categories: [...filterCategories],
        locationName,
        lat: userLocation?.lat,
        lng: userLocation?.lng,
      })
    }, delay)
    return () => { if (searchFetchRef.current) clearTimeout(searchFetchRef.current) }
  }, [searchQuery, activeCategory, filterDiet, filterCategories, filterMeal, filterMaxKm, locationName, userLocation, needsServerFetch, fetchServerDishes])

  // Feed dishes — search results como base, luego aplica todos los filtros encima
  const feedDishes = useMemo(() => {
    // Base: server results when filtered/searching, initial dishes when browsing
    let filtered = (serverDishes ?? dishes).filter(d => d.fotoUrl)

    // Client-side category/diet/meal filters on initial dishes (when not in server-fetch mode)
    if (!serverDishes) {
      // Category filter
      const matchesCategory = (d: (typeof filtered)[0], cat: string) =>
        (d.categoriaParent ?? d.categoriaNorm) === cat || d.categoriaNorm === cat || d.cuisineTag === cat
      if (activeCategory) filtered = filtered.filter(d => matchesCategory(d, activeCategory))
      else if (filterCategories.size > 0) filtered = filtered.filter(d => [...filterCategories].some(cat => matchesCategory(d, cat)))
      if (filterDiet === 'VEGAN') filtered = filtered.filter(d => d.dieta.tipo === 'VEGAN')
      else if (filterDiet === 'VEGETARIAN') filtered = filtered.filter(d => d.dieta.tipo === 'VEGAN' || d.dieta.tipo === 'VEGETARIAN')
    }

    // Meal filter — solo se aplica si el usuario lo eligió explícitamente (default = 'all')
    if (filterMeal !== 'all') filtered = filtered.filter(d => d.mealTime === filterMeal)

    // Distance filter + sort — client-side with precise formula
    if (userLocation) {
      const maxDist = filterMaxKm
      const noiseScale = Math.max(0.5, maxDist * 0.25)
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

    // Sort
    let combined: FeedDish[]
    if (filterSort === 'price-asc') {
      combined = [...filtered].sort((a, b) => (a.precioDescuento ?? a.precio) - (b.precioDescuento ?? b.precio))
    } else if (filterSort === 'price-desc') {
      combined = [...filtered].sort((a, b) => (b.precioDescuento ?? b.precio) - (a.precioDescuento ?? a.precio))
    } else if (filterSort === 'recent') {
      combined = [...filtered].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    } else if (quickPopular) {
      combined = [...filtered].sort((a, b) => b.popularityScore - a.popularityScore)
    } else if (quickNearby && userLocation) {
      combined = filtered
    } else {
      // Default: vector rank + category/keyword scoring
      const vectorRank = vectorScoredIds.length > 0 && !activeCategory
        ? new Map(vectorScoredIds.map((id, i) => [id, 1 - i / vectorScoredIds.length]))
        : undefined
      combined = filtered
        .map(d => {
          let score = 0
          const popBase = Math.min((d.popularityScore ?? 0) / 100, 1) * 0.3
          if (vectorRank) {
            const vScore = vectorRank.get(d.id) ?? 0
            const catRaw = categoryScores[d.categoriaNorm] ?? 0
            const catNorm = catRaw > 0 ? Math.min(Math.log2(catRaw + 1) / 6, 1) : 0
            score = vScore * 0.6 + catNorm * 0.4 + popBase
          } else {
            score += popBase
            score += Math.min((categoryScores[d.categoriaNorm] ?? 0) * 0.2, 8)
          }
          return { dish: d, score }
        })
        .sort((a, b) => b.score - a.score)
        .map(s => s.dish)
    }

    // Max 3 consecutive same category + max 2 consecutive same restaurant
    const final: FeedDish[] = []
    const rem = [...combined]
    while (rem.length > 0) {
      const recent = final.slice(-3).map(d => d.categoriaNorm)
      const allSameCat = recent.length === 3 && recent.every(c => c === recent[0])
      const recentRest = final.slice(-2).map(d => d.restauranteId)
      const allSameRest = recentRest.length === 2 && recentRest[0] === recentRest[1]
      if (allSameCat || allSameRest) {
        const blockedCat = allSameCat ? recent[0] : null
        const blockedRest = allSameRest ? recentRest[0] : null
        const diffIdx = rem.findIndex(d =>
          (!blockedCat || d.categoriaNorm !== blockedCat) &&
          (!blockedRest || d.restauranteId !== blockedRest)
        )
        if (diffIdx >= 0) { final.push(rem.splice(diffIdx, 1)[0]); continue }
      }
      final.push(rem.shift()!)
    }
    return final
  }, [serverDishes, dishes, activeCategory, filterCategories, categoryScores, keywordScores, vectorScoredIds, userLocation, filterMeal, filterSort, quickNearby, quickPopular, filterDiet, filterMaxKm, shuffleSeed])

  // Counts por parent category — usa datos cacheados del servidor (BD completa) si están disponibles,
  // si no calcula client-side sobre los platos iniciales como fallback
  const categoryCountMap = useMemo(() => {
    if (categoryCountMapProp) return categoryCountMapProp
    const map: Record<string, number> = {}
    const base = dishes.filter(d => d.fotoUrl)
    for (const d of base) {
      const parent = d.categoriaParent ?? d.categoriaNorm
      if (parent) map[parent] = (map[parent] ?? 0) + 1
    }
    return map
  }, [dishes])

  // Preview count para el botón "Guardar cambios" — aprox sobre resultado actual
  const draftDishCount = useMemo(() => {
    let filtered = (serverDishes ?? dishes).filter(d => d.fotoUrl)
    if (userLocation) {
      filtered = filtered
        .filter(d => d.restauranteLat && d.restauranteLng)
        .filter(d => distanceKm(userLocation.lat, userLocation.lng, d.restauranteLat!, d.restauranteLng!) <= draftMaxKm)
    }
    if (draftMeal !== 'all') filtered = filtered.filter(d => d.mealTime === draftMeal)
    if (draftDiet === 'VEGAN') filtered = filtered.filter(d => d.dieta.tipo === 'VEGAN')
    else if (draftDiet === 'VEGETARIAN') filtered = filtered.filter(d => d.dieta.tipo === 'VEGAN' || d.dieta.tipo === 'VEGETARIAN')
    if (draftCategories.size > 0) filtered = filtered.filter(d => draftCategories.has(d.categoriaNorm))
    return filtered.length
  }, [dishes, serverDishes, userLocation, draftMaxKm, draftMeal, draftDiet, draftCategories])

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
  }, [activeCategory, filterMeal, filterSort, quickNearby, quickPopular, filterDiet, filterMaxKm, searchQuery, locationName, userLocation])

  // Header height observer
  useLayoutEffect(() => {
    const el = headerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeaderHeight(el.offsetHeight))
    ro.observe(el)
    setHeaderHeight(el.offsetHeight)
    return () => ro.disconnect()
  }, [view])

  // Floating search bar: se oculta cuando el header es visible, aparece al subir cuando no lo es
  useEffect(() => {
    if (isDesktop || !headerRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        headerVisible.current = entry.isIntersecting
        if (entry.isIntersecting) setShowFloatingSearch(false)
      },
      { threshold: 0.55 }
    )
    observer.observe(headerRef.current)
    return () => observer.disconnect()
  }, [isDesktop])

  useEffect(() => {
    if (isDesktop) return
    const onScroll = () => {
      if (scrollTicking.current) return
      scrollTicking.current = true
      requestAnimationFrame(() => {
        const y = window.scrollY
        const headerH = headerRef.current?.offsetHeight ?? 160
        if (headerVisible.current) {
          setShowFloatingSearch(false)
        } else if (y < lastScrollY.current - 4) {
          setShowFloatingSearch(true)
        } else if (y > lastScrollY.current + 4) {
          setShowFloatingSearch(false)
        }
        lastScrollY.current = y
        scrollTicking.current = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isDesktop])

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

  // Count of filters the user explicitly changed (shown as badge on "Más filtros" pill)
  const activeFilterCount = (filterDiet !== 'all' ? 1 : 0) + (filterSort !== 'default' ? 1 : 0) + (filterMaxKm < 30 ? 1 : 0) + (filterMeal !== 'all' ? 1 : 0) + filterCategories.size

  // Pills helpers — usados tanto en Row 3 como en el floating header
  const openFilters = () => {
    setDraftSort(filterSort)
    setDraftMaxKm(filterMaxKm)
    setDraftDiet(filterDiet)
    setDraftMeal(filterMeal)
    setDraftMealDisplay(filterMealDisplay)
    setDraftCategories(new Set(filterCategories))
    setFilterOpen(true)
  }
  type PillType = 'nearby' | 'popular' | 'green' | 'default'
  const pillActiveColor = (type: PillType) => type === 'popular' ? '#D32F2F' : type === 'green' ? '#2E7D32' : '#c97d00'
  const pillStyle = (active: boolean, type: PillType = 'default') => {
    const ac = pillActiveColor(type)
    return {
      flex: 1, padding: '9px 4px', borderRadius: 999 as const, fontSize: 14, fontWeight: 500,
      cursor: 'pointer' as const, whiteSpace: 'nowrap' as const,
      textAlign: 'center' as const, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
      background: active
        ? (type === 'popular' ? (isDark ? 'rgba(211,47,47,0.15)' : 'rgba(211,47,47,0.1)') : type === 'green' ? (isDark ? 'rgba(46,125,50,0.18)' : 'rgba(46,125,50,0.12)') : (isDark ? 'rgba(244,166,35,0.18)' : 'rgba(244,166,35,0.15)'))
        : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
      border: `1px solid ${active ? (type === 'popular' ? 'rgba(211,47,47,0.45)' : type === 'green' ? 'rgba(46,125,50,0.4)' : 'rgba(244,166,35,0.5)') : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)')}`,
      color: active ? ac : (isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)'),
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: isDark ? '#0e0e0e' : '#f5f4f1', color: isDark ? '#fff' : '#111' }}>

      {/* ─── Desktop Top Navbar ─── */}
      {isDesktop && (
        <nav style={{
          height: 64,
          background: isDark ? 'rgba(14,14,14,0.97)' : 'rgba(255,255,255,0.97)',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
          display: 'flex', alignItems: 'center',
        }}><div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px' }}>
          {/* Logo */}
          <a href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-feed-display), serif', fontSize: 19, fontWeight: 700, color: isDark ? '#fff' : '#111', letterSpacing: '-0.3px' }}>
              Quiero<span style={{ color: '#F4A623' }}>Comer</span>
            </span>
          </a>

          {/* Search bar — centro, ocupa todo el espacio */}
          <form style={{ flex: 1, position: 'relative', maxWidth: 480, margin: '0 auto' }} onSubmit={e => { e.preventDefault(); executeSearch(searchInput); (document.activeElement as HTMLElement)?.blur() }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'} strokeWidth="2.5" strokeLinecap="round"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 2 }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              className="feed-search-input"
              type="search" value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Buscar en QuieroComer"
              style={{
                width: '100%', padding: '9px 34px 9px 34px', borderRadius: 999, fontSize: 17,
                background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                color: isDark ? '#fff' : '#111', outline: 'none', boxSizing: 'border-box',
              }}
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); executeSearch('') }} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)', zIndex: 38,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
          </form>

          {/* Hamburger menu desktop */}
          <div style={{ position: 'relative', flexShrink: 0, marginLeft: 'auto' }}>
            <button
              onClick={() => setDesktopMenuOpen(o => !o)}
              style={{
                width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: desktopMenuOpen
                  ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)')
                  : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="16" height="14" viewBox="0 0 16 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="0" y1="1" x2="16" y2="1"/>
                <line x1="0" y1="7" x2="16" y2="7"/>
                <line x1="0" y1="13" x2="16" y2="13"/>
              </svg>
            </button>

            {desktopMenuOpen && (
              <>
                {/* Overlay para cerrar */}
                <div onClick={() => setDesktopMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 148 }} />

                {/* Dropdown */}
                <div style={{
                  position: 'absolute', top: 44, right: 0, zIndex: 149,
                  background: isDark ? '#1e1e1e' : '#fff',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                  borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                  padding: '8px 0', minWidth: 200,
                  display: 'flex', flexDirection: 'column',
                }}>
                  {/* Mi perfil */}
                  <button onClick={() => { setView('perfil'); window.scrollTo(0, 0); setDesktopMenuOpen(false) }} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 18px', background: 'none', border: 'none', cursor: 'pointer',
                    color: isDark ? 'rgba(255,255,255,0.85)' : '#111', fontSize: 14, textAlign: 'left', width: '100%',
                  }}>
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c.7-4.2 3.8-7 8-7s7.3 2.8 8 7H4z"/></svg>
                    Mi perfil
                  </button>

                  {/* Tienes un local */}
                  <a href="/qr" onClick={() => setDesktopMenuOpen(false)} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 18px', color: isDark ? 'rgba(255,255,255,0.85)' : '#111',
                    fontSize: 14, textDecoration: 'none', width: '100%', boxSizing: 'border-box',
                  }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    Tienes un local
                  </a>

                  {/* Contáctanos */}
                  <a href="mailto:hola@quierocomer.cl" onClick={() => setDesktopMenuOpen(false)} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 18px', color: isDark ? 'rgba(255,255,255,0.85)' : '#111',
                    fontSize: 14, textDecoration: 'none', width: '100%', boxSizing: 'border-box',
                  }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    Contáctanos
                  </a>

                  <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', margin: '6px 14px' }} />

                  {/* Modo oscuro/claro */}
                  <button onClick={() => { toggleTheme(); setDesktopMenuOpen(false) }} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 18px', background: 'none', border: 'none', cursor: 'pointer',
                    color: isDark ? 'rgba(255,255,255,0.85)' : '#111', fontSize: 14, textAlign: 'left', width: '100%',
                  }}>
                    {isDark
                      ? <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                      : <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                    }
                    {isDark ? 'Modo claro' : 'Modo oscuro'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>{/* end inner max-width wrapper */}
        </nav>
      )}

      {/* ─── Main content ─── */}
      <div style={{
        ...(isDesktop ? { maxWidth: 1100, margin: '0 auto' } : { maxWidth: 480, margin: '0' }),
      }}>


      {/* ─── Sticky: search / ubicación + filtros — mobile only ─── */}
      <header
        ref={headerRef}
        style={{
          display: isDesktop ? 'none' : 'flex',
          background: isDark ? 'rgba(14,14,14,0.97)' : 'rgba(245,244,241,0.97)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          padding: '8px 16px 8px', flexDirection: 'column', gap: 7,
        }}
      >


        {/* Row 2: Search bar */}
        {(() => {
          const hasActiveFilters = filterSort !== 'default' || quickNearby || quickPopular || filterMaxKm !== 30 || filterDiet !== 'all' || !!activeCategory || filterCategories.size > 0
          return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, marginTop: 12 }}>
        <form style={{ position: 'relative', flex: 1 }} onSubmit={e => { e.preventDefault(); executeSearch(searchInput); searchInputRef.current?.blur(); setShowSuggestions(false) }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'} strokeWidth="2.5" strokeLinecap="round"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 2 }}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={searchInputRef}
            className="feed-search-input"
            type="text" value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="Buscar en QuieroComer"
            autoComplete="off"
            style={{
              width: '100%', padding: '12px 38px 12px 36px', fontSize: 17,
              borderRadius: showSuggestions && searchSuggestions?.length ? '20px 20px 0 0' : 999,
              background: isDark ? 'rgba(255,255,255,0.08)' : '#fff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
              color: isDark ? '#fff' : '#111', outline: 'none', boxSizing: 'border-box',
            }}
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(''); executeSearch(''); setShowSuggestions(false) }} style={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)', zIndex: 38,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
          {/* Dropdown de sugerencias — se renderiza vía portal en body para escapar todo stacking context */}
          {showSuggestions && searchSuggestions && typeof document !== 'undefined' && createPortal(
            (() => {
              const r = searchInputRef.current?.getBoundingClientRect()
              if (!r) return null
              return (
                <div style={{
                  position: 'fixed', top: r.bottom - 2, left: r.left, width: r.width, zIndex: 99999,
                  background: isDark ? 'rgba(40,40,40,1)' : '#fff',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
                  borderTop: 'none',
                  borderRadius: '0 0 20px 20px', overflow: 'hidden',
                  boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)',
                  clipPath: 'inset(0 -30px -30px -30px)',
                  fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
                }}>
                  <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', margin: '0 14px' }} />
                  {searchSuggestions.map((s, i) => (
                    <button
                      key={`${s.type}-${s.text}`}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { executeSearch(s.text); setShowSuggestions(false) }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
                        color: isDark ? 'rgba(255,255,255,0.85)' : '#111', fontSize: 15, textAlign: 'left',
                        fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
                        borderTop: i > 0 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none',
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0, opacity: 0.35 }}>
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                      <span style={{ flex: 1 }}>{s.text}</span>
                      <span style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.32)', fontStyle: 'italic', flexShrink: 0 }}>{s.type}</span>
                    </button>
                  ))}
                </div>
              )
            })(),
            document.body
          )}
        </form>{/* end search input */}
        <button onClick={() => setMenuOpen(true)} style={{
          flexShrink: 0, border: 'none', cursor: 'pointer', padding: 0,
          width: 49, height: 49, borderRadius: '50%',
          background: isDark ? 'rgba(255,255,255,0.10)' : '#fff',
          boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.10)',
          color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        </div>
          )
        })()}{/* end Row 2 */}

        {/* Row 3: Quick-filter pills */}
        <div style={{ display: view === 'perfil' || view === 'contacto' ? 'none' : 'flex', alignItems: 'center', gap: 6, marginBottom: 8, marginTop: 8 }}>
          <button onClick={() => setQuickNearby(p => !p)} style={pillStyle(quickNearby, 'nearby')}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            Cerca
          </button>
          <button onClick={() => setQuickPopular(p => !p)} style={pillStyle(quickPopular, 'popular')}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
            </svg>
            Popular
          </button>
          <button onClick={() => setFilterDiet(filterDiet !== 'all' ? 'all' : 'VEGETARIAN')} style={pillStyle(filterDiet !== 'all', 'green')}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
            </svg>
            Veggie
          </button>
          <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
            <button onClick={openFilters} style={pillStyle(activeFilterCount > 0, 'default')}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
                <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
                <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
              </svg>
              Filtros
            </button>
            {activeFilterCount > 0 && (
              <span style={{
                position: 'absolute', top: -5, right: -5, pointerEvents: 'none',
                background: '#F4A623', color: '#fff',
                borderRadius: 999, fontSize: 10, fontWeight: 700,
                minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px', lineHeight: 1, zIndex: 1,
              }}>{activeFilterCount}</span>
            )}
          </div>
        </div>

        {/* Row 4: Ubicación (izq) + platos encontrados (der) */}
        <div style={{ display: view === 'perfil' || view === 'contacto' ? 'none' : 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => setLocationModalOpen(true)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: (locationName || gpsLabel) ? '#e09200' : isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)',
            fontSize: 15, fontWeight: 400,
            flex: 1, minWidth: 0, overflow: 'hidden',
          }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {locationName || gpsLabel || 'Selecciona tu dirección'}
            </span>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          <span style={{
            fontSize: 14, fontWeight: 400,
            color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
            flexShrink: 0, paddingLeft: 8,
          }}>
            {(needsServerFetch || filterMeal !== 'all')
              ? `${feedDishes.length.toLocaleString('es-CL')} platos`
              : totalDishCount
                ? `+${totalDishCount.toLocaleString('es-CL')} platos`
                : `${feedDishes.length.toLocaleString('es-CL')} platos`}
          </span>
        </div>
      </header>

      {/* ─── Floating search bar — aparece al subir el scroll — mobile only ─── */}
      {!isDesktop && view !== 'perfil' && view !== 'contacto' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 36,
          padding: '10px 16px',
          background: isDark ? 'rgba(14,14,14,0.97)' : 'rgba(245,244,241,0.97)',
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          transform: showFloatingSearch ? 'translateY(0)' : 'translateY(-110%)',
          transition: showFloatingSearch ? 'transform 0.28s cubic-bezier(0.0, 0.0, 0.2, 1)' : 'none',
          boxShadow: showFloatingSearch ? '0 2px 16px rgba(0,0,0,0.10)' : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <form style={{ position: 'relative', flex: 1 }} onSubmit={e => { e.preventDefault(); if (searchInput.trim()) executeSearch(searchInput.trim()); (document.activeElement as HTMLElement)?.blur() }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.28)'} strokeWidth="2.5" strokeLinecap="round"
              style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="search"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Buscar en QuieroComer"
              className="feed-floating-input"
              style={{
                width: '100%', padding: '12px 38px 12px 36px',
                borderRadius: 999, fontSize: 17,
                background: isDark ? 'rgba(255,255,255,0.08)' : '#fff',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
                boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.06)',
                color: isDark ? '#fff' : '#111', outline: 'none', boxSizing: 'border-box',
              }}
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); executeSearch('') }} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)',
              }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" />
                </svg>
              </button>
            )}
          </form>
          <button onClick={() => setMenuOpen(true)} style={{
            flexShrink: 0, border: 'none', cursor: 'pointer', padding: 0,
            width: 49, height: 49, borderRadius: '50%',
            background: isDark ? 'rgba(255,255,255,0.10)' : '#fff',
            boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.10)',
            color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          </div>
          {/* Pills de filtro en el floating header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <button onClick={() => setQuickNearby(p => !p)} style={pillStyle(quickNearby, 'nearby')}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              Cerca
            </button>
            <button onClick={() => setQuickPopular(p => !p)} style={pillStyle(quickPopular, 'popular')}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
              </svg>
              Popular
            </button>
            <button onClick={() => setFilterDiet(filterDiet !== 'all' ? 'all' : 'VEGETARIAN')} style={pillStyle(filterDiet !== 'all', 'green')}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
                <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
              </svg>
              Veggie
            </button>
            <button onClick={openFilters} style={pillStyle(false, 'default')}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
                <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
                <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
              </svg>
              Filtros
            </button>
          </div>
        </div>
      )}

      {/* ─── Filter sheet ─── */}
      {filterOpen && (
        <>
          <div onClick={() => setFilterOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,0.3)' }} />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 81,
            maxHeight: 'min(88vh, calc(100dvh - 72px))',
            display: 'flex', flexDirection: 'column',
            background: isDark ? '#1a1a1a' : '#fff',
            borderRadius: '24px 24px 0 0',
            animation: 'slideUp 0.25s ease-out',
            overflow: 'hidden',
          }}>
            {/* X fija arriba a la derecha */}
            <button onClick={() => setFilterOpen(false)} style={{
              position: 'absolute', top: 14, right: 16, zIndex: 2,
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              border: 'none', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
              fontSize: 22, lineHeight: 1, cursor: 'pointer', borderRadius: '50%',
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>

            {/* Contenido scrolleable — incluye título + filtros */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '20px 16px calc(16px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
              {/* Drag handle + título dentro del scroll */}
              <div style={{ width: 40, height: 5, background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)', borderRadius: 999, margin: '0 auto 16px' }} />
              <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-feed-display), serif', color: isDark ? '#fff' : '#111' }}>Filtros</h2>

            {/* Distancia */}
            <div style={{ marginBottom: 22 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Distancia
              </h3>
              <div style={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 14, padding: '16px 14px', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' }}>
                <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: isDark ? '#fff' : '#111' }}>
                  Hasta <strong style={{ color: '#F4A623', marginLeft: 4 }}>{draftMaxKm} km</strong>
                </p>
                <div style={{ position: 'relative', height: 5, background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)', borderRadius: 999 }}>
                  <div style={{ width: `${(draftMaxKm / 30) * 100}%`, height: '100%', background: '#F4A623', borderRadius: 999 }} />
                  <div style={{ position: 'absolute', left: `${(draftMaxKm / 30) * 100}%`, top: '50%', width: 22, height: 22, background: '#F4A623', borderRadius: 999, transform: 'translate(-50%, -50%)', boxShadow: '0 1px 4px rgba(244,166,35,0.4)' }} />
                </div>
                <input type="range" min={1} max={30} value={draftMaxKm}
                  onChange={e => setDraftMaxKm(Number(e.target.value))}
                  style={{ width: '100%', height: 22, appearance: 'none', background: 'transparent', cursor: 'pointer', position: 'relative', marginTop: -12, opacity: 0 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)', fontSize: 11, marginTop: 4 }}>
                  <span>1 km</span><span>10 km</span><span>20 km</span><span>30 km</span>
                </div>
              </div>
            </div>

            {/* Dieta */}
            <div style={{ marginBottom: 22 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Dieta
              </h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  {
                    id: 'all' as const, label: 'Como de todo',
                    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>,
                    activeColor: '#c97d00', activeBg: 'rgba(244,166,35,0.07)', activeBorder: '#F4A623',
                  },
                  {
                    id: 'VEGETARIAN' as const, label: 'Veggie',
                    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
                      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
                    </svg>,
                    activeColor: '#2E7D32', activeBg: 'rgba(46,125,50,0.08)', activeBorder: 'rgba(46,125,50,0.5)',
                  },
                  {
                    id: 'VEGAN' as const, label: 'Vegano',
                    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22V11"/>
                      <path d="M12 11a6 6 0 0 0-6-6c0 3.31 2.69 6 6 6z"/>
                      <path d="M12 11a6 6 0 0 1 6-6c0 3.31-2.69 6-6 6z"/>
                      <path d="M12 17a5 5 0 0 0-5-5c0 2.76 2.24 5 5 5z"/>
                      <path d="M12 17a5 5 0 0 1 5-5c0 2.76-2.24 5-5 5z"/>
                    </svg>,
                    activeColor: '#2E7D32', activeBg: 'rgba(46,125,50,0.08)', activeBorder: 'rgba(46,125,50,0.5)',
                  },
                ].map(d => (
                  <button key={d.id} onClick={() => setDraftDiet(d.id)} style={{
                    border: draftDiet === d.id ? `1.5px solid ${d.activeBorder}` : `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
                    borderRadius: 14, padding: '10px 16px',
                    display: 'flex', alignItems: 'center', gap: 7,
                    background: draftDiet === d.id ? d.activeBg : isDark ? '#2a2a2a' : '#fff',
                    color: draftDiet === d.id ? d.activeColor : isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                    fontSize: 13, whiteSpace: 'nowrap', cursor: 'pointer',
                  }}>
                    {d.icon}
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Categorías */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Categorías
                </h3>
                {draftCategories.size > 0 && (
                  <button onClick={() => setDraftCategories(new Set())} style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Limpiar
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {QC_PARENTS
                  .filter(cat => (categoryCountMap[cat] ?? 0) > 0)
                  .sort((a, b) => (categoryCountMap[b] ?? 0) - (categoryCountMap[a] ?? 0))
                  .map(cat => {
                    const active = draftCategories.has(cat)
                    const count = categoryCountMap[cat] ?? 0
                    return (
                      <button key={cat} onClick={() => {
                        const next = new Set(draftCategories)
                        if (active) next.delete(cat)
                        else next.add(cat)
                        setDraftCategories(next)
                      }} style={{
                        border: active ? '1.5px solid #F4A623' : `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
                        borderRadius: 14, padding: '8px 14px',
                        background: active ? 'rgba(244,166,35,0.07)' : isDark ? '#2a2a2a' : '#fff',
                        color: active ? '#c97d00' : isDark ? 'rgba(255,255,255,0.7)' : '#111',
                        fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                      }}>
                        {cat}
                        <span style={{ fontSize: 11, color: active ? '#c97d00' : isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }}>({count})</span>
                      </button>
                    )
                  })
                }
              </div>
            </div>

            {/* Momento */}
            <div style={{ marginBottom: 22 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Momento
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {[
                  { display: 'all' as const, meal: 'all' as const, label: 'Todo el día', icon: <svg width="20" height="20" fill="none" stroke="#F4A623" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
                  { display: 'desayuno' as const, meal: 'desayuno' as const, label: 'Desayuno', icon: <svg width="20" height="20" fill="none" stroke="#f59e0b" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" /></svg> },
                  { display: 'almuerzo' as const, meal: 'almuerzo_cena' as const, label: 'Almuerzo', icon: <svg width="20" height="20" fill="none" stroke="#f97316" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /></svg> },
                  { display: 'cena' as const, meal: 'almuerzo_cena' as const, label: 'Cena', icon: <svg width="20" height="20" fill="none" stroke="#6366f1" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg> },
                ].map((m, i) => (
                  <button key={i} onClick={() => { setDraftMeal(m.meal); setDraftMealDisplay(m.display) }} style={{
                    minHeight: 68, borderRadius: 12,
                    border: draftMealDisplay === m.display ? '1.5px solid #F4A623' : `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
                    background: draftMealDisplay === m.display ? 'rgba(244,166,35,0.07)' : isDark ? '#2a2a2a' : '#fff',
                    color: draftMealDisplay === m.display ? '#c97d00' : isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)',
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
              <h3 style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Ordenar por
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {/* Quick toggles — mismos que las pills del home */}
                <button onClick={() => setQuickNearby(p => !p)} style={{
                  border: quickNearby ? '1.5px solid #c97d00' : `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
                  borderRadius: 14, padding: '10px 16px',
                  background: quickNearby ? 'rgba(244,166,35,0.08)' : isDark ? '#2a2a2a' : '#fff',
                  color: quickNearby ? '#c97d00' : isDark ? 'rgba(255,255,255,0.7)' : '#111',
                  fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  Cerca
                </button>
                <button onClick={() => setQuickPopular(p => !p)} style={{
                  border: quickPopular ? '1.5px solid #D32F2F' : `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
                  borderRadius: 14, padding: '10px 16px',
                  background: quickPopular ? 'rgba(211,47,47,0.08)' : isDark ? '#2a2a2a' : '#fff',
                  color: quickPopular ? '#D32F2F' : isDark ? 'rgba(255,255,255,0.7)' : '#111',
                  fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                  Popular
                </button>
                {/* Sort options */}
                {[
                  { id: 'recent' as const, label: 'Últimos agregados' },
                  { id: 'price-asc' as const, label: 'Precio ↑' },
                  { id: 'price-desc' as const, label: 'Precio ↓' },
                ].map(s => (
                  <button key={s.id} onClick={() => setDraftSort(draftSort === s.id ? 'default' : s.id)} style={{
                    border: draftSort === s.id ? '1.5px solid #F4A623' : `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
                    borderRadius: 14, padding: '10px 16px',
                    background: draftSort === s.id ? 'rgba(244,166,35,0.07)' : isDark ? '#2a2a2a' : '#fff',
                    color: draftSort === s.id ? '#c97d00' : isDark ? 'rgba(255,255,255,0.7)' : '#111',
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
            background: isDark ? 'linear-gradient(to top, #1a1a1a 60%, transparent)' : 'linear-gradient(to top, #fff 60%, transparent)',
          }}>
            <button onClick={() => {
              setFilterSort(draftSort)
              setFilterMaxKm(draftMaxKm)
              setFilterDiet(draftDiet)
              setFilterMeal(draftMeal)
              setFilterMealDisplay(draftMealDisplay)
              setFilterCategories(new Set(draftCategories))
              setFilterOpen(false)
              setShuffleSeed(Math.random())
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }} style={{
              width: '100%', height: 52, border: 'none', borderRadius: 16,
              background: '#F4A623', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}>
              {isSearching ? 'Buscando...' : `Ver ${draftDishCount} ${draftDishCount === 1 ? 'plato' : 'platos'}`}
            </button>
          </div>
          </div>{/* end scrollable content */}
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
            width: 270, maxWidth: '88vw',
            background: isDark ? '#111' : '#fafafa',
            borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'}`,
            animation: 'slideRight 0.25s ease-out',
            display: 'flex', flexDirection: 'column',
            boxShadow: '-8px 0 40px rgba(0,0,0,0.18)',
          }}>
            {/* Header */}
            <div style={{
              padding: '18px 16px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}>
              <span style={{ fontFamily: 'var(--font-feed-display), serif', fontSize: 19, fontWeight: 700, color: isDark ? '#fff' : '#111', letterSpacing: '-0.3px' }}>
                Quiero<span style={{ color: '#F4A623' }}>Comer</span>
              </span>
              <button onClick={() => setMenuOpen(false)} style={{
                width: 28, height: 28, background: 'none', border: 'none',
                cursor: 'pointer', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Nav items */}
            <nav style={{ flex: 1, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>

              {/* Inicio */}
              <button onClick={() => { setMenuOpen(false); setView('feed'); window.scrollTo(0, 0) }} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 9,
                color: view === 'feed' ? '#F4A623' : (isDark ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.72)'),
                fontSize: 15, fontWeight: view === 'feed' ? 600 : 400,
                background: view === 'feed' ? (isDark ? 'rgba(244,166,35,0.1)' : 'rgba(244,166,35,0.07)') : 'transparent',
                border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                WebkitTapHighlightColor: 'transparent',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: view === 'feed' ? 1 : 0.5 }}>
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                Inicio
              </button>

              <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', margin: '3px 4px' }} />

              {/* Mi perfil */}
              <button onClick={() => { setMenuOpen(false); setView('perfil'); window.scrollTo(0, 0) }} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 9,
                color: view === 'perfil' ? '#F4A623' : (isDark ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.72)'),
                fontSize: 15, fontWeight: view === 'perfil' ? 600 : 400,
                background: view === 'perfil' ? (isDark ? 'rgba(244,166,35,0.1)' : 'rgba(244,166,35,0.07)') : 'transparent',
                border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                WebkitTapHighlightColor: 'transparent',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: view === 'perfil' ? 1 : 0.5 }}>
                  <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
                Mi perfil
              </button>

              <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', margin: '3px 4px' }} />

              {/* Contacto */}
              <button onClick={() => { setMenuOpen(false); setView('contacto'); window.scrollTo(0, 0) }} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 9,
                color: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.62)', fontSize: 15, fontWeight: 400,
                background: 'transparent', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
                WebkitTapHighlightColor: 'transparent',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                Contacto
              </button>

              <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', margin: '3px 4px' }} />

              {/* Apariencia */}
              <div style={{ padding: '6px 10px 4px' }}>
                <p style={{ margin: '0 0 7px', fontSize: 11, fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Apariencia</p>
                <div style={{ display: 'flex', borderRadius: 9, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', padding: 3, gap: 2 }}>
                  <button onClick={() => { if (isDark) toggleTheme() }} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    padding: '6px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                    background: !isDark ? '#fff' : 'transparent',
                    boxShadow: !isDark ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    color: !isDark ? '#b45309' : (isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.3)'),
                    fontSize: 13, fontWeight: !isDark ? 600 : 400, transition: 'all 0.15s',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="4.5"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                    </svg>
                    Claro
                  </button>
                  <button onClick={() => { if (!isDark) toggleTheme() }} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    padding: '6px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                    background: isDark ? 'rgba(255,255,255,0.1)' : 'transparent',
                    boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                    color: isDark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.3)',
                    fontSize: 13, fontWeight: isDark ? 600 : 400, transition: 'all 0.15s',
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                    Oscuro
                  </button>
                </div>
              </div>
            </nav>

            {/* Footer */}
            <div style={{ padding: '10px 16px 22px' }}>
              <p style={{ margin: 0, fontSize: 11, color: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.18)', textAlign: 'center' }}>
                © 2025 QuieroComer · Santiago, Chile
              </p>
            </div>
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
                isDark={isDark}
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
            <div style={{ padding: '2px 16px 2px', display: 'flex', alignItems: 'center', gap: 8 }}>
              {isDesktop && (
                <button onClick={() => setLocationModalOpen(true)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  padding: '6px 12px', borderRadius: 20, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                  color: (locationName || gpsLabel) ? '#e09200' : isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)',
                  cursor: 'pointer', fontSize: 13,
                }}>
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {locationName || gpsLabel || 'Ubicación'}
                </button>
              )}
              <div style={{ flex: 1 }} />
              {isDesktop && (
                <button onClick={() => setFilterOpen(true)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  padding: '6px 12px', borderRadius: 20, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                  color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)',
                  cursor: 'pointer', fontSize: 13,
                }}>
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
                  Filtros
                </button>
              )}
            </div>
          )}

          {/* Feed masonry */}
          {feedDishes.length > 0 ? (
            <>
              <div style={{ marginTop: -6 }} />
              <div style={{ opacity: isSearching ? 0.45 : 1, transition: 'opacity 0.2s' }}>
              <MasonryGrid
                dishes={feedDishes.slice(0, visibleCount)}
                onDishTap={handleDishTap}
                onCategoryClick={cat => setActiveCategory(cat)}
                userLocation={userLocation}
              />
              </div>
              {/* Sentinel — IntersectionObserver lo detecta para cargar más */}
              <div ref={sentinelRef} style={{ height: 1 }} />
              {visibleCount < feedDishes.length && (
                <div style={{ display: 'flex', gap: 10, padding: '10px 12px 40px' }}>
                  {(isDesktop ? [0, 1, 2, 3] : [0, 1]).map(col => (
                    <div key={col} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} className="skeleton-shimmer" style={{ aspectRatio: col % 2 === 0 ? '3/4' : '4/5', borderRadius: 14 }} />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '80px 30px', color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)' }}>
              <p style={{ fontSize: 36, margin: '0 0 14px', lineHeight: 1, fontWeight: 300, color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.22)', letterSpacing: 2 }}>:(</p>
              <p style={{ fontSize: 17, fontWeight: 400, margin: '0 0 16px', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}>
                No tenemos platos aún
              </p>
              <button onClick={() => {
                setSearchQuery('')
                setSearchInput('')
                setActiveCategory(null)
                setFilterCategories(new Set())
                setFilterDiet('all')
                setServerDishes(null)
                window.history.replaceState({}, '', '/')
              }} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 14, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
                textDecoration: 'underline', textUnderlineOffset: 3, padding: 0,
              }}>
                Ver todos los platos
              </button>
            </div>
          )}
        </>
      )}

      {/* ─── Perfil View (unified: profile + liked + saved) ─── */}
      {view === 'perfil' && (
        <ProfileView
          savedDishes={savedDishes}
          viewedDishes={viewedDishes}
          onDishTap={handleLikedDishTap}
          onViewAllSaved={() => { setView('all-saved'); window.scrollTo(0, 0) }}
          onViewAllViewed={() => { setView('all-liked'); window.scrollTo(0, 0) }}
          onBack={() => { setView('feed'); window.scrollTo(0, 0) }}
          isDark={isDark}
        />
      )}

      {/* ─── Contacto View ─── */}
      {view === 'contacto' && (
        <ContactView onBack={() => { setView('feed'); window.scrollTo(0, 0) }} isDark={isDark} />
      )}

      {/* ─── All Liked View ─── */}
      {view === 'all-liked' && (
        <div style={{ padding: '8px 3px 100px' }}>
          <div style={{ padding: '8px 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setView('perfil')} style={{ background: 'none', border: 'none', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', cursor: 'pointer', padding: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
            <h2 style={{ fontFamily: 'var(--font-feed-display), serif', fontSize: 18, fontWeight: 700, color: isDark ? '#fff' : '#111', margin: 0 }}>
              Me han gustado
            </h2>
            <span style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' }}>({likedDishes.length})</span>
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
            <div style={{ textAlign: 'center', padding: '60px 20px', color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}>
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
            <button onClick={() => setView('perfil')} style={{ background: 'none', border: 'none', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', cursor: 'pointer', padding: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
            <h2 style={{ fontFamily: 'var(--font-feed-display), serif', fontSize: 18, fontWeight: 700, color: isDark ? '#fff' : '#111', margin: 0 }}>
              Guardados
            </h2>
            <span style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' }}>({savedDishes.length})</span>
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
          dishPool={feedDishes}
          profile={profile}
          hideRelated={hideRelated}
          onClose={() => {
            setSelectedDish(null)
            const back = searchQuery ? `/?q=${encodeURIComponent(searchQuery)}` : '/'
            window.history.replaceState({}, '', back)
          }}
          onSave={handleDishSave}
          onDishTap={handleDishTap}
          onCategoryClick={(cat) => { setActiveCategory(cat); setSelectedDish(null); window.history.replaceState({}, '', '/') }}
          userLocation={userLocation}
          isDark={isDark}
          savedDishIds={savedDishIds}
        />
      )}

      </div>{/* end main content */}
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

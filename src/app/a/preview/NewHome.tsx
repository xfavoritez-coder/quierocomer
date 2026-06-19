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
import { QC_PARENTS, getPrimaryDishType, DISH_TYPE_TO_PARENT } from '../lib/categories'
import { slugify } from '@/lib/slugify'
import NavMenuPanel from '../components/NavMenuPanel'

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
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardPhotoIdx, setOnboardPhotoIdx] = useState(0)
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
  const [quickNearby, setQuickNearby] = useState(false)
  const [locationPromptDismissed, setLocationPromptDismissed] = useState(() => {
    try { return !!localStorage.getItem('qc_loc_prompt_hidden') } catch { return false }
  })
  const [locationPromptFading, setLocationPromptFading] = useState(false)
  const [locationTooltipReady, setLocationTooltipReady] = useState(false)
  const [quickPopular, setQuickPopular] = useState(false)
  const [filterMaxKm, setFilterMaxKm] = useState(5)
  const [filterDiet, setFilterDiet] = useState<'all' | 'VEGAN' | 'VEGETARIAN'>('all')
  // Draft state — se usan dentro del panel, solo se aplican al hacer "Guardar cambios"
  const [draftMeal, setDraftMeal] = useState(filterMeal)
  const [draftMealDisplay, setDraftMealDisplay] = useState(filterMealDisplay)
  const [draftSort, setDraftSort] = useState<'default' | 'recent' | 'price-asc' | 'price-desc'>('default')
  const [draftMaxKm, setDraftMaxKm] = useState(filterMaxKm)
  const [draftDiet, setDraftDiet] = useState(filterDiet)
  const [savedDishIds, setSavedDishIds] = useState<Set<string>>(new Set())
  // Track if user explicitly changed filterMaxKm from the modal (vs auto-set by GPS)
  const userSetMaxKm = useRef(false)
  const silentFetch = useRef(true) // first auto-location fetch is silent (no loading overlay)
  // Server-side search/filter results — null = browse mode (use initial dishes prop)
  const [serverDishes, setServerDishes] = useState<FeedDish[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  // ─── Eureka / Descubrir ───────────────────────────────────────────────────
  const [eurekaLiked, setEurekaLiked] = useState<FeedDish[]>([])
  const [eurekaMax, setEurekaMax] = useState(5)
  const eurekaMaxRef = useRef(5)
  const [showEurekaModal, setShowEurekaModal] = useState(false)
  const eurekaModalShownRef = useRef(false)
  const floatingHeaderRef = useRef<HTMLDivElement>(null)
  const [floatingHeaderH, setFloatingHeaderH] = useState(0)

  useEffect(() => {
    const el = floatingHeaderRef.current
    if (!el) return
    const obs = new ResizeObserver(() => setFloatingHeaderH(el.offsetHeight))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Restaurar selección previa al volver desde /descubrir
  useEffect(() => {
    try {
      const isAfinar = localStorage.getItem('qc_eureka_afinar') === '1'
      if (isAfinar) {
        localStorage.removeItem('qc_eureka_afinar')
        setEurekaMax(6)
        eurekaMaxRef.current = 6
      }
      const raw = localStorage.getItem('qc_eureka_liked')
      if (raw) {
        const dishes: FeedDish[] = JSON.parse(raw)
        if (dishes.length > 0) setEurekaLiked(dishes.slice(0, isAfinar ? 6 : 5))
      }
    } catch {}
  }, [])

  // Show milestone modal on first reach of eurekaMax
  useEffect(() => {
    if (eurekaLiked.length >= eurekaMax && !eurekaModalShownRef.current) {
      eurekaModalShownRef.current = true
      setShowEurekaModal(true)
    }
  }, [eurekaLiked.length, eurekaMax])

  const handleEurekaDescubrir = () => {
    if (eurekaLiked.length < eurekaMax) return
    try { localStorage.setItem('qc_eureka_liked', JSON.stringify(eurekaLiked)) } catch {}
    window.location.href = '/descubrir'
  }

  // ─── Swipe narrowing ──────────────────────────────────────────────────────
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set())
  const [swipeLikeFreq, setSwipeLikeFreq] = useState<Record<string, number>>({})
  const [swipeDislikeFreq, setSwipeDislikeFreq] = useState<Record<string, number>>({})

  const modalDishIdRef = useRef<string | null>(null)
  const modalAllDishesRef = useRef<FeedDish[]>([])
  const searchFetchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [visibleCount, setVisibleCount] = useState(20)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const [headerHeight, setHeaderHeight] = useState(130)
  const [showFloatingSearch, setShowFloatingSearch] = useState(false)
  const headerVisible = useRef(true)
  const [stickyHeaderVisible, setStickyHeaderVisible] = useState(true)
  const swipeLock = useRef(false)
  const lastScrollY = useRef(0)
  const scrollTicking = useRef(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [showDistancePicker, setShowDistancePicker] = useState(false)
  const distanceBadgeRef = useRef<HTMLButtonElement>(null)
  const locationBtnRef = useRef<HTMLButtonElement>(null)
  const dismissLocationPrompt = () => {
    setLocationPromptFading(true)
    setTimeout(() => {
      setLocationPromptDismissed(true)
      setLocationPromptFading(false)
      try { localStorage.setItem('qc_loc_prompt_hidden', '1') } catch {}
    }, 200)
  }
  useEffect(() => {
    if (locationPromptDismissed) return
    const onScroll = () => dismissLocationPrompt()
    window.addEventListener('scroll', onScroll, { once: true, passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [locationPromptDismissed])
  useEffect(() => {
    if (!showDistancePicker) return
    const close = (e: MouseEvent) => {
      // Badge button handles its own toggle — don't interfere
      if (distanceBadgeRef.current?.contains(e.target as Node)) return
      setShowDistancePicker(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showDistancePicker])
  // ─── Onboarding — show once per user ─────────────────────────────────────
  useEffect(() => {
    try {
      if (!localStorage.getItem('qc_onboarding_done')) {
        setShowOnboarding(true)
      } else {
        // Returning user sin onboarding: tooltip listo de inmediato
        setLocationTooltipReady(true)
      }
    } catch {
      setLocationTooltipReady(true)
    }
  }, [])

  // Cuando el onboarding se cierra, activar tooltip con delay para fade-in
  useEffect(() => {
    if (showOnboarding) return
    if (locationTooltipReady) return
    const t = setTimeout(() => setLocationTooltipReady(true), 350)
    return () => clearTimeout(t)
  }, [showOnboarding])

  const ONBOARD_EMOJIS = ['🍔', '🍣', '🌮', '🍕', '🥗', '🍜', '🍝', '🥘']
  useEffect(() => {
    if (!showOnboarding) return
    const interval = setInterval(() => {
      setOnboardPhotoIdx(i => (i + 1) % ONBOARD_EMOJIS.length)
    }, 1500)
    return () => clearInterval(interval)
  }, [showOnboarding])

  // Stable seed on server (avoids hydration mismatch), randomized after mount
  const [shuffleSeed, setShuffleSeed] = useState(1)
  useEffect(() => { setShuffleSeed(Math.random()) }, [])

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

  // Load personalized scores on mount (no longer done in SSR to keep page cacheable/fast)
  useEffect(() => {
    import('../lib/feed-actions').then(({ getProfileData }) =>
      getProfileData().then(data => {
        if (!data) return
        // Only apply if user has actual preferences (avoid unnecessary re-render for new users)
        const hasCat = Object.keys(data.categoryScores ?? {}).length > 0
        const hasKw = Object.keys(data.keywordScores ?? {}).length > 0
        if (!hasCat && !hasKw && !data.totalInteractions) return
        setLiveProfile(prev => {
          if (prev) return prev // already set (e.g. from perfil view)
          const p = createEmptyProfile()
          p.categoryScores = data.categoryScores
          p.keywordScores = data.keywordScores
          p.totalInteractions = data.totalInteractions
          return p
        })
      })
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
        setQuickNearby(true)
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
      setQuickNearby(true)
      // No auto-cambiar filterMaxKm: evita re-fetch al servidor y reordenamiento visual brusco
      const label = await reverseGeocode(loc.lat, loc.lng) || 'Cerca de ti'
      setGpsLabel(label)
      try { localStorage.setItem('qc_location', JSON.stringify({ lat: loc.lat, lng: loc.lng, label })) } catch {}
    }

    navigator.geolocation?.getCurrentPosition(onGPS, () => {}, {
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
    const parents = ['Comida rápida','Pizza','Sushi','Japonesa','China','Thai','India','Asiática','Peruana','Mariscos','Parrilla','Pastas','Venezolana','Mexicana','Pollo','Empanadas','Saludable','Desayunos','Postres','Bebidas']
    // Leaves (subcategorías)
    const leaves = ['Hamburguesas','Completos','Sándwiches','Papas fritas','Pizzas','Ramen','Gyoza','Ceviches','Pollo y alitas','Ensaladas','Bowls','Cafetería','Amasandería','Helados','Smoothies','Milkshakes']
    return [...new Set([...parents, ...leaves])]
  }, [])

  // Sugerencias unificadas — 100% cliente, instantáneas (sin red)
  const searchSuggestions = useMemo(() => {
    const trimmed = searchInput.trim()
    if (trimmed.length < 2) return null
    const q = normStr(trimmed)

    const results: { text: string; type: 'plato' | 'local' | 'categoría' | 'ingrediente' }[] = []

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
        results.push({ text: d.restaurante, type: 'local' })
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
  const [searchFocused, setSearchFocused] = useState(false)
  const searchTouched = useRef(false)

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
    const silent = silentFetch.current
    silentFetch.current = false
    if (!silent) setIsSearching(true)
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
      setServerDishes(null)
    } finally {
      if (!silent) setIsSearching(false)
    }
  }, [])

  // Determine if any filter requires a server fetch
  const needsServerFetch = !!(
    searchQuery || activeCategory || filterDiet !== 'all' ||
    locationName ||
    (filterMaxKm < 30 && userLocation) || quickPopular
  )

  useEffect(() => {
    if (!needsServerFetch) {
      setServerDishes(null)
      return
    }
    // Debounce for search typing; immediate for other filters
    // searchQuery solo cambia al hacer Enter o click en sugerencia (no al tipear),
    // así que no necesita debounce — se lanza inmediatamente
    const delay = 0
    if (searchFetchRef.current) clearTimeout(searchFetchRef.current)
    searchFetchRef.current = setTimeout(() => {
      fetchServerDishes({
        q: searchQuery,
        categoryPill: activeCategory,
        diet: filterDiet,
        // Si hay búsqueda activa, ignorar filtro de distancia — el usuario busca algo específico
        maxKm: searchQuery ? undefined : filterMaxKm,
        locationName,
        lat: userLocation?.lat,
        lng: userLocation?.lng,
      })
    }, delay)
    return () => { if (searchFetchRef.current) clearTimeout(searchFetchRef.current) }
  }, [searchQuery, activeCategory, filterDiet, filterMeal, filterMaxKm, locationName, userLocation, quickPopular, needsServerFetch, fetchServerDishes])

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
      if (filterDiet === 'VEGAN') filtered = filtered.filter(d => d.dieta.tipo === 'VEGAN')
      else if (filterDiet === 'VEGETARIAN') filtered = filtered.filter(d => d.dieta.tipo === 'VEGAN' || d.dieta.tipo === 'VEGETARIAN')
    }

    // Meal filter — solo se aplica si el usuario lo eligió explícitamente (default = 'all')
    if (filterMeal !== 'all') filtered = filtered.filter(d => d.mealTime === filterMeal)

    // Distance filter + sort — client-side with precise formula
    // Si hay búsqueda activa, ignorar distancia — el usuario busca algo específico
    if (userLocation && !searchQuery) {
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

    // Sort — pills tienen prioridad sobre filterSort del modal
    let combined: FeedDish[]
    if (quickNearby && quickPopular && userLocation) {
      // Populares cerca: ya filtrado por distancia, ordenar por popularidad
      combined = [...filtered].sort((a, b) => b.popularityScore - a.popularityScore)
    } else if (quickNearby && userLocation) {
      combined = filtered // already sorted by distance in the block above
    } else if (quickPopular) {
      combined = [...filtered].sort((a, b) => b.popularityScore - a.popularityScore)
    } else if (filterSort === 'price-asc') {
      combined = [...filtered].sort((a, b) => ((a.precioDescuento ?? a.precio) ?? 0) - ((b.precioDescuento ?? b.precio) ?? 0))
    } else if (filterSort === 'price-desc') {
      combined = [...filtered].sort((a, b) => ((b.precioDescuento ?? b.precio) ?? 0) - ((a.precioDescuento ?? a.precio) ?? 0))
    } else if (filterSort === 'recent') {
      combined = [...filtered].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
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
  }, [serverDishes, dishes, activeCategory, categoryScores, keywordScores, vectorScoredIds, userLocation, filterMeal, filterSort, quickNearby, quickPopular, filterDiet, filterMaxKm, shuffleSeed])

  // ─── Modal allDishes snapshot — frozen when dish opens, immune to GPS reordering ──
  if (selectedDish) {
    if (selectedDish.id !== modalDishIdRef.current) {
      modalDishIdRef.current = selectedDish.id
      modalAllDishesRef.current = feedDishes.some(d => d.id === selectedDish.id)
        ? feedDishes
        : [selectedDish, ...feedDishes]
    }
  } else {
    modalDishIdRef.current = null
  }

  // Feed with swipe narrowing: filter swiped dishes, re-sort by accumulated preference signals.
  // typeConfidence crece de 0 → 1 en los primeros 5 swipes: con pocos datos los t: (tipo exacto)
  // pesan poco y el feed explora la familia; al acumular swipes converge en el tipo específico.
  const activeFeedDishes = useMemo(() => {
    if (swipedIds.size === 0) return feedDishes
    const filtered = feedDishes.filter(d => !swipedIds.has(d.id))
    const likeTotal = Object.values(swipeLikeFreq).reduce((s, v) => s + v, 0)
    if (likeTotal < 2) return filtered
    // 0.2 → 1.0 en 5 swipes: exploración → convergencia progresiva
    const typeConfidence = Math.min(swipedIds.size / 5, 1)
    return [...filtered].sort((a, b) => {
      const sa = _swipeScore(a, swipeLikeFreq, swipeDislikeFreq, typeConfidence)
      const sb = _swipeScore(b, swipeLikeFreq, swipeDislikeFreq, typeConfidence)
      return sb - sa
    })
  }, [feedDishes, swipedIds, swipeLikeFreq, swipeDislikeFreq])

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
    return filtered.length
  }, [dishes, serverDishes, userLocation, draftMaxKm, draftMeal, draftDiet])

  // Infinite scroll — IntersectionObserver sobre sentinel al final del feed
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => Math.min(prev + 20, activeFeedDishes.length))
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
        setStickyHeaderVisible(entry.isIntersecting)
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
          if (!swipeLock.current) setShowFloatingSearch(false)
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

  // ─── Swipe handlers ───────────────────────────────────────────────────────
  const handleDishSwipe = useCallback((dish: FeedDish, dir: 'left' | 'right') => {
    const dims = _swipeDims(dish)
    setSwipedIds(prev => new Set([...prev, dish.id]))
    if (dir === 'right') {
      setSwipeLikeFreq(prev => {
        const next = { ...prev }
        for (const d of dims) next[d] = (next[d] ?? 0) + 1
        return next
      })
      // Eureka: agregar a lista de liked si hay espacio
      setEurekaLiked(prev => {
        if (prev.length >= eurekaMaxRef.current || prev.some(d => d.id === dish.id)) return prev
        return [...prev, dish]
      })

    } else {
      setSwipeDislikeFreq(prev => {
        const next = { ...prev }
        for (const d of dims) next[d] = (next[d] ?? 0) + 1
        return next
      })
    }
  }, [])


  // Count of filters the user explicitly changed (shown as badge on "Más filtros" pill)
  const activeFilterCount = (filterDiet !== 'all' ? 1 : 0) + (filterSort !== 'default' ? 1 : 0) + (userSetMaxKm.current && filterMaxKm !== 5 ? 1 : 0) + (filterMeal !== 'all' ? 1 : 0)

  // Pills helpers — usados tanto en Row 3 como en el floating header
  const openFilters = () => {
    setDraftSort(filterSort)
    setDraftMaxKm(filterMaxKm)
    setDraftDiet(filterDiet)
    setDraftMeal(filterMeal)
    setDraftMealDisplay(filterMealDisplay)
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

  function resetFeed() {
    setView('feed')
    setActiveCategory(null)
    setSearchQuery('')
    setSearchInput('')
    setFilterMeal('all')
    setFilterMealDisplay('all')
    setFilterSort('default')
    setFilterMaxKm(5)
    setFilterDiet('all')
    setQuickNearby(!!userLocation)
    setQuickPopular(false)
    setServerDishes(null)
    setSwipedIds(new Set())
    setSwipeLikeFreq({})
    setSwipeDislikeFreq({})
    userSetMaxKm.current = false
    window.history.replaceState(null, '', '/')
    window.scrollTo(0, 0)
  }

  return (
    <div style={{ minHeight: '100dvh', background: isDark ? '#0e0e0e' : '#f5f4f1', color: isDark ? '#fff' : '#111' }}>

      {/* ─── Onboarding welcome modal ─── */}
      {showOnboarding && view === 'feed' && (
        <>
          <style>{`
            @keyframes qc-ob-backdrop { from { opacity:0 } to { opacity:1 } }
            @keyframes qc-ob-card-in  { from { opacity:0; transform:translateY(24px) scale(0.96) } to { opacity:1; transform:translateY(0) scale(1) } }
            @keyframes qc-swipe {
              0%,10%  { transform:translateX(0) rotate(0deg); }
              25%     { transform:translateX(60px) rotate(8deg); }
              40%,50% { transform:translateX(0) rotate(0deg); }
              65%     { transform:translateX(-60px) rotate(-8deg); }
              80%,100%{ transform:translateX(0) rotate(0deg); }
            }
            @keyframes qc-hand {
              0%,10%  { transform:translateX(-50%); }
              25%     { transform:translateX(30px); }
              40%,50% { transform:translateX(-50%); }
              65%     { transform:translateX(-80px); }
              80%,100%{ transform:translateX(-50%); }
            }
            @keyframes qc-badge-antojo {
              0%,10%  { opacity:0; }
              20%,30% { opacity:1; }
              40%,100%{ opacity:0; }
            }
            @keyframes qc-badge-no {
              0%,50%  { opacity:0; }
              60%,70% { opacity:1; }
              80%,100%{ opacity:0; }
            }
          `}</style>

          {/* Backdrop */}
          <div style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px 16px',
            overflowY: 'auto',
            animation: 'qc-ob-backdrop 0.3s ease-out',
          }}>
            {/* Modal card */}
            <div style={{
              width: '100%', maxWidth: 360,
              maxHeight: 'calc(100dvh - 40px)',
              overflowY: 'auto',
              background: isDark ? '#161616' : '#fff',
              borderRadius: 24,
              boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
              overflow: 'hidden',
              flexShrink: 0,
              animation: 'qc-ob-card-in 0.35s ease-out',
            }}>
              {/* Close button */}
              <div style={{ position: 'relative', height: 5 }}>
                <button
                  onClick={() => { try { localStorage.setItem('qc_onboarding_done', '1') } catch {}; setShowOnboarding(false) }}
                  style={{
                    position: 'absolute', top: 10, right: 12, zIndex: 10,
                    width: 28, height: 28, border: 'none', cursor: 'pointer',
                    background: 'none',
                    color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>

              <div style={{ padding: '16px 24px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                {/* Logo */}
                <img src="/logo.png" alt="QuieroComer" style={{ height: 40, marginBottom: 14, opacity: 0.92 }} />

                {/* Headline */}
                <h2 style={{
                  fontFamily: 'var(--font-feed-display), serif',
                  fontSize: 23, fontWeight: 800, lineHeight: 1.2, textAlign: 'center',
                  color: isDark ? '#fff' : '#111', margin: '0 0 7px',
                }}>
                  Descubre qué y dónde comer
                </h2>
                <p style={{ fontSize: 15, fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.68)', textAlign: 'center', margin: '0 0 20px', lineHeight: 1.55 }}>
                  Desliza las fotos <span style={{ color: '#F4A623' }}>hacia la derecha si te dan antojo</span> o hacia la izquierda si no
                </p>

                {/* Card stack animation */}
                {(() => {
                  const cardBase: React.CSSProperties = { position: 'absolute', inset: 0, borderRadius: 18, overflow: 'hidden' }
                  const currentEmoji = ONBOARD_EMOJIS[onboardPhotoIdx % ONBOARD_EMOJIS.length]
                  return (
                    <div style={{ position: 'relative', width: 136, height: 164, marginBottom: 10 }}>
                      {/* Back card */}
                      <div style={{ ...cardBase, background: 'linear-gradient(145deg,#374151,#4b5563)', transform: 'rotate(-9deg) scale(0.87) translateY(7px)', zIndex: 1, opacity: 0.6 }} />
                      {/* Middle card */}
                      <div style={{ ...cardBase, background: 'linear-gradient(145deg,#1f2937,#374151)', transform: 'rotate(-4deg) scale(0.94) translateY(3px)', zIndex: 2, opacity: 0.8 }} />
                      {/* Front card — anima independientemente */}
                      <div style={{
                        ...cardBase,
                        background: 'linear-gradient(150deg,#0f172a,#1e293b 55%,#2d3f5f)',
                        boxShadow: '0 14px 32px rgba(0,0,0,0.28), 0 3px 8px rgba(0,0,0,0.18)',
                        zIndex: 3,
                        animation: 'qc-swipe 3s ease-in-out infinite',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 52, lineHeight: 1, transition: 'opacity 0.2s', userSelect: 'none' }}>{currentEmoji}</span>
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 55%)' }} />
                        {/* Antojo badge */}
                        <div style={{
                          position: 'absolute', top: 10, right: 10, zIndex: 1,
                          background: 'rgba(22,163,74,0.92)', borderRadius: 20,
                          padding: '4px 9px', display: 'flex', alignItems: 'center', gap: 4,
                          animation: 'qc-badge-antojo 3s ease-in-out infinite',
                        }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>Antojo</span>
                        </div>
                        {/* No badge */}
                        <div style={{
                          position: 'absolute', top: 10, left: 10, zIndex: 1,
                          background: 'rgba(0,0,0,0.6)', borderRadius: 20,
                          padding: '4px 9px', display: 'flex', alignItems: 'center', gap: 4,
                          animation: 'qc-badge-no 3s ease-in-out infinite',
                        }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>No</span>
                        </div>
                      </div>
                      {/* Finger — animación propia sincronizada */}
                      <div style={{
                        position: 'absolute', bottom: -22, left: '50%',
                        zIndex: 10, fontSize: 26, lineHeight: 1,
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                        pointerEvents: 'none',
                        animation: 'qc-hand 3s ease-in-out infinite',
                      }}>
                        👆
                      </div>
                    </div>
                  )
                })()}

                <p style={{ fontSize: 15, fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.38)', textAlign: 'center', margin: '18px 0 20px', lineHeight: 1.5 }}>
                  Junta 5 antojos y descubre qué y dónde comer
                </p>

                {/* CTA */}
                <button
                  onClick={() => {
                    try { localStorage.setItem('qc_onboarding_done', '1') } catch {}
                    setShowOnboarding(false)
                  }}
                  style={{
                    width: '100%', height: 50, borderRadius: 13,
                    background: '#F4A623', border: 'none', cursor: 'pointer',
                    fontSize: 16, fontWeight: 700, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 4px 14px rgba(244,166,35,0.4)',
                  }}
                >
                  Empezar
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>

              </div>
            </div>
          </div>
        </>
      )}

      {/* ─── Location prompt tooltip (informativo, surge desde botón ubicación) ─── */}
      {!userLocation && !locationPromptDismissed && locationTooltipReady && !showOnboarding && view === 'feed' && (() => {
        const r = locationBtnRef.current?.getBoundingClientRect()
        if (!r) return null
        const tooltipW = 220
        const left = Math.round((window.innerWidth - tooltipW) / 2)
        const arrowLeft = Math.max(10, Math.min(r.left + 8 - left, tooltipW - 20))
        return (
          <div style={{
            position: 'fixed',
            top: r.bottom + 8,
            left,
            zIndex: 400,
            width: 'max-content',
            maxWidth: tooltipW,
            background: isDark ? '#1c1c1e' : '#fff',
            borderRadius: 12,
            boxShadow: '0 6px 24px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'}`,
            animation: 'qc-ob-card-in 0.2s ease-out',
            opacity: locationPromptFading ? 0 : 1,
            transform: locationPromptFading ? 'translateY(-18px)' : 'translateY(0)',
            transition: 'opacity 0.22s ease, transform 0.22s ease',
          }}>
            {/* Arrow */}
            <div style={{
              position: 'absolute', top: -5, left: arrowLeft,
              width: 10, height: 10,
              background: isDark ? '#1c1c1e' : '#fff',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'}`,
              borderRight: 'none', borderBottom: 'none',
              transform: 'rotate(45deg)',
              pointerEvents: 'none',
            }} />
            <div style={{ padding: '11px 28px 11px 16px', position: 'relative' }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 500, lineHeight: 1.45, color: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.62)' }}>
                Selecciona una ubicación para ver platos cerca de ti
              </p>
              <button onClick={dismissLocationPrompt} style={{
                position: 'absolute', top: 10, right: 8,
                background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                color: isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)',
                display: 'flex', alignItems: 'center',
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          </div>
        )
      })()}

      {/* ─── Desktop Top Navbar ─── */}
      {isDesktop && (
        <nav style={{
          height: 64,
          background: isDark ? 'rgba(14,14,14,0.97)' : 'rgba(255,255,255,0.97)',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
          display: 'flex', alignItems: 'center',
        }}><div style={{ maxWidth: 1100, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px' }}>
          {/* Logo */}
          <a href="/" onClick={e => { e.preventDefault(); resetFeed() }} style={{ textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <img src="/logo.png" alt="QuieroComer" style={{ height: 36, width: 'auto' }} />
          </a>

          {/* Search bar — centro, ocupa todo el espacio */}
          <form style={{ flex: 1, position: 'relative', maxWidth: 480, margin: '0 auto' }} onSubmit={e => { e.preventDefault(); executeSearch(searchInput); (document.activeElement as HTMLElement)?.blur() }}>
            <input
              className="feed-search-input"
              type="text" value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              autoComplete="off"
              placeholder="Buscar en QuieroComer"
              style={{
                width: '100%', padding: '9px 34px 9px 16px', borderRadius: 999, fontSize: 17,
                background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '2px solid rgba(0,0,0,0.07)',
                color: isDark ? '#fff' : '#111', outline: 'none', boxSizing: 'border-box',
              }}
            />
            {searchInput && (
              <button type="button" onClick={() => { setSearchInput(''); executeSearch('') }} style={{
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
                  {/* Inicio */}
                  <button onClick={() => { resetFeed(); setDesktopMenuOpen(false) }} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 18px', background: 'none', border: 'none', cursor: 'pointer',
                    color: isDark ? 'rgba(255,255,255,0.85)' : '#111', fontSize: 14, textAlign: 'left', width: '100%',
                  }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    Inicio
                  </button>

                  {/* Mi perfil */}
                  <button onClick={() => { setView('perfil'); window.scrollTo(0, 0); setDesktopMenuOpen(false) }} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 18px', background: 'none', border: 'none', cursor: 'pointer',
                    color: isDark ? 'rgba(255,255,255,0.85)' : '#111', fontSize: 14, textAlign: 'left', width: '100%',
                  }}>
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c.7-4.2 3.8-7 8-7s7.3 2.8 8 7H4z"/></svg>
                    Mi perfil
                  </button>

                  {/* Publicar local */}
                  <a href="/qr" target="_blank" rel="noopener noreferrer" onClick={() => setDesktopMenuOpen(false)} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 18px', color: isDark ? 'rgba(255,255,255,0.85)' : '#111',
                    fontSize: 14, textDecoration: 'none', width: '100%', boxSizing: 'border-box',
                  }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    Publicar local
                  </a>

                  {/* Contacto */}
                  <button onClick={() => { setView('contacto'); window.scrollTo(0, 0); setDesktopMenuOpen(false) }} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 18px', background: 'none', border: 'none', cursor: 'pointer',
                    color: isDark ? 'rgba(255,255,255,0.85)' : '#111', fontSize: 14, textAlign: 'left', width: '100%',
                  }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    Contacto
                  </button>

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
          const hasActiveFilters = filterSort !== 'default' || quickNearby || quickPopular || filterMaxKm !== 5 || filterDiet !== 'all' || !!activeCategory
          return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, marginTop: 12 }}>
        <a href="/" onClick={e => { e.preventDefault(); resetFeed() }} style={{ textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <img src="/logo.png" alt="QuieroComer" style={{ height: 55, width: 'auto' }} />
        </a>
        <form style={{ position: 'relative', flex: 1 }} onSubmit={e => { e.preventDefault(); executeSearch(searchInput); searchInputRef.current?.blur(); setShowSuggestions(false) }}>
          <input
            ref={searchInputRef}
            className="feed-search-input"
            type="text" value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onFocus={() => { setShowSuggestions(true); setSearchFocused(true); searchTouched.current = true }}
            onBlur={() => { setTimeout(() => setShowSuggestions(false), 150); setSearchFocused(false) }}
            placeholder="Buscar en QuieroComer"
            autoComplete="off"
            style={{
              width: '100%', padding: '12px 20px 12px 24px', fontSize: 17,
              borderRadius: showSuggestions && searchSuggestions?.length ? '20px 20px 0 0' : 999,
              background: isDark ? 'rgba(255,255,255,0.08)' : '#fff',
              border: isDark ? '1px solid rgba(255,255,255,0.10)' : '2px solid rgba(0,0,0,0.07)',
              boxShadow: 'none',
              color: isDark ? '#fff' : '#111', outline: 'none', boxSizing: 'border-box',
            }}
          />
          {searchInput && (
            <button type="button" onClick={() => { setSearchInput(''); executeSearch(''); setShowSuggestions(false) }} style={{
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
          boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.03)',
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
          <button onClick={() => { if (!userLocation) { setLocationModalOpen(true); return } setQuickNearby(p => !p) }} style={pillStyle(quickNearby, 'nearby')}>
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
            <button onClick={openFilters} style={{ ...pillStyle(false, 'default'), width: '100%' }}>
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
                position: 'absolute', top: 1, right: -3, pointerEvents: 'none',
                background: '#F4A623', color: '#fff',
                borderRadius: 999, fontSize: 11, fontWeight: 700,
                minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px', lineHeight: 1, zIndex: 1,
              }}>{activeFilterCount}</span>
            )}
          </div>
        </div>

        {/* Row 4: Ubicación + badge distancia en la misma línea */}
        <div style={{ display: view === 'perfil' || view === 'contacto' ? 'none' : 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <button ref={locationBtnRef} onClick={() => { dismissLocationPrompt(); setLocationModalOpen(true) }} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: (locationName || gpsLabel) ? '#e09200' : isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)',
            fontSize: 16, fontWeight: 400,
            flex: 1, minWidth: 0, overflow: 'hidden',
          }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {locationName || gpsLabel || 'Selecciona una ubicación'}
            </span>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          {/* Badge distancia — pegado a la derecha de la dirección, siempre visible */}
          {userLocation && (
            <div style={{ flexShrink: 0 }}>
              <button
                ref={distanceBadgeRef}
                type="button"
                onClick={() => setShowDistancePicker(p => !p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: isDark ? 'rgba(244,166,35,0.12)' : 'rgba(224,146,0,0.10)',
                  border: `1px solid ${isDark ? 'rgba(244,166,35,0.25)' : 'rgba(224,146,0,0.25)'}`,
                  borderRadius: 999, padding: '3px 10px',
                  color: '#e09200', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {`${filterMaxKm} km`}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              {showDistancePicker && typeof document !== 'undefined' && createPortal(
                (() => {
                  const r = distanceBadgeRef.current?.getBoundingClientRect()
                  if (!r) return null
                  return (
                    <div style={{
                      position: 'fixed', top: r.bottom + 6, right: window.innerWidth - r.right, zIndex: 99999,
                      background: isDark ? '#1a1a1a' : '#fff',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                      borderRadius: 12, overflow: 'hidden',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                      minWidth: 120,
                      fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
                    }}
                    onMouseDown={e => e.stopPropagation()}>
                      <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                        Radio
                      </div>
                      {[1, 3, 5, 10, 20, 30].map(km => (
                        <button
                          key={km}
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            setFilterMaxKm(km)
                            setDraftMaxKm(km)
                            userSetMaxKm.current = true
                            setShowDistancePicker(false)
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            width: '100%', padding: '9px 14px',
                            background: filterMaxKm === km || (km === 30 && filterMaxKm >= 30) ? (isDark ? 'rgba(244,166,35,0.12)' : 'rgba(244,166,35,0.1)') : 'none',
                            border: 'none', cursor: 'pointer',
                            color: filterMaxKm === km || (km === 30 && filterMaxKm >= 30) ? '#e09200' : isDark ? 'rgba(255,255,255,0.75)' : '#333',
                            fontSize: 14, fontWeight: filterMaxKm === km ? 600 : 400,
                            textAlign: 'left',
                          }}
                        >
                          {km >= 30 ? 'Todo' : `${km} km`}
                          {(filterMaxKm === km || (km === 30 && filterMaxKm >= 30)) && (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e09200" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )
                })(),
                document.body
              )}
            </div>
          )}
        </div>

      </header>

      {/* ─── Floating search bar — aparece al subir el scroll — mobile only ─── */}
      {!isDesktop && view !== 'perfil' && view !== 'contacto' && (
        <div ref={floatingHeaderRef} style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 36,
          padding: '10px 16px',
          background: isDark ? 'rgba(14,14,14,0.97)' : 'rgba(245,244,241,0.97)',
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          transform: showFloatingSearch ? 'translateY(0)' : 'translateY(-110%)',
          transition: showFloatingSearch ? 'transform 0.28s cubic-bezier(0.0, 0.0, 0.2, 1)' : 'none',
          boxShadow: showFloatingSearch ? '0 2px 16px rgba(0,0,0,0.10)' : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href="/" onClick={e => { e.preventDefault(); resetFeed() }} style={{ textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <img src="/logo.png" alt="QuieroComer" style={{ height: 55, width: 'auto' }} />
          </a>
          <form style={{ position: 'relative', flex: 1 }} onSubmit={e => { e.preventDefault(); if (searchInput.trim()) executeSearch(searchInput.trim()); (document.activeElement as HTMLElement)?.blur() }}>
            <input
              type="search"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onFocus={() => { setSearchFocused(true); searchTouched.current = true }}
              onBlur={() => setSearchFocused(false)}
              placeholder="Buscar en QuieroComer"
              className="feed-floating-input"
              style={{
                width: '100%', padding: '12px 38px 12px 24px',
                borderRadius: 999, fontSize: 17,
                background: isDark ? 'rgba(255,255,255,0.08)' : '#fff',
                border: isDark ? '1px solid rgba(255,255,255,0.10)' : '2px solid rgba(0,0,0,0.07)',
                boxShadow: 'none',
                color: isDark ? '#fff' : '#111', outline: 'none', boxSizing: 'border-box',
              }}
            />
            {searchInput && (
              <button onClick={() => { setSearchInput(''); executeSearch('') }} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </form>
          <button onClick={() => setMenuOpen(true)} style={{
            flexShrink: 0, border: 'none', cursor: 'pointer', padding: 0,
            width: 49, height: 49, borderRadius: '50%',
            background: isDark ? 'rgba(255,255,255,0.10)' : '#fff',
            boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.03)',
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

      {/* ─── Eureka pill → banner morph ─── */}
      {eurekaLiked.length > 0 && view !== 'perfil' && view !== 'contacto' && (
        <div style={{
          position: 'fixed', left: 0, right: 0, zIndex: 35,
          top: !isDesktop && showFloatingSearch ? floatingHeaderH : stickyHeaderVisible ? headerHeight : 8,
          transition: 'top 0.28s cubic-bezier(0.0, 0.0, 0.2, 1)',
          display: 'flex', justifyContent: 'center',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: (showFloatingSearch || stickyHeaderVisible) ? '7px 16px' : '8px 12px 8px 16px',
            background: (showFloatingSearch || stickyHeaderVisible)
              ? (isDark ? 'rgba(14,14,14,0.97)' : 'rgba(245,244,241,0.97)')
              : (isDark ? 'rgba(14,14,14,0.97)' : 'rgba(255,255,255,0.97)'),
            backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            borderRadius: (showFloatingSearch || stickyHeaderVisible) ? 0 : 999,
            minWidth: (showFloatingSearch || stickyHeaderVisible) ? '100%' : 0,
            boxSizing: 'border-box' as const,
            border: (showFloatingSearch || stickyHeaderVisible)
              ? 'none'
              : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            borderTop: (showFloatingSearch || stickyHeaderVisible)
              ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
              : 'none',
            boxShadow: (showFloatingSearch || stickyHeaderVisible)
              ? '0 2px 8px rgba(0,0,0,0.06)'
              : '0 3px 18px rgba(0,0,0,0.16)',
            transition: 'border-radius 0.28s cubic-bezier(0.0,0.0,0.2,1), min-width 0.28s cubic-bezier(0.0,0.0,0.2,1), padding 0.28s cubic-bezier(0.0,0.0,0.2,1)',
            justifyContent: 'center',
          }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flexShrink: 0, marginRight: 4 }}>
              {eurekaLiked.length < eurekaMax ? (
                <>
                  {isDesktop && (
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)', lineHeight: 1.2 }}>
                      Descubre qué comer
                    </p>
                  )}
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', lineHeight: 1.3, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)', textAlign: 'right' }}>
                    {`Desliza ${eurekaMax - eurekaLiked.length} más`}
                  </p>
                </>
              ) : (
                <button
                  onClick={() => setEurekaLiked([])}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
                    color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.28)',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {Array.from({ length: eurekaMax }).map((_, i) => {
                const dish = eurekaLiked[i]
                return dish ? (
                  <div key={dish.id} style={{ position: 'relative', width: 45, height: 45, flexShrink: 0 }}>
                    <div
                      onClick={() => setSelectedDish(dish)}
                      style={{ width: 45, height: 45, borderRadius: 12, overflow: 'hidden', border: '2px solid #F4A623', cursor: 'pointer' }}
                    >
                      {dish.fotoUrl && <img src={dish.fotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEurekaLiked(prev => prev.filter(d => d.id !== dish.id)) }}
                      style={{
                        position: 'absolute', top: -6, right: -6,
                        width: 16, height: 16, borderRadius: '50%',
                        background: isDark ? '#333' : '#fff',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                        color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
                        fontSize: 9, fontWeight: 700, lineHeight: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', padding: 0, zIndex: 1,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }}
                    >✕</button>
                  </div>
                ) : (
                  <div key={i} style={{
                    width: 45, height: 45, flexShrink: 0, borderRadius: 12,
                    border: `2px dashed ${isDark ? 'rgba(244,166,35,0.3)' : 'rgba(244,166,35,0.4)'}`,
                    background: isDark ? 'rgba(244,166,35,0.05)' : 'rgba(244,166,35,0.07)',
                  }} />
                )
              })}
            </div>
            {eurekaLiked.length >= eurekaMax && (
              <button onClick={handleEurekaDescubrir} style={{
                padding: '7px 14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #F4A623, #e09200)',
                color: '#fff', fontSize: 13, fontWeight: 700,
                boxShadow: '0 2px 8px rgba(244,166,35,0.4)', whiteSpace: 'nowrap', flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                Descubrir
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            )}
            {eurekaLiked.length < eurekaMax && (
              <button onClick={() => setEurekaLiked([])} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px 4px 4px', flexShrink: 0,
                color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.22)', display: 'flex', alignItems: 'center',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
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

            {/* Ordenar */}
            <div style={{ marginBottom: 22 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Ordenar por
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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

            {/* Momento */}
            <div style={{ marginBottom: 22 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Momento
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {[
                  { display: 'all' as const, meal: 'all' as const, label: 'Todo el día', activeColor: '#F4A623', icon: (c: string) => <svg width="20" height="20" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
                  { display: 'desayuno' as const, meal: 'desayuno' as const, label: 'Desayuno', activeColor: '#f59e0b', icon: (c: string) => <svg width="20" height="20" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" /></svg> },
                  { display: 'almuerzo' as const, meal: 'almuerzo_cena' as const, label: 'Almuerzo', activeColor: '#f97316', icon: (c: string) => <svg width="20" height="20" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /></svg> },
                  { display: 'cena' as const, meal: 'almuerzo_cena' as const, label: 'Cena', activeColor: '#6366f1', icon: (c: string) => <svg width="20" height="20" fill="none" stroke={c} strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg> },
                ].map((m, i) => {
                  const isActive = draftMealDisplay === m.display
                  const iconColor = isActive ? m.activeColor : isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.25)'
                  return (
                  <button key={i} onClick={() => { setDraftMeal(m.meal); setDraftMealDisplay(m.display) }} style={{
                    minHeight: 68, borderRadius: 12,
                    border: isActive ? '1.5px solid #F4A623' : `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)'}`,
                    background: isActive ? 'rgba(244,166,35,0.07)' : isDark ? '#2a2a2a' : '#fff',
                    color: isActive ? '#c97d00' : isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)',
                    fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6,
                    alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}>
                    {m.icon(iconColor)}
                    {m.label}
                  </button>
                  )
                })}
              </div>
            </div>

            <div style={{ height: 80 }} />
          </div>

          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 82,
            padding: '12px 18px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
            background: isDark ? 'linear-gradient(to top, #1a1a1a 60%, transparent)' : 'linear-gradient(to top, #fff 60%, transparent)',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <button onClick={() => {
              setFilterSort(draftSort)
              setFilterMaxKm(draftMaxKm)
              if (draftMaxKm !== 30) userSetMaxKm.current = true
              else userSetMaxKm.current = false
              setFilterDiet(draftDiet)
              setFilterMeal(draftMeal)
              setFilterMealDisplay(draftMealDisplay)
              setFilterOpen(false)
              setShuffleSeed(Math.random())
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }} style={{
              width: '100%', height: 52, border: 'none', borderRadius: 16,
              background: '#F4A623', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}>
              {isSearching ? 'Buscando...' : `Ver ${draftDishCount} ${draftDishCount === 1 ? 'plato' : 'platos'}`}
            </button>
            <button onClick={() => {
              setFilterSort('default')
              setFilterMaxKm(5)
              userSetMaxKm.current = false
              setFilterDiet('all')
              setFilterMeal('all')
              setFilterMealDisplay('all')
              setDraftSort('default')
              setDraftMaxKm(30)
              setDraftDiet('all')
              setDraftMeal('all')
              setDraftMealDisplay('all')
              setFilterOpen(false)
              setShuffleSeed(Math.random())
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }} style={{
              width: '100%', height: 40, border: 'none', borderRadius: 12,
              background: 'none', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}>
              Limpiar filtros
            </button>
          </div>
          </div>{/* end scrollable content */}
        </>
      )}

      {/* ─── Hamburger menu — slide from right ─── */}
      <NavMenuPanel
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onInicio={() => { setView('feed'); window.scrollTo(0, 0) }}
        onPerfil={() => { setView('perfil'); window.scrollTo(0, 0) }}
        onContacto={() => { setView('contacto'); window.scrollTo(0, 0) }}
        activeView={view}
      />

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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setLocationModalOpen(true)} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 20, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                    color: (locationName || gpsLabel) ? '#e09200' : isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)',
                    cursor: 'pointer', fontSize: 13,
                  }}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {locationName || gpsLabel || 'Ubicación'}
                  </button>
                  {userLocation && (
                    <button
                      ref={distanceBadgeRef}
                      type="button"
                      onClick={() => setShowDistancePicker(p => !p)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: isDark ? 'rgba(244,166,35,0.12)' : 'rgba(224,146,0,0.10)',
                        border: `1px solid ${isDark ? 'rgba(244,166,35,0.25)' : 'rgba(224,146,0,0.25)'}`,
                        borderRadius: 999, padding: '3px 10px',
                        color: '#e09200', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {`${filterMaxKm} km`}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                  )}
                </div>
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
              <div style={{ position: 'relative', paddingTop: eurekaLiked.length > 0 ? 66 : 0, transition: 'padding-top 0.28s cubic-bezier(0.0,0.0,0.2,1)' }}>
                <MasonryGrid
                  dishes={activeFeedDishes.slice(0, visibleCount)}
                  onDishTap={handleDishTap}
                  onCategoryClick={cat => setActiveCategory(cat)}
                  userLocation={userLocation}
                  onSwipe={handleDishSwipe}
                />
                {isSearching && (
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 20,
                    background: isDark ? 'rgba(14,14,14,0.55)' : 'rgba(255,255,255,0.6)',
                    borderRadius: 4,
                    pointerEvents: 'none',
                    transition: 'opacity 0.25s',
                  }} />
                )}
              </div>
              {/* Sentinel — IntersectionObserver lo detecta para cargar más */}
              <div ref={sentinelRef} style={{ height: 1 }} />
              {visibleCount < activeFeedDishes.length && (
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
                const hasLocationFilter = userLocation !== null && filterMaxKm <= 5
                if (hasLocationFilter) {
                  // Expand distance to show all dishes regardless of location
                  setFilterMaxKm(30)
                  setDraftMaxKm(30)
                } else {
                  setSearchQuery('')
                  setSearchInput('')
                  setActiveCategory(null)
                  setFilterDiet('all')
                  setServerDishes(null)
                  window.history.replaceState({}, '', '/')
                }
              }} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 14, color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
                textDecoration: 'underline', textUnderlineOffset: 3, padding: 0,
              }}>
                {userLocation !== null && filterMaxKm < 30 ? 'Restablecer filtro' : 'Ver todos los platos'}
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
          allDishes={modalAllDishesRef.current.length > 0 ? modalAllDishesRef.current : [selectedDish]}
          dishPool={dishes}
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

      {/* ─── 5 Antojos milestone modal ─── */}
      {showEurekaModal && (
        <>
          <style>{`
            @keyframes qc-eureka-in {
              from { opacity:0; transform:scale(0.92) translateY(16px) }
              to   { opacity:1; transform:scale(1) translateY(0) }
            }
            @keyframes qc-eureka-backdrop {
              from { opacity:0 }
              to   { opacity:1 }
            }
            @keyframes qc-eureka-confetti {
              0%   { transform:translateY(0) rotate(0deg); opacity:1 }
              100% { transform:translateY(-40px) rotate(20deg); opacity:0 }
            }
          `}</style>
          {/* Backdrop */}
          <div
            onClick={() => setShowEurekaModal(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(4px)',
              animation: 'qc-eureka-backdrop 0.3s ease',
            }}
          />
          {/* Card */}
          <div style={{
            position: 'fixed', inset: 0, zIndex: 201,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 20px',
            pointerEvents: 'none',
          }}>
            <div style={{
              background: isDark ? '#1a1a1a' : '#fff',
              borderRadius: 24,
              padding: '32px 24px 28px',
              maxWidth: 360,
              width: '100%',
              textAlign: 'center',
              animation: 'qc-eureka-in 0.35s cubic-bezier(0.34,1.56,0.64,1)',
              pointerEvents: 'auto',
              position: 'relative',
              boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
            }}>
              {/* Close X */}
              <button
                onClick={() => setShowEurekaModal(false)}
                style={{
                  position: 'absolute', top: 14, right: 14,
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                  color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)',
                  lineHeight: 1, display: 'flex',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>

              {/* Emoji burst */}
              <div style={{ fontSize: 52, lineHeight: 1, marginBottom: 12, userSelect: 'none' }}>🎉</div>

              <h2 style={{
                fontFamily: 'var(--font-feed-display), serif',
                fontSize: 26,
                fontWeight: 700,
                color: isDark ? '#fff' : '#111',
                margin: '0 0 8px',
                lineHeight: 1.2,
              }}>
                ¡Ya tienes {eurekaMax} antojos!
              </h2>
              <p style={{
                fontSize: 15,
                fontWeight: 500,
                color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)',
                margin: '0 0 22px',
                lineHeight: 1.5,
              }}>
                Descubre qué y dónde comer basado en tus gustos
              </p>

              {/* Dish thumbnails */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
                {eurekaLiked.slice(0, eurekaMax).map((d, i) => (
                  <div key={d.id} style={{
                    width: 46, height: 46, borderRadius: 12, overflow: 'hidden',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                    border: `2px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                    animationDelay: `${i * 0.05}s`,
                  }}>
                    {d.fotoUrl ? (
                      <img src={d.fotoUrl} alt={d.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: isDark ? '#2a2a2a' : '#f0ede8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🍽</div>
                    )}
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={handleEurekaDescubrir}
                style={{
                  width: '100%', padding: '14px 20px', borderRadius: 14,
                  border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #F4A623, #e09200)',
                  color: '#fff', fontSize: 16, fontWeight: 700,
                  letterSpacing: '-0.2px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 16px rgba(244,166,35,0.4)',
                  marginBottom: 12,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
                Descubrir ahora
              </button>

              <button
                onClick={() => setShowEurekaModal(false)}
                style={{
                  width: '100%', padding: '11px 20px', borderRadius: 14,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                  cursor: 'pointer',
                  background: 'transparent',
                  color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)',
                  fontSize: 14, fontWeight: 500,
                }}
              >
                Seguir explorando
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  )
}

// ─── Swipe narrowing helpers (module-level — no hooks) ────────────────────────
// Prefixes: t=tipo, tp=familia-tipo, c=categoría, k=cocina, s=sabor, i=ingrediente, d=dieta, h=horario
// categoriaNorm solo se incluye cuando no hay txDishType — evita que la categoría
// "infle" platos genéricos de la misma sección tras un swipe específico (ej: tiradito → ceviches)
// tp (type-parent) da 1x a la familia del tipo primario: primer swipe de torta amplía hacia postres,
// pero al segundo swipe de torta, torta (6x) ya domina sobre postre (2x)
function _swipeDims(dish: FeedDish): string[] {
  const types = dish.txDishType ?? []
  const ingredients = dish.txIngredient ?? []
  const primaryType = types.length > 0 ? getPrimaryDishType(types, '') : ''
  const primaryParent = primaryType ? (DISH_TYPE_TO_PARENT[primaryType] ?? '') : ''
  return [
    types.length === 0 ? `c:${dish.categoriaNorm}` : '', // fallback si no hay tipo
    dish.cuisineTag ? `k:${dish.cuisineTag}` : '',
    `d:${dish.dieta.tipo}`,
    `h:${dish.mealTime}`,
    ...dish.sabores.map(s => `s:${s}`),
    ...types.map(t => `t:${t}`),           // todos los tipos: 1x
    primaryType ? `t:${primaryType}` : '',  // tipo principal extra #1: 2x total
    primaryType ? `t:${primaryType}` : '',  // tipo principal extra #2: 3x total
    primaryParent ? `tp:${primaryParent}` : '', // familia del tipo: 1x
    ...ingredients.map(i => `i:${i}`),
  ].filter(Boolean)
}

// typeConfidence: 0→1 según cuántos swipes acumulados (ver activeFeedDishes).
// Los dims t: (tipo exacto) se escalan por este factor — exploración al inicio, convergencia al final.
// Los dims tp:/k:/s:/i:/d:/h: siempre pesan 1x para mantener diversidad.
function _swipeScore(
  dish: FeedDish,
  likeFreq: Record<string, number>,
  dislikeFreq: Record<string, number>,
  typeConfidence: number,
): number {
  let score = 0
  for (const dim of _swipeDims(dish)) {
    const net = (likeFreq[dim] ?? 0) - (dislikeFreq[dim] ?? 0) * 2
    // Tipos exactos (t:) se atenúan cuando hay pocos swipes — exploración progresiva
    score += dim.startsWith('t:') ? net * typeConfidence : net
  }
  return score
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

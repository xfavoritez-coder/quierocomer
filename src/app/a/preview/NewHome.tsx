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
import PublicarLocalView from '../components/PublicarLocalView'
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
import FeedMapView from '../components/FeedMapView'
import FeedTopNav from '../components/FeedTopNav'
import FeedFilterBar, { type FilterBarFilters } from '../components/FeedFilterBar'

const DEFAULT_SUSHI_SUGGESTIONS: { text: string; type: 'plato' | 'local' | 'categoría' | 'ingrediente' }[] = [
  { text: 'Sushi', type: 'categoría' },
  { text: 'Maki', type: 'plato' },
  { text: 'Sashimi', type: 'plato' },
  { text: 'Nigiri', type: 'plato' },
  { text: 'Rolls', type: 'plato' },
]

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

type View = 'feed' | 'perfil' | 'all-liked' | 'all-saved' | 'contacto' | 'publicar' | 'mapa'

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
  totalDishCount = 0,
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
  totalDishCount?: number
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
  const floatingInputRef = useRef<HTMLInputElement>(null)
  const desktopSearchRef = useRef<HTMLInputElement>(null)
  const [showFloatingSuggestions, setShowFloatingSuggestions] = useState(false)
  const [showDesktopSuggestions, setShowDesktopSuggestions] = useState(false)
  const mapGeocoderRef = useRef<((q: string) => void) | null>(null)
  const [filterMeal, setFilterMeal] = useState<'all' | 'desayuno' | 'almuerzo_cena'>('all')
  const [filterMealDisplay, setFilterMealDisplay] = useState<'all' | 'desayuno' | 'almuerzo' | 'cena'>('all')
  const [filterSort, setFilterSort] = useState<'default' | 'recent' | 'price-asc' | 'price-desc'>('default')
  const [quickNearby, setQuickNearby] = useState(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('nearby') === '1'
  })
  const [locationPromptDismissed, setLocationPromptDismissed] = useState(() => {
    try { return !!localStorage.getItem('qc_loc_prompt_hidden') } catch { return false }
  })
  const [locationPromptFading, setLocationPromptFading] = useState(false)
  const [locationTooltipReady, setLocationTooltipReady] = useState(false)
  const [quickPopular, setQuickPopular] = useState(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('popular') === '1'
  })
  const [filterMaxKm, setFilterMaxKm] = useState(() => {
    if (typeof window === 'undefined') return 5
    const km = parseInt(new URLSearchParams(window.location.search).get('maxKm') ?? '')
    return isNaN(km) ? 5 : km
  })
  const [filterDiet, setFilterDiet] = useState<'all' | 'VEGAN' | 'VEGETARIAN'>(() => {
    if (typeof window === 'undefined') return 'all'
    const d = new URLSearchParams(window.location.search).get('diet')
    return (d === 'VEGAN' || d === 'VEGETARIAN') ? d : 'all'
  })
  const [savedDishIds, setSavedDishIds] = useState<Set<string>>(new Set())
  // Track if user explicitly changed filterMaxKm from the modal (vs auto-set by GPS)
  const userSetMaxKm = useRef(false)
  const silentFetch = useRef(true) // first auto-location fetch is silent (no loading overlay)
  // Server-side search/filter results — null = browse mode (use initial dishes prop)
  const [serverDishes, setServerDishes] = useState<FeedDish[] | null>(null)
  const [isSearching, setIsSearching] = useState(() => {
    // Si la página carga con ?q= ya activo, mostrar loading desde el primer frame
    if (typeof window !== 'undefined') {
      return !!new URLSearchParams(window.location.search).get('q')
    }
    return false
  })

  // ─── Eureka / Descubrir ───────────────────────────────────────────────────
  // Initialize from localStorage so returning from /descubrir restores selections
  const [eurekaLiked, setEurekaLiked] = useState<FeedDish[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem('qc_eureka_liked')
      if (raw) return (JSON.parse(raw) as FeedDish[]).slice(0, 3)
    } catch {}
    return []
  })
  const eurekaMax = 3
  const eurekaMaxRef = useRef(3)
  const [showEurekaModal, setShowEurekaModal] = useState(false)
  // Pre-init to true when restoring 3 dishes — prevents modal re-trigger on return from /descubrir
  const [_eurekaAlreadyShown] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const raw = localStorage.getItem('qc_eureka_liked')
      return !!raw && JSON.parse(raw).length >= 3
    } catch { return false }
  })
  const eurekaModalShownRef = useRef(_eurekaAlreadyShown)
  const floatingHeaderRef = useRef<HTMLDivElement>(null)
  const [floatingHeaderH, setFloatingHeaderH] = useState(0)

  useEffect(() => {
    const el = floatingHeaderRef.current
    if (!el) return
    const obs = new ResizeObserver(() => setFloatingHeaderH(el.offsetHeight))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Persist eurekaLiked to localStorage on every change (including removals)
  useEffect(() => {
    try {
      if (eurekaLiked.length === 0) {
        localStorage.removeItem('qc_eureka_liked')
      } else {
        localStorage.setItem('qc_eureka_liked', JSON.stringify(eurekaLiked))
      }
    } catch {}
  }, [eurekaLiked])

  // Show milestone modal on first reach of eurekaMax; reset ref when cleared so it can trigger again
  useEffect(() => {
    if (eurekaLiked.length < eurekaMax) {
      eurekaModalShownRef.current = false
    } else if (!eurekaModalShownRef.current) {
      eurekaModalShownRef.current = true
      setShowEurekaModal(true)
    }
  }, [eurekaLiked.length, eurekaMax])

  const handleEurekaDescubrir = () => {
    if (eurekaLiked.length < eurekaMax) return
    try { localStorage.setItem('qc_eureka_liked', JSON.stringify(eurekaLiked)) } catch {}
    // Si venimos de q= a un local, scopear Descubrir a ese restaurante
    if (searchQuery) {
      const uniqueRestaurants = new Set(eurekaLiked.map(d => d.restauranteId))
      if (uniqueRestaurants.size === 1) {
        const restauranteId = eurekaLiked[0].restauranteId
        try { localStorage.setItem('qc_eureka_scoped_restaurant', restauranteId) } catch {}
      } else {
        try { localStorage.removeItem('qc_eureka_scoped_restaurant') } catch {}
      }
    } else {
      try { localStorage.removeItem('qc_eureka_scoped_restaurant') } catch {}
    }
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
    if (!locationTooltipReady) return  // no adjuntar hasta que el tooltip sea visible
    const onScroll = () => dismissLocationPrompt()
    window.addEventListener('scroll', onScroll, { once: true, passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [locationPromptDismissed, locationTooltipReady])
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

  // Random per client mount — stable for the whole session (no re-shuffle after hydration)
  const [shuffleSeed, setShuffleSeed] = useState(() => typeof window === 'undefined' ? 0 : Math.random())

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
    // Restore saved location from localStorage — silently, without enabling the nearby filter.
    // quickNearby only activates when the user explicitly taps the pill.
    try {
      const saved = localStorage.getItem('qc_location')
      if (saved) {
        const { lat, lng, label } = JSON.parse(saved)
        setUserLocation({ lat, lng })
        setGpsLabel(label)
        // Restaurar filtros guardados (nearby, maxKm) para que el feed respete el radio elegido
        try {
          const savedFilters = localStorage.getItem('qc_active_filters')
          if (savedFilters) {
            const { nearby, maxKm } = JSON.parse(savedFilters)
            if (nearby) setQuickNearby(true)
            if (maxKm != null) setFilterMaxKm(maxKm)
          }
        } catch {}
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
      // No setQuickNearby(true) — la ubicación se guarda silenciosamente para uso
      // cuando el usuario active el filtro "cerca de ti" explícitamente.
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

    // Restaurantes que hacen match en nombre (desde índice local)
    const seenRestaurants = new Set<string>()
    for (const d of matches) {
      if (normStr(d.restaurante).includes(q) && !seenRestaurants.has(d.restaurante)) {
        seenRestaurants.add(d.restaurante)
        results.push({ text: d.restaurante, type: 'local' })
        if (seenRestaurants.size >= 3) break
      }
    }

    // Restaurantes desde serverDishes (cubre locales nuevos no en cache ISR)
    if (serverDishes && seenRestaurants.size < 3) {
      for (const d of serverDishes) {
        if (normStr(d.restaurante).includes(q) && !seenRestaurants.has(d.restaurante)) {
          seenRestaurants.add(d.restaurante)
          results.push({ text: d.restaurante, type: 'local' })
          if (seenRestaurants.size >= 3) break
        }
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
  }, [searchInput, dishSearchIndex, ALL_QC_TERMS, serverDishes])

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
    // Fire-and-forget search tracking
    if (trimmed.length >= 2) {
      fetch('/api/feed/track-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      }).catch(() => {})
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

  // Determine if any filter requires a server fetch.
  // userLocation auto-detectada NO cuenta (no hay quickNearby sin acción explícita).
  // El servidor se consulta cuando el usuario activa un filtro explícito.
  const needsServerFetch = !!(
    searchQuery || activeCategory || filterDiet !== 'all' ||
    locationName || quickPopular ||
    (quickNearby && !!userLocation) // solo cuando usuario activó "cerca de ti"
  )

  useEffect(() => {
    if (!needsServerFetch) {
      setServerDishes(null)
      return
    }
    const delay = 0
    if (searchFetchRef.current) clearTimeout(searchFetchRef.current)
    searchFetchRef.current = setTimeout(() => {
      fetchServerDishes({
        q: searchQuery,
        categoryPill: activeCategory,
        diet: filterDiet,
        maxKm: quickNearby ? filterMaxKm : (searchQuery ? undefined : filterMaxKm),
        locationName,
        lat: quickNearby ? userLocation?.lat : undefined,
        lng: quickNearby ? userLocation?.lng : undefined,
      })
    }, delay)
    return () => { if (searchFetchRef.current) clearTimeout(searchFetchRef.current) }
    // userLocation excluida a propósito: la ubicación auto-detectada no dispara re-fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, activeCategory, filterDiet, filterMeal, filterMaxKm, locationName, quickPopular, needsServerFetch, fetchServerDishes])

  // Persistir filtros activos para /descubrir
  useEffect(() => {
    try { localStorage.setItem('qc_active_filters', JSON.stringify({ diet: filterDiet, maxKm: filterMaxKm, nearby: quickNearby })) } catch {}
  }, [filterDiet, filterMaxKm, quickNearby])

  // Sincronizar filtros compartibles en la URL
  useEffect(() => {
    const current = new URLSearchParams(window.location.search)
    if (quickPopular) current.set('popular', '1'); else current.delete('popular')
    if (filterDiet !== 'all') current.set('diet', filterDiet); else current.delete('diet')
    if (quickNearby) current.set('nearby', '1'); else current.delete('nearby')
    if (quickNearby && filterMaxKm !== 5) current.set('maxKm', String(filterMaxKm)); else current.delete('maxKm')
    const qs = current.toString()
    window.history.replaceState(null, '', qs ? `/?${qs}` : '/')
  }, [quickPopular, filterDiet, quickNearby, filterMaxKm])

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

    // Distance filter + sort — solo cuando el usuario activó explícitamente "cerca de ti"
    // (quickNearby). La ubicación auto-detectada no filtra ni reordena sola.
    if (userLocation && quickNearby) {
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
            const catRaw = profile.categoryScores[d.categoriaNorm] ?? 0
            const catNorm = catRaw > 0 ? Math.min(Math.log2(catRaw + 1) / 6, 1) : 0
            score = vScore * 0.6 + catNorm * 0.4 + popBase
          } else {
            score += popBase
            score += Math.min((profile.categoryScores[d.categoriaNorm] ?? 0) * 0.2, 8)
          }
          // Ruido determinístico por sesión: misma calidad de platos, orden distinto cada visita
          score += seededRandom(shuffleSeed, d.id) * 0.18
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
  }, [serverDishes, dishes, activeCategory, profile, vectorScoredIds, userLocation, filterMeal, filterSort, quickNearby, quickPopular, filterDiet, filterMaxKm, shuffleSeed])

  const isFiltered = !!(
    searchQuery || activeCategory || filterDiet !== 'all' || filterMeal !== 'all'
    || quickNearby || locationName
  )
  const displayDishCount = isFiltered ? feedDishes.length : (totalDishCount || feedDishes.length)

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
      // Actualizar categoryScores en vivo para que el feed re-sortee inmediatamente
      setLiveProfile(prev => {
        const base = prev ?? { ...createEmptyProfile(), categoryScores: { ...categoryScores }, keywordScores: { ...keywordScores } }
        const scores = { ...(base.categoryScores ?? {}) }
        scores[dish.categoriaNorm] = (scores[dish.categoriaNorm] ?? 0) + 12
        return { ...base, categoryScores: scores }
      })
      trackInteraction(dish.id, 'ANTOJO', dish.categoriaNorm, dish.precioDescuento ?? dish.precio).catch(() => {})
    } else {
      setSwipeDislikeFreq(prev => {
        const next = { ...prev }
        for (const d of dims) next[d] = (next[d] ?? 0) + 1
        return next
      })
    }
  }, [categoryScores, keywordScores])


  // Count of filters the user explicitly changed (shown as badge on "Más filtros" pill)
  const activeFilterCount = (filterDiet !== 'all' ? 1 : 0) + (filterSort !== 'default' ? 1 : 0) + (userSetMaxKm.current && filterMaxKm !== 5 ? 1 : 0) + (filterMeal !== 'all' ? 1 : 0)

  // Shared filter state object + handler for FeedFilterBar
  const feedFilters: FilterBarFilters = {
    diet: filterDiet, maxKm: filterMaxKm, sort: filterSort,
    meal: filterMeal, mealDisplay: filterMealDisplay,
    nearby: quickNearby, popular: quickPopular,
  }
  function handleFiltersChange(f: FilterBarFilters) {
    // Si el usuario movió el slider de distancia pero no tiene ubicación → pedir ubicación
    if (f.maxKm !== filterMaxKm && !userLocation) {
      setLocationModalOpen(true)
      return
    }
    if (f.maxKm !== filterMaxKm) userSetMaxKm.current = true
    setFilterDiet(f.diet); setFilterMaxKm(f.maxKm); setFilterSort(f.sort)
    setFilterMeal(f.meal); setFilterMealDisplay(f.mealDisplay)
    setQuickNearby(f.nearby); setQuickPopular(f.popular)
    setShuffleSeed(Math.random())
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

  // Logo / "Inicio" click: keeps active filters, only reshuffles + clears search
  function reshuffleFeed() {
    setView('feed')
    setActiveCategory(null)
    setSearchQuery('')
    setSearchInput('')
    setServerDishes(null)
    setShuffleSeed(Math.random())
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

                {/* Logo + brand */}
                <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)', margin: '0 0 8px' }}>Bienvenido a</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <img src="/logo.png" alt="QuieroComer" style={{ height: 36, opacity: 0.92 }} />
                  <span style={{ fontFamily: 'var(--font-feed-display), serif', fontSize: 22, fontWeight: 800, color: isDark ? '#fff' : '#111', letterSpacing: '-0.4px' }}>QuieroComer.cl</span>
                </div>

                <p style={{ fontSize: 15, fontWeight: 600, color: isDark ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.68)', textAlign: 'center', margin: '0 0 20px', lineHeight: 1.55 }}>
                  Desliza hacia la derecha si se te antoja y hacia la izquierda si no.
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
                  Junta 3 antojos y descubre qué comer
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
          <a href="/" onClick={e => { e.preventDefault(); reshuffleFeed() }} style={{ textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <img src="/logo.png" alt="QuieroComer" style={{ height: 36, width: 'auto' }} />
          </a>

          {/* Search bar — centro, ocupa todo el espacio */}
          <form style={{ flex: 1, position: 'relative', maxWidth: 480, margin: '0 auto' }} onSubmit={e => { e.preventDefault(); executeSearch(searchInput); desktopSearchRef.current?.blur(); setShowDesktopSuggestions(false) }}>
            <input
              ref={desktopSearchRef}
              className="feed-search-input"
              type="text" value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onFocus={() => { setShowDesktopSuggestions(true); setSearchFocused(true); searchTouched.current = true }}
              onBlur={() => { setTimeout(() => setShowDesktopSuggestions(false), 150); setSearchFocused(false) }}
              autoComplete="off"
              placeholder="Buscar sushi"
              style={{
                width: '100%', padding: '9px 34px 9px 16px', fontSize: 17,
                borderRadius: showDesktopSuggestions && !!(searchInput.trim().length >= 2 ? (searchSuggestions?.length || searchInput.trim().length >= 2) : true) ? '20px 20px 0 0' : 999,
                background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '2px solid rgba(0,0,0,0.07)',
                color: isDark ? '#fff' : '#111', outline: 'none', boxSizing: 'border-box',
              }}
            />
            {searchInput && (
              <button type="button" onClick={() => { setSearchInput(''); executeSearch(''); setShowDesktopSuggestions(false) }} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)', zIndex: 38,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
            {showDesktopSuggestions && typeof document !== 'undefined' && createPortal(
              (() => {
                const trimmedInput = searchInput.trim()
                const suggestions = trimmedInput.length >= 2 ? searchSuggestions : DEFAULT_SUSHI_SUGGESTIONS
                const fallbackSearch = trimmedInput.length >= 2 && !suggestions?.length ? trimmedInput : null
                if (!suggestions?.length && !fallbackSearch) return null
                const r = desktopSearchRef.current?.getBoundingClientRect()
                if (!r) return null
                return (
                  <div style={{
                    position: 'fixed', top: r.bottom - 2, left: r.left, width: r.width, zIndex: 99999,
                    background: isDark ? 'rgba(40,40,40,1)' : '#fff',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
                    borderTop: 'none',
                    borderRadius: '0 0 20px 20px', overflow: 'hidden',
                    boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)',
                    fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
                  }}>
                    <div style={{ height: 1, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', margin: '0 14px' }} />
                    {fallbackSearch ? (
                      <button
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { executeSearch(fallbackSearch); setShowDesktopSuggestions(false) }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
                          color: isDark ? 'rgba(255,255,255,0.85)' : '#111', fontSize: 15, textAlign: 'left',
                          fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0, opacity: 0.35 }}>
                          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                        </svg>
                        <span style={{ flex: 1 }}>Buscar &ldquo;{fallbackSearch}&rdquo;</span>
                      </button>
                    ) : suggestions!.map((s, i) => (
                      <button
                        key={`${s.type}-${s.text}`}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { executeSearch(s.text); setShowDesktopSuggestions(false) }}
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
                  <button onClick={() => { reshuffleFeed(); setDesktopMenuOpen(false) }} style={{
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

                  {/* Tengo un local */}
                  <button onClick={() => { setView('publicar'); window.scrollTo(0, 0); setDesktopMenuOpen(false) }} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 18px', background: 'none', border: 'none', cursor: 'pointer',
                    color: isDark ? 'rgba(255,255,255,0.85)' : '#111', fontSize: 14, textAlign: 'left', width: '100%', boxSizing: 'border-box',
                  }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    Tengo un local
                  </button>

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


        {/* Row 2: Top nav (FeedTopNav shared component) */}
        <FeedTopNav
          ref={searchInputRef}
          isDark={isDark}
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          onSearchClear={() => { setSearchInput(''); executeSearch(''); setShowSuggestions(false) }}
          onSearchSubmit={() => { executeSearch(searchInput); searchInputRef.current?.blur(); setShowSuggestions(false) }}
          onLogoClick={reshuffleFeed}
          onMenuOpen={() => setMenuOpen(true)}
          onSearchFocus={() => { setShowSuggestions(true); setSearchFocused(true); searchTouched.current = true }}
          onSearchBlur={() => { setTimeout(() => setShowSuggestions(false), 150); setSearchFocused(false) }}
          placeholder="Buscar sushi"
          suggestionsOpen={showSuggestions && !!(searchInput.trim().length >= 2 ? (searchSuggestions?.length || searchInput.trim().length >= 2) : true)}
        >
          {/* Dropdown de sugerencias — portal en body para escapar stacking context */}
          {showSuggestions && typeof document !== 'undefined' && createPortal(
            (() => {
              const trimmedInput = searchInput.trim()
              const suggestions = trimmedInput.length >= 2 ? searchSuggestions : DEFAULT_SUSHI_SUGGESTIONS
              const fallbackSearch = trimmedInput.length >= 2 && !suggestions?.length ? trimmedInput : null
              if (!suggestions?.length && !fallbackSearch) return null
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
                  {fallbackSearch ? (
                    <button
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { executeSearch(fallbackSearch); setShowSuggestions(false) }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
                        color: isDark ? 'rgba(255,255,255,0.85)' : '#111', fontSize: 15, textAlign: 'left',
                        fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0, opacity: 0.35 }}>
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                      <span style={{ flex: 1 }}>Buscar &ldquo;{fallbackSearch}&rdquo;</span>
                    </button>
                  ) : suggestions!.map((s, i) => (
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
        </FeedTopNav>

        {/* Row 3: Filter pills (FeedFilterBar shared component) */}
        {view !== 'perfil' && view !== 'contacto' && view !== 'publicar' && (
          <FeedFilterBar
            isDark={isDark}
            userLocation={userLocation}
            locationLabel={locationName || gpsLabel}
            filters={feedFilters}
            activeFilterCount={activeFilterCount}
            onLocationClick={() => { dismissLocationPrompt(); setLocationModalOpen(true) }}
            onFiltersChange={handleFiltersChange}
            showLocationRow={false}
          />
        )}

        {/* Row 4: Ubicación + badge distancia en la misma línea */}
        <div style={{ display: view === 'perfil' || view === 'contacto' || view === 'publicar' ? 'none' : 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
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
          <span style={{
            flexShrink: 0, fontSize: 14, fontWeight: 500,
            color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
            whiteSpace: 'nowrap',
          }}>
            {displayDishCount.toLocaleString('es-CL')} platos
          </span>
        </div>

      </header>

      {/* ─── Floating search bar — aparece al subir el scroll — mobile only ─── */}
      {!isDesktop && view !== 'perfil' && view !== 'contacto' && view !== 'publicar' && (
        <div ref={floatingHeaderRef} style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 36,
          padding: '10px 16px',
          background: isDark ? 'rgba(14,14,14,0.97)' : 'rgba(245,244,241,0.97)',
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
          transform: showFloatingSearch ? 'translateY(0)' : 'translateY(-110%)',
          transition: showFloatingSearch ? 'transform 0.28s cubic-bezier(0.0, 0.0, 0.2, 1)' : 'none',
          boxShadow: showFloatingSearch ? '0 2px 16px rgba(0,0,0,0.10)' : 'none',
        }}>
          <FeedTopNav
            ref={floatingInputRef}
            isDark={isDark}
            searchValue={searchInput}
            onSearchChange={setSearchInput}
            onSearchClear={() => { setSearchInput(''); executeSearch(''); setShowFloatingSuggestions(false) }}
            onSearchSubmit={() => { executeSearch(searchInput); floatingInputRef.current?.blur(); setShowFloatingSuggestions(false) }}
            onLogoClick={reshuffleFeed}
            onMenuOpen={() => setMenuOpen(true)}
            onSearchFocus={() => { setShowFloatingSuggestions(true); setSearchFocused(true); searchTouched.current = true }}
            onSearchBlur={() => { setTimeout(() => setShowFloatingSuggestions(false), 150); setSearchFocused(false) }}
            placeholder="Buscar sushi"
            suggestionsOpen={showFloatingSuggestions && !!(searchInput.trim().length >= 2 ? (searchSuggestions?.length || searchInput.trim().length >= 2) : true)}
          >
            {showFloatingSuggestions && typeof document !== 'undefined' && createPortal(
              (() => {
                const trimmedInput = searchInput.trim()
                const suggestions = trimmedInput.length >= 2 ? searchSuggestions : DEFAULT_SUSHI_SUGGESTIONS
                const fallbackSearch = trimmedInput.length >= 2 && !suggestions?.length ? trimmedInput : null
                if (!suggestions?.length && !fallbackSearch) return null
                const r = floatingInputRef.current?.getBoundingClientRect()
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
                    {fallbackSearch ? (
                      <button
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { executeSearch(fallbackSearch); setShowFloatingSuggestions(false) }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
                          color: isDark ? 'rgba(255,255,255,0.85)' : '#111', fontSize: 15, textAlign: 'left',
                          fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink: 0, opacity: 0.35 }}>
                          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                        </svg>
                        <span style={{ flex: 1 }}>Buscar &ldquo;{fallbackSearch}&rdquo;</span>
                      </button>
                    ) : suggestions!.map((s, i) => (
                      <button
                        key={`${s.type}-${s.text}`}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => { executeSearch(s.text); setShowFloatingSuggestions(false) }}
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
          </FeedTopNav>
          <FeedFilterBar
            isDark={isDark}
            userLocation={userLocation}
            locationLabel={locationName || gpsLabel}
            filters={feedFilters}
            activeFilterCount={activeFilterCount}
            onLocationClick={() => { dismissLocationPrompt(); setLocationModalOpen(true) }}
            onFiltersChange={handleFiltersChange}
            showLocationRow={false}
          />
        </div>
      )}

      {/* ─── Eureka pill flotante ─── */}
      {eurekaLiked.length > 0 && view !== 'perfil' && view !== 'contacto' && view !== 'publicar' && view !== 'mapa' && (
        <div style={{
          position: 'fixed', left: 0, right: 0, zIndex: 35,
          bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          display: 'flex', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 16px',
            background: isDark ? 'rgba(14,14,14,0.97)' : 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            borderRadius: 999,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            pointerEvents: 'auto',
          }}>
            {eurekaLiked.length < eurekaMax && (
              <div style={{ flexShrink: 0, marginRight: 4 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)', lineHeight: 1.25, textAlign: 'right' }}>
                  Descubre<br />qué comer
                </p>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', lineHeight: 1.3, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)', textAlign: 'right' }}>
                  {`Desliza ${eurekaMax - eurekaLiked.length} más`}
                </p>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {Array.from({ length: eurekaMax }).map((_, i) => {
                const dish = eurekaLiked[i]
                return dish ? (
                  <div key={dish.id} style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
                    <div
                      onClick={() => setSelectedDish(dish)}
                      style={{ width: 64, height: 64, borderRadius: 14, overflow: 'hidden', border: '2px solid #F4A623', cursor: 'pointer' }}
                    >
                      {dish.fotoUrl && <img src={dish.fotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEurekaLiked(prev => prev.filter(d => d.id !== dish.id)) }}
                      style={{
                        position: 'absolute', top: -8, right: -8,
                        width: 24, height: 24, borderRadius: '50%',
                        background: isDark ? '#333' : '#fff',
                        border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)'}`,
                        color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.6)',
                        fontSize: 11, fontWeight: 700, lineHeight: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', padding: 0, zIndex: 1,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                      }}
                    >✕</button>
                  </div>
                ) : (
                  <div key={i} style={{
                    width: 64, height: 64, flexShrink: 0, borderRadius: 14,
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
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
        </div>
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
        onPublicar={() => { setView('publicar'); window.scrollTo(0, 0) }}
        activeView={view}
      />

      {/* ─── Feed View / Mapa View ─── */}
      {(view === 'feed' || view === 'mapa') && (
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
                  setQuickNearby(true)
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
          {feedDishes.length > 0 && view !== 'mapa' && (
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
                  <span style={{
                    fontSize: 12, fontWeight: 500,
                    color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
                    whiteSpace: 'nowrap',
                  }}>
                    {displayDishCount.toLocaleString('es-CL')} platos
                  </span>
                </div>
              )}
              <div style={{ flex: 1 }} />
              {isDesktop && (
                <FeedFilterBar
                  isDark={isDark}
                  userLocation={userLocation}
                  locationLabel={locationName || gpsLabel}
                  filters={feedFilters}
                  activeFilterCount={activeFilterCount}
                  onLocationClick={() => setLocationModalOpen(true)}
                  onFiltersChange={handleFiltersChange}
                  showLocationRow={false}
                />
              )}
            </div>
          )}

          {/* Map view */}
          {view === 'mapa' && (
            <FeedMapView
              dishes={feedDishes}
              isDark={isDark}
              onDishTap={handleDishTap}
              geocodeRef={mapGeocoderRef}
              userLocation={userLocation}
              userLocationLabel={locationName || gpsLabel || null}
              isSearching={isSearching}
            />
          )}

          {/* Feed masonry */}
          {view !== 'mapa' && isSearching && searchQuery && !serverDishes ? (
            /* Skeleton mientras carga búsqueda con q= en URL */
            <div style={{ display: 'flex', gap: 10, padding: '6px 12px 40px' }}>
              {(isDesktop ? [0, 1, 2, 3] : [0, 1]).map(col => (
                <div key={col} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="skeleton-shimmer" style={{ aspectRatio: col % 2 === 0 ? '3/4' : '4/5', borderRadius: 14 }} />
                  ))}
                </div>
              ))}
            </div>
          ) : view !== 'mapa' && feedDishes.length > 0 ? (
            <>
              <div style={{ marginTop: -6 }} />
              <div style={{ position: 'relative', paddingBottom: eurekaLiked.length > 0 ? 90 : 0, transition: 'padding-bottom 0.28s cubic-bezier(0.0,0.0,0.2,1)' }}>
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
          ) : view !== 'mapa' ? (
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
          ) : null}
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

      {/* ─── Publicar Local View ─── */}
      {view === 'publicar' && (
        <PublicarLocalView onBack={() => { setView('feed'); window.scrollTo(0, 0) }} isDark={isDark} />
      )}

      {/* ─── All Liked View ─── */}
      {view === 'all-liked' && (
        <div style={{ padding: '8px 3px 100px' }}>
          <div style={{ padding: '8px 16px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setView('perfil')} style={{ background: 'none', border: 'none', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)', cursor: 'pointer', padding: 0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
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
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
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
          scopedRestaurantId={searchQuery ? selectedDish.restauranteId : null}
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
              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 24 }}>
                {eurekaLiked.slice(0, eurekaMax).map((d, i) => (
                  <div key={d.id} style={{
                    width: 72, height: 72, borderRadius: 14, overflow: 'hidden',
                    flexShrink: 0,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.22)',
                    border: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
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

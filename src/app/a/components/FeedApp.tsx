'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { FeedDish } from '../types'
import {
  createEmptyProfile,
  updateProfile,
  getRecommendationReason,
  type FeedProfile,
} from '../lib/scoring'
import {
  trackInteraction,
  rateDish,
  saveDish,
  unsaveDish,
  completeOnboarding,
} from '../lib/feed-actions'
import FeedFilters, { applyFilters, getDefaultFilters, type Filters } from './FeedFilters'
import MasonryGrid from './MasonryGrid'
import HomeFeed from './HomeFeed'
import FeedGrid from './FeedGrid'
import ExploreGrid from './ExploreGrid'
import SavedList from './SavedList'
import ProfileView from './ProfileView'
import BottomNav from './BottomNav'
import DishModal from './DishModal'

type Tab = 'inicio' | 'feed' | 'explorar' | 'guardados' | 'perfil'

type UserDiet = {
  isVegan: boolean
  isVegetarian: boolean
  isGlutenFree: boolean
  isLactoseFree: boolean
}

type SavedProfile = {
  categoryScores: Record<string, number>
  restaurantScores: Record<string, number>
  keywordScores: Record<string, number>
  totalInteractions: number
}

export default function FeedApp({ dishes, userDiet, savedProfile, savedDishes: savedDishesFromDB }: {
  dishes: FeedDish[]
  userDiet: UserDiet
  savedProfile?: SavedProfile
  savedDishes?: { dishId: string; type: string }[]
}) {
  const [activeTab, setActiveTab] = useState<Tab>('feed')
  const [selectedDish, setSelectedDish] = useState<FeedDish | null>(null)
  const [profile, setProfile] = useState<FeedProfile>(() => {
    const base = createEmptyProfile()
    if (savedProfile) {
      base.categoryScores = savedProfile.categoryScores
      base.restaurantScores = savedProfile.restaurantScores
      base.keywordScores = savedProfile.keywordScores
      base.totalInteractions = savedProfile.totalInteractions
    }
    return base
  })
  const [antojoDishIds, setAntojoDishIds] = useState<Set<string>>(() =>
    new Set(savedDishesFromDB?.filter(s => s.type === 'ANTOJO').map(s => s.dishId) ?? [])
  )
  const [savedDishIds, setSavedDishIds] = useState<Set<string>>(() =>
    new Set(savedDishesFromDB?.filter(s => s.type === 'SAVED').map(s => s.dishId) ?? [])
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'asking' | 'granted' | 'denied'>('idle')
  const [locationToast, setLocationToast] = useState<string | null>(null)

  // Request geolocation on mount
  useEffect(() => {
    // Check if already granted
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        if (result.state === 'granted') {
          setLocationStatus('granted')
          navigator.geolocation.getCurrentPosition(
            pos => {
              setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
            },
            () => setLocationStatus('denied'),
            { enableHighAccuracy: false, timeout: 5000 }
          )
        }
      }).catch(() => {})
    }
  }, [])

  const requestLocation = useCallback(() => {
    setLocationStatus('asking')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocationStatus('granted')
        setLocationToast('📍 Ubicación activada')
        setTimeout(() => setLocationToast(null), 3000)
      },
      () => {
        setLocationStatus('denied')
        setLocationToast('No pudimos obtener tu ubicación')
        setTimeout(() => setLocationToast(null), 3000)
      },
      { enableHighAccuracy: false, timeout: 8000 }
    )
  }, [])
  const [diet, setDiet] = useState<UserDiet>(userDiet)

  const [filters, setFilters] = useState<Filters>(() => getDefaultFilters())

  // Apply filters to dishes
  const filteredDishes = useMemo(() => applyFilters(dishes, filters), [dishes, filters])

  const dishMap = useMemo(() => {
    const map = new Map<string, FeedDish>()
    dishes.forEach(d => map.set(d.id, d))
    return map
  }, [dishes])

  const antojoDishes = useMemo(
    () => [...antojoDishIds].map(id => dishMap.get(id)).filter(Boolean) as FeedDish[],
    [antojoDishIds, dishMap],
  )
  const savedDishes = useMemo(
    () => [...savedDishIds].map(id => dishMap.get(id)).filter(Boolean) as FeedDish[],
    [savedDishIds, dishMap],
  )

  // Search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null
    const q = searchQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const results = dishes.filter(d => {
      const name = d.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const rest = d.restaurante.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const cat = d.categoriaNorm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      return name.includes(q) || rest.includes(q) || cat.includes(q)
    })
    return applyFilters(results, filters)
  }, [searchQuery, dishes, filters])

  const isSearching = searchQuery.trim().length > 0

  const doTrack = useCallback(async (
    dish: FeedDish,
    action: 'VIEW' | 'TAP' | 'LIKE' | 'SAVE' | 'ANTOJO' | 'PASS' | 'SCROLL_BACK',
  ) => {
    const newProfile = updateProfile(profile, dish, action)
    setProfile(newProfile)
    trackInteraction(dish.id, action, dish.categoriaNorm, dish.precioDescuento ?? dish.precio).catch(() => {})
  }, [profile])

  const handleDishTap = useCallback((dish: FeedDish) => {
    setSelectedDish(dish)
    doTrack(dish, 'TAP')
  }, [doTrack])

  const handleDishDwell = useCallback((dishId: string) => {
    setProfile(prev => {
      const { registerDwell } = require('../lib/scoring')
      return registerDwell(prev, dishId)
    })
  }, [])

  const handleDishLike = useCallback((dish: FeedDish) => {
    doTrack(dish, 'LIKE')
  }, [doTrack])

  const handleDishSave = useCallback((dish: FeedDish) => {
    doTrack(dish, 'SAVE')
    setSavedDishIds(prev => new Set([...prev, dish.id]))
    saveDish(dish.id, 'SAVED').catch(() => {})
  }, [doTrack])

  const handleDishAntojo = useCallback((dish: FeedDish) => {
    doTrack(dish, 'ANTOJO')
    setAntojoDishIds(prev => new Set([...prev, dish.id]))
    saveDish(dish.id, 'ANTOJO').catch(() => {})
  }, [doTrack])

  const handleDishPass = useCallback((dish: FeedDish) => {
    doTrack(dish, 'PASS')
  }, [doTrack])

  const handleDishRate = useCallback((dish: FeedDish, stars: number) => {
    const scoreAction = stars >= 4 ? 'RATE_HIGH' : stars <= 2 ? 'RATE_LOW' : null
    if (scoreAction) {
      const newProfile = updateProfile(profile, dish, scoreAction as any)
      setProfile(newProfile)
    }
    rateDish(dish.id, stars).catch(() => {})
  }, [profile])

  const handleRemoveSaved = useCallback((dishId: string) => {
    setAntojoDishIds(prev => { const n = new Set(prev); n.delete(dishId); return n })
    setSavedDishIds(prev => { const n = new Set(prev); n.delete(dishId); return n })
    unsaveDish(dishId).catch(() => {})
  }, [])

  const handleResetProfile = useCallback(() => {
    setProfile(createEmptyProfile())
  }, [])

  const handleUpdateDiet = useCallback(async (newDiet: UserDiet) => {
    setDiet(newDiet)
    completeOnboarding(newDiet).catch(() => {})
  }, [])

  const selectedReason = selectedDish ? getRecommendationReason(selectedDish, profile) : null

  return (
    <div className="feed-container">
      {/* Header */}
      <header className="feed-header">
        {!searchOpen ? (
          <>
            <a href="/a" style={{ textDecoration: 'none', flexShrink: 0 }}><h1>QuieroComer</h1></a>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button onClick={() => setSearchOpen(true)} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                color: 'rgba(255,255,255,0.5)',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </button>
              <button onClick={() => setMenuOpen(!menuOpen)} style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                color: 'rgba(255,255,255,0.5)',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 12px',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar plato, restaurante..." autoFocus
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 14 }} />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.3)',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button onClick={() => { setSearchOpen(false); setSearchQuery('') }} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 13, flexShrink: 0,
            }}>
              Cerrar
            </button>
          </div>
        )}
      </header>

      {/* Hamburger menu — slide-in panel */}
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{
            position: 'fixed', inset: 0, zIndex: 55,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          }} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 56,
            width: 260, maxWidth: '75vw',
            background: '#141414', borderLeft: '1px solid rgba(255,255,255,0.06)',
            padding: '60px 20px 40px', display: 'flex', flexDirection: 'column', gap: 4,
            animation: 'slideRight 0.2s ease-out',
          }}>
            <button onClick={() => setMenuOpen(false)} style={{
              position: 'absolute', top: 16, right: 16,
              background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {[
              { label: '🏠 Inicio', href: '/a' },
              { label: '💛 Favoritos', action: () => { setMenuOpen(false); setActiveTab('guardados' as Tab); window.scrollTo(0, 0) } },
              { label: '👤 Mi perfil', action: () => { setMenuOpen(false); setActiveTab('perfil' as Tab); window.scrollTo(0, 0) } },
            ].map((item, i) => (
              item.href ? (
                <a key={i} href={item.href} style={{
                  display: 'block', padding: '14px 16px', borderRadius: 12, fontSize: 15, fontWeight: 500,
                  color: '#fff', textDecoration: 'none',
                  background: 'rgba(255,255,255,0.03)',
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
        </>
      )}

      {/* Filters */}
      {activeTab === 'feed' && (
        <FeedFilters filters={filters} onChange={setFilters} noGreeting />
      )}


      {/* Content */}
      {isSearching && searchResults ? (
        <div>
          <div style={{ padding: '4px 12px 8px', color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>
            {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''} para "{searchQuery}"
          </div>
          {searchResults.length > 0 ? (
            <MasonryGrid dishes={searchResults.slice(0, 40)} onDishTap={handleDishTap} onDishLike={handleDishLike} />
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.3)' }}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>🔍</p>
              <p style={{ fontSize: 14 }}>No encontramos platos con "{searchQuery}"</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {activeTab === 'feed' && (
            <>
              {/* Location banner */}
              {!userLocation && locationStatus !== 'denied' && (
                <div style={{
                  margin: '0 14px 12px', padding: '12px 16px', borderRadius: 12,
                  background: 'rgba(244,166,35,0.06)', border: '1px solid rgba(244,166,35,0.12)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 20 }}>📍</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, color: '#fff', margin: 0, fontWeight: 500 }}>
                      Platos cerca de ti
                    </p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>
                      Activa tu ubicación para ver restaurantes cercanos
                    </p>
                  </div>
                  <button onClick={requestLocation} style={{
                    padding: '8px 14px', borderRadius: 10,
                    background: '#F4A623', color: '#000', fontWeight: 600,
                    fontSize: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
                  }}>
                    {locationStatus === 'asking' ? '...' : 'Activar'}
                  </button>
                </div>
              )}
            </>
          )}
          {activeTab === 'feed' && (
            <ExploreGrid dishes={filteredDishes} onDishTap={handleDishTap} onDishLike={handleDishLike} userLocation={userLocation} />
          )}
        </>
      )}

      {activeTab === 'guardados' && (
        <SavedList antojos={antojoDishes} saved={savedDishes} onDishTap={handleDishTap} onRemove={handleRemoveSaved} />
      )}

      {activeTab === 'perfil' && (
        <ProfileView profile={profile} diet={diet} onReset={handleResetProfile} onUpdateDiet={handleUpdateDiet} />
      )}

      {/* Modal */}
      {selectedDish && (
        <DishModal
          key={selectedDish.id}
          dish={selectedDish}
          allDishes={dishes}
          profile={profile}
          reason={selectedReason}
          onClose={() => setSelectedDish(null)}
          onLike={handleDishLike}
          onSave={handleDishSave}
          onPass={handleDishPass}
          onRate={handleDishRate}
          onDishTap={handleDishTap}
        />
      )}

      {/* Location toast */}
      {locationToast && (
        <div style={{
          position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
          zIndex: 80, padding: '10px 20px', borderRadius: 12,
          background: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#fff', fontSize: 13, fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          animation: 'fadeIn 0.3s ease-out',
        }}>
          {locationToast}
        </div>
      )}

      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  )
}

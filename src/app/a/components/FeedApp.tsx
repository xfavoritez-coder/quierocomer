'use client'

import { useState, useCallback, useMemo } from 'react'
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
import FeedGrid from './FeedGrid'
import ExploreGrid from './ExploreGrid'
import SavedList from './SavedList'
import ProfileView from './ProfileView'
import BottomNav from './BottomNav'
import DishModal from './DishModal'

type Tab = 'feed' | 'explorar' | 'guardados' | 'perfil'

type UserDiet = {
  isVegan: boolean
  isVegetarian: boolean
  isGlutenFree: boolean
  isLactoseFree: boolean
}

export default function FeedApp({ dishes, userDiet }: { dishes: FeedDish[]; userDiet: UserDiet }) {
  const [activeTab, setActiveTab] = useState<Tab>('feed')
  const [selectedDish, setSelectedDish] = useState<FeedDish | null>(null)
  const [profile, setProfile] = useState<FeedProfile>(createEmptyProfile)
  const [antojoDishIds, setAntojoDishIds] = useState<Set<string>>(new Set())
  const [savedDishIds, setSavedDishIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [diet, setDiet] = useState<UserDiet>(userDiet)

  // Filters — default to suggested meal time + user diet
  const [filters, setFilters] = useState<Filters>(() => getDefaultFilters(userDiet))

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
    if (newDiet.isVegan) setFilters(f => ({ ...f, diet: 'VEGAN' as const }))
    else if (newDiet.isVegetarian) setFilters(f => ({ ...f, diet: 'VEGETARIAN' as const }))
    else setFilters(f => ({ ...f, diet: 'all' as const }))
    completeOnboarding(newDiet).catch(() => {})
  }, [])

  const selectedReason = selectedDish ? getRecommendationReason(selectedDish, profile) : null

  return (
    <div className="feed-container">
      {/* Header */}
      <header className="feed-header">
        {!searchOpen ? (
          <>
            <a href="/" style={{ textDecoration: 'none' }}><h1>QuieroComer</h1></a>
            <button onClick={() => setSearchOpen(true)} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              color: 'rgba(255,255,255,0.5)',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </button>
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

      {/* Filters - only in feed tab */}
      {activeTab === 'feed' && (
        <FeedFilters filters={filters} onChange={setFilters} />
      )}

      {/* Learning banner */}
      {activeTab === 'feed' && !isSearching && profile.totalInteractions < 15 && (
        <div className="learning-banner">
          <span className="learning-sparkle">✨</span>
          <span className="learning-text">Aprendiendo de tus gustos</span>
          <span className="learning-dots">
            <span className="learning-dot" />
            <span className="learning-dot" />
            <span className="learning-dot" />
          </span>
        </div>
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
            <FeedGrid dishes={filteredDishes} profile={profile} onDishTap={handleDishTap} onDishLike={handleDishLike} />
          )}
          {activeTab === 'explorar' && (
            <ExploreGrid dishes={dishes} onDishTap={handleDishTap} onDishLike={handleDishLike} />
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
          dish={selectedDish}
          reason={selectedReason}
          onClose={() => setSelectedDish(null)}
          onLike={handleDishLike}
          onSave={handleDishSave}
          onAntojo={handleDishAntojo}
          onPass={handleDishPass}
          onRate={handleDishRate}
        />
      )}

      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  )
}

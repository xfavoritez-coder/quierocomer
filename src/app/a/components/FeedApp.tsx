'use client'

import { useState, useCallback, useMemo } from 'react'
import type { FeedDish } from '../types'
import {
  createEmptyProfile,
  updateProfile,
  rankFeed,
  getCalibrationStatus,
  getRecommendationReason,
  type FeedProfile,
} from '../lib/scoring'
import {
  trackInteraction,
  rateDish,
  saveDish,
  unsaveDish,
} from '../lib/feed-actions'
import FeedGrid from './FeedGrid'
import ExploreGrid from './ExploreGrid'
import SavedList from './SavedList'
import ProfileView from './ProfileView'
import BottomNav from './BottomNav'
import DishModal from './DishModal'

type Tab = 'feed' | 'explorar' | 'guardados' | 'perfil'

export default function FeedApp({ dishes }: { dishes: FeedDish[] }) {
  const [activeTab, setActiveTab] = useState<Tab>('feed')
  const [selectedDish, setSelectedDish] = useState<FeedDish | null>(null)
  const [profile, setProfile] = useState<FeedProfile>(createEmptyProfile)
  const [feedDishes, setFeedDishes] = useState(dishes)

  // Track saved dishes locally
  const [antojoDishIds, setAntojoDishIds] = useState<Set<string>>(new Set())
  const [savedDishIds, setSavedDishIds] = useState<Set<string>>(new Set())

  const calibration = getCalibrationStatus(profile)

  // Build saved/antojo dish lists from IDs
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

  // Re-rank feed after profile changes
  const rerank = useCallback((newProfile: FeedProfile) => {
    setFeedDishes(rankFeed(dishes, newProfile))
  }, [dishes])

  const doTrack = useCallback(async (
    dish: FeedDish,
    action: 'VIEW' | 'TAP' | 'LIKE' | 'SAVE' | 'ANTOJO' | 'PASS' | 'SCROLL_BACK',
  ) => {
    const newProfile = updateProfile(profile, dish, action)
    setProfile(newProfile)
    rerank(newProfile)

    trackInteraction(
      dish.id,
      action,
      dish.categoriaNorm,
      dish.precioDescuento ?? dish.precio,
    ).catch(() => {})
  }, [profile, rerank])

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
      rerank(newProfile)
    }
    rateDish(dish.id, stars).catch(() => {})
  }, [profile, rerank])

  const handleRemoveSaved = useCallback((dishId: string) => {
    setAntojoDishIds(prev => { const n = new Set(prev); n.delete(dishId); return n })
    setSavedDishIds(prev => { const n = new Set(prev); n.delete(dishId); return n })
    unsaveDish(dishId).catch(() => {})
  }, [])

  const handleResetProfile = useCallback(() => {
    setProfile(createEmptyProfile())
    setFeedDishes(dishes)
  }, [dishes])

  const selectedReason = selectedDish
    ? getRecommendationReason(selectedDish, profile)
    : null

  return (
    <div className="max-w-[460px] mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0e0e0e]/90 backdrop-blur-lg border-b border-white/[0.04] px-4 py-2.5">
        <div className="flex items-center justify-between">
          <h1
            className="text-lg font-bold text-white"
            style={{ fontFamily: 'var(--font-feed-display), serif' }}
          >
            QuieroComer
          </h1>
          {calibration.isCalibrating && activeTab === 'feed' && (
            <span className="text-[#F4A623]/50 text-[10px] font-medium animate-pulse">
              {calibration.message}
            </span>
          )}
        </div>
      </header>

      {/* Content */}
      {activeTab === 'feed' && (
        <FeedGrid
          dishes={feedDishes}
          profile={profile}
          onDishTap={handleDishTap}
          onDishLike={handleDishLike}
        />
      )}

      {activeTab === 'explorar' && (
        <ExploreGrid
          dishes={dishes}
          onDishTap={handleDishTap}
          onDishLike={handleDishLike}
        />
      )}

      {activeTab === 'guardados' && (
        <SavedList
          antojos={antojoDishes}
          saved={savedDishes}
          onDishTap={handleDishTap}
          onRemove={handleRemoveSaved}
        />
      )}

      {activeTab === 'perfil' && (
        <ProfileView
          profile={profile}
          onReset={handleResetProfile}
        />
      )}

      {/* Modal inmersivo */}
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

      {/* Bottom nav */}
      <BottomNav active={activeTab} onChange={setActiveTab} />
    </div>
  )
}

'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import type { FeedDish } from '../types'
import { getDisplayCategories } from '../lib/categories'
import { extractKeywords } from '../lib/keywords'
import MasonryGrid from './MasonryGrid'

export default function ExploreGrid({
  dishes,
  onDishTap,
  onDishLike,
  onDishDislike,
  onDishUndo,
  userLocation,
  likedIds,
  dislikedIds,
  savedKeywordScores,
  savedCategoryScores,
}: {
  dishes: FeedDish[]
  onDishTap: (dish: FeedDish) => void
  onDishLike?: (dish: FeedDish) => void
  onDishDislike?: (dish: FeedDish) => void
  onDishUndo?: (dish: FeedDish) => void
  userLocation?: { lat: number; lng: number } | null
  likedIds?: Set<string>
  dislikedIds?: Set<string>
  savedKeywordScores?: Record<string, number>
  savedCategoryScores?: Record<string, number>
}) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(20)

  const categories = useMemo(() => {
    const display = getDisplayCategories()
    const available = new Set(dishes.map(d => d.categoriaNorm))
    return display.filter(c => available.has(c))
  }, [dishes])

  const hasOfertas = useMemo(() => dishes.some(d => d.enOferta), [dishes])

  // Merge saved profile scores + live session scores
  const mergedKeywordScores = useMemo(() => {
    // Start with saved scores from BD
    const scores: Record<string, number> = { ...(savedKeywordScores ?? {}) }

    // Add live session likes/dislikes (stronger weight)
    for (const dish of dishes) {
      const kws = extractKeywords(dish.nombre, dish.descripcion)
      if (likedIds?.has(dish.id)) {
        for (const kw of kws) scores[kw] = (scores[kw] ?? 0) + 8
      }
      if (dislikedIds?.has(dish.id)) {
        for (const kw of kws) scores[kw] = (scores[kw] ?? 0) - 12
      }
    }
    return scores
  }, [dishes, likedIds, dislikedIds, savedKeywordScores])

  // Live-scored feed that reacts to swipes
  const sorted = useMemo(() => {
    let filtered = dishes
    if (activeCategory === 'ofertas') filtered = dishes.filter(d => d.enOferta)
    else if (activeCategory) filtered = dishes.filter(d => d.categoriaNorm === activeCategory)

    return [...filtered].sort((a, b) => {
      // Disliked dishes go to the very bottom
      const aDisliked = dislikedIds?.has(a.id) ? 1 : 0
      const bDisliked = dislikedIds?.has(b.id) ? 1 : 0
      if (aDisliked !== bDisliked) return aDisliked - bDisliked

      let aScore = 0
      let bScore = 0

      // Category score from saved profile
      const catScores = savedCategoryScores ?? {}
      aScore += (catScores[a.categoriaNorm] ?? 0) * 0.3
      bScore += (catScores[b.categoriaNorm] ?? 0) * 0.3

      // Keyword overlap with profile + session
      const aKws = extractKeywords(a.nombre, a.descripcion)
      const bKws = extractKeywords(b.nombre, b.descripcion)

      for (const kw of aKws) aScore += (mergedKeywordScores[kw] ?? 0)
      for (const kw of bKws) bScore += (mergedKeywordScores[kw] ?? 0)

      // Base popularity (low weight)
      aScore += a.popularityScore * 0.05
      bScore += b.popularityScore * 0.05

      // Random noise for variety
      aScore += Math.random() * 3
      bScore += Math.random() * 3

      return bScore - aScore
    })
  }, [dishes, activeCategory, mergedKeywordScores, dislikedIds, savedCategoryScores])

  useEffect(() => { setVisibleCount(20) }, [activeCategory])

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + 20, sorted.length))
  }, [sorted.length])

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 800 && visibleCount < sorted.length) {
        loadMore()
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [visibleCount, sorted.length, loadMore])

  return (
    <div>
      <div className="category-chips">
        <button onClick={() => setActiveCategory(null)}
          className={`category-chip ${activeCategory === null ? 'active' : ''}`}>
          Todas
        </button>
        {hasOfertas && (
          <button onClick={() => setActiveCategory('ofertas')}
            className={`category-chip ofertas ${activeCategory === 'ofertas' ? 'active' : ''}`}>
            🏷️ Ofertas
          </button>
        )}
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`category-chip ${activeCategory === cat ? 'active' : ''}`}>
            {cat}
          </button>
        ))}
      </div>

      <div style={{ padding: '0 12px 8px', color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>
        {sorted.length} platos
        {activeCategory && activeCategory !== 'ofertas' && ` en ${activeCategory}`}
        {activeCategory === 'ofertas' && ' en oferta'}
      </div>

      {sorted.length > 0 ? (
        <MasonryGrid dishes={sorted.slice(0, visibleCount)} onDishTap={onDishTap} onDishLike={onDishLike} onDishDislike={onDishDislike} onDishUndo={onDishUndo} userLocation={userLocation} />
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
          No hay platos en esta categoría
        </div>
      )}
    </div>
  )
}

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

  // Feed con mezcla 70/15/15: scored + popular + discovery
  const sorted = useMemo(() => {
    let filtered = dishes
    if (activeCategory === 'ofertas') filtered = dishes.filter(d => d.enOferta)
    else if (activeCategory) filtered = dishes.filter(d => d.categoriaNorm === activeCategory)

    // Remove disliked
    filtered = filtered.filter(d => !dislikedIds?.has(d.id))

    // Score each dish
    const scored = filtered.map(d => {
      let score = 0
      const catScores = savedCategoryScores ?? {}
      // Category (capped to avoid domination)
      score += Math.min((catScores[d.categoriaNorm] ?? 0) * 0.2, 8)

      // Keywords (capped)
      const kws = extractKeywords(d.nombre, d.descripcion)
      let kwTotal = 0
      for (const kw of kws) kwTotal += (mergedKeywordScores[kw] ?? 0)
      score += Math.min(kwTotal, 10) // cap keyword influence

      return { dish: d, score }
    })

    // Sort by score
    scored.sort((a, b) => b.score - a.score)

    // Build 70/15/15 mix
    const total = scored.length
    const scoredCount = Math.ceil(total * 0.7)
    const popularCount = Math.ceil(total * 0.15)

    // Top 70% by taste score
    const topScored = scored.slice(0, scoredCount)

    // 15% most popular (that aren't in top scored)
    const topScoredIds = new Set(topScored.map(s => s.dish.id))
    const popular = scored
      .filter(s => !topScoredIds.has(s.dish.id))
      .sort((a, b) => b.dish.popularityScore - a.dish.popularityScore)
      .slice(0, popularCount)

    // 15% random discovery (everything else)
    const usedIds = new Set([...topScoredIds, ...popular.map(p => p.dish.id)])
    const discovery = scored
      .filter(s => !usedIds.has(s.dish.id))
      .sort(() => Math.random() - 0.5)

    // Interleave: every ~5 scored dishes, insert 1 popular and 1 discovery
    const result: FeedDish[] = []
    let sIdx = 0, pIdx = 0, dIdx = 0

    for (let i = 0; i < total; i++) {
      if (i % 7 === 5 && pIdx < popular.length) {
        result.push(popular[pIdx++].dish)
      } else if (i % 7 === 6 && dIdx < discovery.length) {
        result.push(discovery[dIdx++].dish)
      } else if (sIdx < topScored.length) {
        result.push(topScored[sIdx++].dish)
      } else if (pIdx < popular.length) {
        result.push(popular[pIdx++].dish)
      } else if (dIdx < discovery.length) {
        result.push(discovery[dIdx++].dish)
      }
    }

    // Ensure no more than 3 consecutive same category
    const final: FeedDish[] = []
    const remaining = [...result]
    while (remaining.length > 0) {
      const recent = final.slice(-3).map(d => d.categoriaNorm)
      const allSame = recent.length === 3 && recent.every(c => c === recent[0])
      if (allSame) {
        const diffIdx = remaining.findIndex(d => d.categoriaNorm !== recent[0])
        if (diffIdx >= 0) {
          final.push(remaining.splice(diffIdx, 1)[0])
          continue
        }
      }
      final.push(remaining.shift()!)
    }

    return final
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

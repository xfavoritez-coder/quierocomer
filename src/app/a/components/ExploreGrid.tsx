'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import type { FeedDish } from '../types'
import { getDisplayCategories } from '../lib/categories'
import DishCard from './DishCard'

export default function ExploreGrid({
  dishes,
  onDishTap,
  onDishLike,
}: {
  dishes: FeedDish[]
  onDishTap: (dish: FeedDish) => void
  onDishLike?: (dish: FeedDish) => void
}) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(20)

  const categories = useMemo(() => {
    const display = getDisplayCategories()
    const available = new Set(dishes.map(d => d.categoriaNorm))
    return display.filter(c => available.has(c))
  }, [dishes])

  const hasOfertas = useMemo(() => dishes.some(d => d.enOferta), [dishes])

  const filtered = useMemo(() => {
    if (activeCategory === 'ofertas') return dishes.filter(d => d.enOferta)
    if (!activeCategory) return dishes
    return dishes.filter(d => d.categoriaNorm === activeCategory)
  }, [dishes, activeCategory])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => b.popularityScore - a.popularityScore)
  }, [filtered])

  // Reset visible count when category changes
  useEffect(() => { setVisibleCount(20) }, [activeCategory])

  // Infinite scroll
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

  const visible = sorted.slice(0, visibleCount)
  const col1: FeedDish[] = []
  const col2: FeedDish[] = []
  visible.forEach((dish, i) => {
    if (i % 2 === 0) col1.push(dish)
    else col2.push(dish)
  })

  return (
    <div>
      {/* Chips */}
      <div className="category-chips">
        <button
          onClick={() => setActiveCategory(null)}
          className={`category-chip ${activeCategory === null ? 'active' : ''}`}
        >
          Todas
        </button>

        {hasOfertas && (
          <button
            onClick={() => setActiveCategory('ofertas')}
            className={`category-chip ofertas ${activeCategory === 'ofertas' ? 'active' : ''}`}
          >
            🏷️ Ofertas
          </button>
        )}

        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`category-chip ${activeCategory === cat ? 'active' : ''}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Count */}
      <div style={{ padding: '0 12px 8px', color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>
        {sorted.length} platos
        {activeCategory && activeCategory !== 'ofertas' && ` en ${activeCategory}`}
        {activeCategory === 'ofertas' && ' en oferta'}
      </div>

      {/* Grid - masonry 2 cols with inline styles to guarantee layout */}
      {visible.length > 0 ? (
        <div style={{ display: 'flex', gap: 8, padding: '0 8px 100px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {col1.map(dish => (
              <DishCard key={dish.id} dish={dish} onTap={onDishTap} onLike={onDishLike} />
            ))}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {col2.map(dish => (
              <DishCard key={dish.id} dish={dish} onTap={onDishTap} onLike={onDishLike} />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
          No hay platos en esta categoría
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useMemo } from 'react'
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

  const col1: FeedDish[] = []
  const col2: FeedDish[] = []
  sorted.forEach((dish, i) => {
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

      {/* Grid */}
      {sorted.length > 0 ? (
        <div className="feed-masonry">
          <div className="feed-masonry-col">
            {col1.map(dish => (
              <DishCard key={dish.id} dish={dish} onTap={onDishTap} onLike={onDishLike} />
            ))}
          </div>
          <div className="feed-masonry-col">
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

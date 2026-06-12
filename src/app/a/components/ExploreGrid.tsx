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
    // Only show categories that have dishes
    const available = new Set(dishes.map(d => d.categoriaNorm))
    return display.filter(c => available.has(c))
  }, [dishes])

  // Check if there are dishes on sale
  const hasOfertas = useMemo(() => dishes.some(d => d.enOferta), [dishes])

  const filtered = useMemo(() => {
    if (activeCategory === '🏷️ Ofertas') {
      return dishes.filter(d => d.enOferta)
    }
    if (!activeCategory) return dishes
    return dishes.filter(d => d.categoriaNorm === activeCategory)
  }, [dishes, activeCategory])

  // Sort by popularity
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => b.popularityScore - a.popularityScore)
  }, [filtered])

  // Split into 2 columns
  const col1: FeedDish[] = []
  const col2: FeedDish[] = []
  sorted.forEach((dish, i) => {
    if (i % 2 === 0) col1.push(dish)
    else col2.push(dish)
  })

  return (
    <div>
      {/* Category chips */}
      <div className="px-3 pb-3 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 pb-1" style={{ minWidth: 'max-content' }}>
          {/* All */}
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              activeCategory === null
                ? 'bg-[#F4A623] text-black'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            Todas
          </button>

          {/* Ofertas chip */}
          {hasOfertas && (
            <button
              onClick={() => setActiveCategory('🏷️ Ofertas')}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeCategory === '🏷️ Ofertas'
                  ? 'bg-green-500 text-white'
                  : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
              }`}
            >
              🏷️ Ofertas
            </button>
          )}

          {/* Category chips */}
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-[#F4A623] text-black'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="px-4 pb-3">
        <span className="text-white/30 text-xs">
          {sorted.length} platos
          {activeCategory && activeCategory !== '🏷️ Ofertas' && ` en ${activeCategory}`}
          {activeCategory === '🏷️ Ofertas' && ' en oferta'}
        </span>
      </div>

      {/* Grid */}
      <div className="px-3 pb-24">
        {sorted.length > 0 ? (
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col">
              {col1.map(dish => (
                <DishCard
                  key={dish.id}
                  dish={dish}
                  onTap={onDishTap}
                  onLike={onDishLike}
                />
              ))}
            </div>
            <div className="flex-1 flex flex-col">
              {col2.map(dish => (
                <DishCard
                  key={dish.id}
                  dish={dish}
                  onTap={onDishTap}
                  onLike={onDishLike}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-white/30 text-sm">No hay platos en esta categoría</p>
          </div>
        )}
      </div>
    </div>
  )
}

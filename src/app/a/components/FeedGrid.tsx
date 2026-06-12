'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type { FeedDish } from '../types'
import type { FeedProfile } from '../lib/scoring'
import { getRecommendationReason } from '../lib/scoring'
import DishCard from './DishCard'

/**
 * Mezcla el array de platos para evitar dominación de un restaurante.
 * Máximo 3 platos del mismo restaurante en cada bloque de 12.
 */
function diversifyFeed(dishes: FeedDish[]): FeedDish[] {
  const result: FeedDish[] = []
  const remaining = [...dishes]

  while (remaining.length > 0) {
    // Contar restaurantes en los últimos 12 items del resultado
    const recentWindow = result.slice(-12)
    const recentRestCounts: Record<string, number> = {}
    for (const d of recentWindow) {
      recentRestCounts[d.restauranteId] = (recentRestCounts[d.restauranteId] || 0) + 1
    }

    // Buscar el primer plato que no exceda el límite de 3 por restaurante
    let found = false
    for (let i = 0; i < remaining.length; i++) {
      const dish = remaining[i]
      if ((recentRestCounts[dish.restauranteId] || 0) < 3) {
        result.push(dish)
        remaining.splice(i, 1)
        found = true
        break
      }
    }

    // Si todos los restantes exceden, meter el primero de todas formas
    if (!found) {
      result.push(remaining.shift()!)
    }
  }

  return result
}

/**
 * Shuffle Fisher-Yates para el feed inicial (antes de scoring)
 */
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function FeedGrid({
  dishes,
  profile,
  onDishTap,
  onDishLike,
}: {
  dishes: FeedDish[]
  profile?: FeedProfile
  onDishTap: (dish: FeedDish) => void
  onDishLike?: (dish: FeedDish) => void
}) {
  // Diversificar: shuffle inicial, luego usa el orden del scoring si hay perfil
  const feed = useMemo(() => {
    if (profile && profile.totalInteractions >= 3) {
      return diversifyFeed(dishes) // ya viene rankeado
    }
    return diversifyFeed(shuffleArray(dishes))
  }, [dishes, profile])
  const [visibleCount, setVisibleCount] = useState(20)

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + 20, feed.length))
  }, [feed.length])

  // Infinite scroll detector
  const handleScroll = useCallback(() => {
    if (
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 800 &&
      visibleCount < feed.length
    ) {
      loadMore()
    }
  }, [visibleCount, feed.length, loadMore])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const visible = feed.slice(0, visibleCount)

  // Split into 2 columns (masonry style - alternating)
  const col1: FeedDish[] = []
  const col2: FeedDish[] = []
  visible.forEach((dish, i) => {
    if (i % 2 === 0) col1.push(dish)
    else col2.push(dish)
  })

  return (
    <div className="px-3 pb-24">
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

      {visibleCount < feed.length && (
        <div className="flex justify-center py-8">
          <button
            onClick={loadMore}
            className="text-white/40 text-sm hover:text-white/60 transition-colors"
          >
            Cargar más platos...
          </button>
        </div>
      )}

      {visibleCount >= feed.length && feed.length > 0 && (
        <p className="text-center text-white/20 text-xs py-8">
          Has visto los {feed.length} platos disponibles
        </p>
      )}
    </div>
  )
}

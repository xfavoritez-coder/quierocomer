'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type { FeedDish } from '../types'
import type { FeedProfile } from '../lib/scoring'
import DishCard from './DishCard'

function diversifyFeed(dishes: FeedDish[]): FeedDish[] {
  const result: FeedDish[] = []
  const remaining = [...dishes]

  while (remaining.length > 0) {
    const recentWindow = result.slice(-12)
    const recentRestCounts: Record<string, number> = {}
    for (const d of recentWindow) {
      recentRestCounts[d.restauranteId] = (recentRestCounts[d.restauranteId] || 0) + 1
    }

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

    if (!found) {
      result.push(remaining.shift()!)
    }
  }

  return result
}

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
  const feed = useMemo(() => {
    if (profile && profile.totalInteractions >= 3) {
      return diversifyFeed(dishes)
    }
    return diversifyFeed(shuffleArray(dishes))
  }, [dishes, profile])

  const [visibleCount, setVisibleCount] = useState(20)

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + 20, feed.length))
  }, [feed.length])

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 800 &&
        visibleCount < feed.length
      ) {
        loadMore()
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [visibleCount, feed.length, loadMore])

  const visible = feed.slice(0, visibleCount)

  const col1: FeedDish[] = []
  const col2: FeedDish[] = []
  visible.forEach((dish, i) => {
    if (i % 2 === 0) col1.push(dish)
    else col2.push(dish)
  })

  return (
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
  )
}

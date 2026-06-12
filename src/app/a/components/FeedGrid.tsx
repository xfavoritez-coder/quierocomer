'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { FeedDish } from '../types'
import type { FeedProfile } from '../lib/scoring'
import { affinity } from '../lib/scoring'
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
  // Initialize feed ONCE on mount — never re-sort what's already shown
  const [lockedFeed] = useState(() => diversifyFeed(shuffleArray(dishes)))
  const [visibleCount, setVisibleCount] = useState(20)
  const profileRef = useRef(profile)
  profileRef.current = profile

  // When loading more, rank the UNSEEN portion using current profile
  const getVisible = useCallback(() => {
    const p = profileRef.current
    if (!p || p.totalInteractions < 3) {
      return lockedFeed.slice(0, visibleCount)
    }

    // Already shown items stay in place
    const alreadyShown = lockedFeed.slice(0, visibleCount - 20 > 0 ? visibleCount - 20 : 0)
    // New batch gets ranked by affinity
    const remaining = lockedFeed.filter(d => !alreadyShown.some(s => s.id === d.id))
    const ranked = remaining.sort((a, b) => affinity(b, p) - affinity(a, p))

    // Combine: keep shown order + add best ranked next
    const newBatch = ranked.slice(0, 20)
    return [...alreadyShown, ...diversifyFeed(newBatch)].slice(0, visibleCount)
  }, [lockedFeed, visibleCount])

  const visible = lockedFeed.slice(0, visibleCount)

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + 20, lockedFeed.length))
  }, [lockedFeed.length])

  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 800 &&
        visibleCount < lockedFeed.length
      ) {
        loadMore()
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [visibleCount, lockedFeed.length, loadMore])

  const col1: FeedDish[] = []
  const col2: FeedDish[] = []
  visible.forEach((dish, i) => {
    if (i % 2 === 0) col1.push(dish)
    else col2.push(dish)
  })

  return (
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
  )
}

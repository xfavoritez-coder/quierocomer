'use client'

import { useState, useCallback, useEffect } from 'react'
import type { FeedDish } from '../types'
import type { FeedProfile } from '../lib/scoring'
import MasonryGrid from './MasonryGrid'

function diversifyFeed(dishes: FeedDish[]): FeedDish[] {
  const result: FeedDish[] = []
  const remaining = [...dishes]
  while (remaining.length > 0) {
    const counts: Record<string, number> = {}
    for (const d of result.slice(-12)) counts[d.restauranteId] = (counts[d.restauranteId] || 0) + 1
    let found = false
    for (let i = 0; i < remaining.length; i++) {
      if ((counts[remaining[i].restauranteId] || 0) < 3) {
        result.push(remaining.splice(i, 1)[0])
        found = true
        break
      }
    }
    if (!found) result.push(remaining.shift()!)
  }
  return result
}

function shuffle<T>(arr: T[]): T[] {
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
  const [lockedFeed] = useState(() => diversifyFeed(shuffle(dishes)))
  const [visibleCount, setVisibleCount] = useState(20)

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + 20, lockedFeed.length))
  }, [lockedFeed.length])

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 800 && visibleCount < lockedFeed.length) {
        loadMore()
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [visibleCount, lockedFeed.length, loadMore])

  return (
    <MasonryGrid
      dishes={lockedFeed.slice(0, visibleCount)}
      onDishTap={onDishTap}
      onDishLike={onDishLike}
    />
  )
}

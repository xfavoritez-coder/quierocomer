'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
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

// Stable shuffle: same seed per dish set = same order
function shuffleWithSeed(arr: FeedDish[]): FeedDish[] {
  const a = [...arr]
  // Use first dish ids as pseudo-seed for stability
  let seed = 0
  for (let i = 0; i < Math.min(a.length, 5); i++) {
    for (let j = 0; j < a[i].id.length; j++) seed += a[i].id.charCodeAt(j)
  }
  for (let i = a.length - 1; i > 0; i--) {
    seed = (seed * 9301 + 49297) % 233280
    const j = Math.floor((seed / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function FeedGrid({
  dishes,
  profile,
  onDishTap,
  onDishLike,
  onDishDwell,
}: {
  dishes: FeedDish[]
  profile?: FeedProfile
  onDishTap: (dish: FeedDish) => void
  onDishLike?: (dish: FeedDish) => void
  onDishDwell?: (dishId: string) => void
}) {
  // Create a key from dish IDs to detect filter changes
  const dishKey = useMemo(() => dishes.length + '_' + (dishes[0]?.id ?? ''), [dishes])

  // Rebuild feed when dishes change (filters), keep stable within same set
  const feed = useMemo(() => diversifyFeed(shuffleWithSeed(dishes)), [dishKey])

  const [visibleCount, setVisibleCount] = useState(20)

  // Reset visible count when feed changes
  useEffect(() => { setVisibleCount(20) }, [dishKey])

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + 20, feed.length))
  }, [feed.length])

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 800 && visibleCount < feed.length) {
        loadMore()
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [visibleCount, feed.length, loadMore])

  if (feed.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255,255,255,0.3)' }}>
        <p style={{ fontSize: 32, marginBottom: 12 }}>🍽</p>
        <p style={{ fontSize: 14 }}>No hay platos con estos filtros</p>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.15)', marginTop: 4 }}>Prueba cambiando los filtros</p>
      </div>
    )
  }

  return (
    <MasonryGrid
      dishes={feed.slice(0, visibleCount)}
      onDishTap={onDishTap}
      onDishLike={onDishLike}
      onDishDwell={onDishDwell}
    />
  )
}

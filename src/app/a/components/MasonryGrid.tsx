'use client'

import { useState, useEffect } from 'react'
import type { FeedDish } from '../types'
import DishCard from './DishCard'

function useColumnCount() {
  const [cols, setCols] = useState(2)

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth
      if (w >= 1280) setCols(5)
      else if (w >= 960) setCols(4)
      else if (w >= 640) setCols(3)
      else setCols(2)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return cols
}

export default function MasonryGrid({
  dishes,
  onDishTap,
  onDishLike,
  onDishDwell,
}: {
  dishes: FeedDish[]
  onDishTap: (dish: FeedDish) => void
  onDishLike?: (dish: FeedDish) => void
  onDishDwell?: (dishId: string) => void
}) {
  const colCount = useColumnCount()

  // Distribute dishes into columns round-robin (stable order)
  const columns: FeedDish[][] = Array.from({ length: colCount }, () => [])
  dishes.forEach((dish, i) => {
    columns[i % colCount].push(dish)
  })

  return (
    <div className="feed-grid">
      {columns.map((col, ci) => (
        <div key={ci} className="feed-grid-col">
          {col.map((dish, di) => (
            <div
              key={dish.id}
              className="feed-grid-item"
              style={{ animationDelay: `${di * 30}ms` }}
            >
              <DishCard dish={dish} onTap={onDishTap} onLike={onDishLike} onDwell={onDishDwell} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

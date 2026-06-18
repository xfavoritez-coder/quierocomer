'use client'

import { useState, useEffect } from 'react'
import { motion, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion'
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

const SWIPE_THRESHOLD = 55

function SwipeableItem({
  dish,
  onTap,
  onCategoryClick,
  userLocation,
  eager,
  onSwipe,
}: {
  dish: FeedDish
  onTap: (dish: FeedDish) => void
  onCategoryClick?: (cat: string) => void
  userLocation?: { lat: number; lng: number } | null
  eager?: boolean
  onSwipe: (dish: FeedDish, dir: 'left' | 'right') => void
}) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 0, 200], [-10, 0, 10])
  const likeOpacity = useTransform(x, [20, SWIPE_THRESHOLD], [0, 1])
  const nopeOpacity = useTransform(x, [-SWIPE_THRESHOLD, -20], [1, 0])
  const [gone, setGone] = useState(false)

  function handleDragEnd(_: any, info: any) {
    if (info.offset.x > SWIPE_THRESHOLD) {
      animate(x, 500, {
        type: 'tween', duration: 0.22,
        onComplete: () => { setGone(true); onSwipe(dish, 'right') },
      })
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      animate(x, -500, {
        type: 'tween', duration: 0.22,
        onComplete: () => { setGone(true); onSwipe(dish, 'left') },
      })
    } else {
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 28 })
    }
  }

  return (
    <AnimatePresence>
      {!gone && (
        <motion.div
          exit={{ height: 0, opacity: 0, marginBottom: 0 }}
          transition={{ duration: 0.18 }}
          style={{ overflow: 'visible' }}
        >
          <motion.div
            style={{ x, rotate, position: 'relative', touchAction: 'pan-y' }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
          >
            {/* LIKE label */}
            <motion.div style={{
              position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none',
              borderRadius: 14, border: '2px solid rgba(244,166,35,0.7)',
              background: 'rgba(244,166,35,0.12)',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start',
              padding: '10px 10px',
              opacity: likeOpacity,
            }}>
              <span style={{
                fontSize: 11, fontWeight: 900, color: '#F4A623',
                letterSpacing: '0.06em', border: '2px solid #F4A623',
                borderRadius: 6, padding: '2px 6px',
                transform: 'rotate(-12deg)', display: 'block',
              }}>ME ANTOJA</span>
            </motion.div>

            {/* NOPE label */}
            <motion.div style={{
              position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none',
              borderRadius: 14, border: '2px solid rgba(239,68,68,0.7)',
              background: 'rgba(239,68,68,0.12)',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
              padding: '10px 10px',
              opacity: nopeOpacity,
            }}>
              <span style={{
                fontSize: 11, fontWeight: 900, color: '#ef4444',
                letterSpacing: '0.06em', border: '2px solid #ef4444',
                borderRadius: 6, padding: '2px 6px',
                transform: 'rotate(12deg)', display: 'block',
              }}>NO</span>
            </motion.div>

            <DishCard
              dish={dish}
              onTap={onTap}
              onCategoryClick={onCategoryClick}
              userLocation={userLocation}
              eager={eager}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function MasonryGrid({
  dishes,
  onDishTap,
  onCategoryClick,
  userLocation,
  onSwipe,
}: {
  dishes: FeedDish[]
  onDishTap: (dish: FeedDish) => void
  onCategoryClick?: (category: string) => void
  userLocation?: { lat: number; lng: number } | null
  onSwipe?: (dish: FeedDish, dir: 'left' | 'right') => void
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
              {onSwipe ? (
                <SwipeableItem
                  dish={dish}
                  onTap={onDishTap}
                  onCategoryClick={onCategoryClick}
                  userLocation={userLocation}
                  eager={di < 6}
                  onSwipe={onSwipe}
                />
              ) : (
                <DishCard dish={dish} onTap={onDishTap} onCategoryClick={onCategoryClick} userLocation={userLocation} eager={di < 6} />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

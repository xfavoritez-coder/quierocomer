'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import type { FeedDish } from '../types'

// ─── Frequency narrowing algorithm ──────────────────────────────────────────
type FreqMap = Record<string, number>

function getDims(dish: FeedDish): string[] {
  return [
    dish.categoriaNorm,
    dish.categoriaParent ?? '',
    dish.cuisineTag ?? '',
    dish.dieta.tipo,
    dish.mealTime,
    ...dish.sabores,
  ].filter(Boolean)
}

function scoreDish(dish: FeedDish, likeFreq: FreqMap, dislikeFreq: FreqMap): number {
  let score = 0
  for (const dim of getDims(dish)) {
    score += (likeFreq[dim] ?? 0) * 2
    score -= (dislikeFreq[dim] ?? 0)
  }
  return score
}

function sortPool(pool: FeedDish[], likeFreq: FreqMap, dislikeFreq: FreqMap): FeedDish[] {
  if (!Object.keys(likeFreq).length && !Object.keys(dislikeFreq).length) return pool
  return [...pool].sort((a, b) => scoreDish(b, likeFreq, dislikeFreq) - scoreDish(a, likeFreq, dislikeFreq))
}

// ─── Card ────────────────────────────────────────────────────────────────────
const THRESHOLD = 90
const ACCENT = '#F4A623'

function SwipeCard({
  dish,
  isTop,
  stackIndex,
  onSwipe,
}: {
  dish: FeedDish
  isTop: boolean
  stackIndex: number
  onSwipe: (dir: 'left' | 'right') => void
}) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-280, 0, 280], [-16, 0, 16])
  const likeOpacity = useTransform(x, [20, THRESHOLD], [0, 1])
  const nopeOpacity = useTransform(x, [-THRESHOLD, -20], [1, 0])
  const [logoError, setLogoError] = useState(false)
  const [imgError, setImgError] = useState(false)

  const scale = 1 - stackIndex * 0.04
  const translateY = stackIndex * 10

  function handleDragEnd(_: any, info: any) {
    if (info.offset.x > THRESHOLD) onSwipe('right')
    else if (info.offset.x < -THRESHOLD) onSwipe('left')
    else animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 })
  }

  const fotoUrl = !imgError ? dish.fotoUrl : null

  return (
    <motion.div
      style={{
        position: 'absolute', inset: 0,
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        scale,
        translateY,
        zIndex: 10 - stackIndex,
        cursor: isTop ? 'grab' : 'default',
        transformOrigin: 'bottom center',
      }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={isTop ? handleDragEnd : undefined}
      whileTap={isTop ? { cursor: 'grabbing' } : {}}
    >
      <div style={{
        width: '100%', height: '100%',
        borderRadius: 18, overflow: 'hidden',
        background: '#111',
        boxShadow: '0 16px 48px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.35)',
        position: 'relative',
      }}>
        {/* Photo */}
        {fotoUrl ? (
          <img
            src={fotoUrl}
            alt={dish.nombre}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', userSelect: 'none', pointerEvents: 'none' }}
            draggable={false}
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(135deg, #222 0%, #333 100%)',
            display: 'grid', placeItems: 'center',
          }}>
            <span style={{ fontSize: '4rem', opacity: 0.4 }}>🍽️</span>
          </div>
        )}

        {/* Restaurant bar — same as DishCard */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '10px 12px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.3) 70%, transparent 100%)',
        }}>
          {dish.restauranteLogo && !logoError ? (
            <img src={dish.restauranteLogo} alt="" onError={() => setLogoError(true)}
              style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700,
            }}>
              {dish.restaurante.charAt(0)}
            </div>
          )}
          <span style={{
            fontSize: 13, color: 'rgba(255,255,255,0.88)', fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {dish.restaurante}
          </span>
        </div>

        {/* Bottom gradient with name + price — same as DishCard */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 55%, transparent 100%)',
          padding: '32px 14px 18px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
            <h3 style={{
              fontFamily: 'var(--font-feed-display), serif',
              fontSize: 22, fontWeight: 700, lineHeight: 1.2, color: '#fff',
              margin: 0, flex: 1, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {dish.nombre}
            </h3>
            {dish.dieta.tipo === 'VEGAN' && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M12 22V11"/><path d="M12 11a6 6 0 0 0-6-6c0 3.31 2.69 6 6 6z"/>
                <path d="M12 11a6 6 0 0 1 6-6c0 3.31-2.69 6-6 6z"/>
                <path d="M12 17a5 5 0 0 0-5-5c0 2.76 2.24 5 5 5z"/>
                <path d="M12 17a5 5 0 0 1 5-5c0 2.76-2.24 5-5 5z"/>
              </svg>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {!dish.isShowcase && dish.precio > 0 && (
              <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>
                {dish.enOferta && dish.precioDescuento != null
                  ? `$${dish.precioDescuento.toLocaleString('es-CL')}`
                  : `$${dish.precio.toLocaleString('es-CL')}`}
              </span>
            )}
            {dish.categoriaNorm && (
              <span style={{
                padding: '2px 8px', borderRadius: 10,
                background: 'rgba(255,255,255,0.1)',
                fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 500,
              }}>
                {dish.categoriaNorm}
              </span>
            )}
          </div>
        </div>

        {/* LIKE overlay */}
        {isTop && (
          <motion.div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(244,166,35,0.12)',
            borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
            padding: '0 22px',
            opacity: likeOpacity,
            pointerEvents: 'none',
            border: '3px solid rgba(244,166,35,0.65)',
          }}>
            <div style={{ border: `3px solid ${ACCENT}`, borderRadius: 10, padding: '6px 14px', transform: 'rotate(-14deg)' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: ACCENT, letterSpacing: '0.05em', display: 'block' }}>
                SE ME ANTOJA
              </span>
            </div>
          </motion.div>
        )}

        {/* NOPE overlay */}
        {isTop && (
          <motion.div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(239,68,68,0.12)',
            borderRadius: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            padding: '0 22px',
            opacity: nopeOpacity,
            pointerEvents: 'none',
            border: '3px solid rgba(239,68,68,0.65)',
          }}>
            <div style={{ border: '3px solid #ef4444', borderRadius: 10, padding: '6px 14px', transform: 'rotate(14deg)' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#ef4444', letterSpacing: '0.05em', display: 'block' }}>
                NO SE ME ANTOJA
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function SwipeMode({
  initialDishes,
  isDark,
  onClose,
}: {
  initialDishes: FeedDish[]
  isDark: boolean
  onClose: () => void
}) {
  const [pool, setPool] = useState<FeedDish[]>(() => [...initialDishes])
  const [history, setHistory] = useState<{ dish: FeedDish; dir: 'left' | 'right' }[]>([])
  const [likeFreq, setLikeFreq] = useState<FreqMap>({})
  const [dislikeFreq, setDislikeFreq] = useState<FreqMap>({})

  const handleSwipe = useCallback((dish: FeedDish, dir: 'left' | 'right') => {
    setHistory(prev => [...prev, { dish, dir }])
    const dims = getDims(dish)

    let newLikeFreq = likeFreq
    let newDislikeFreq = dislikeFreq

    if (dir === 'right') {
      newLikeFreq = { ...likeFreq }
      for (const d of dims) newLikeFreq[d] = (newLikeFreq[d] ?? 0) + 1
      setLikeFreq(newLikeFreq)
    } else {
      newDislikeFreq = { ...dislikeFreq }
      for (const d of dims) newDislikeFreq[d] = (newDislikeFreq[d] ?? 0) + 1
      setDislikeFreq(newDislikeFreq)
    }

    setPool(prev => {
      const remaining = prev.filter(d => d.id !== dish.id)
      return sortPool(remaining, newLikeFreq, newDislikeFreq)
    })
  }, [likeFreq, dislikeFreq])

  const likes = history.filter(h => h.dir === 'right')
  const dislikes = history.filter(h => h.dir === 'left')
  const visibleStack = pool.slice(0, 3)

  const bg = isDark ? '#0e0e0e' : '#0e0e0e' // always dark for swipe immersion

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: bg,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--font-dm, "DM Sans", sans-serif)',
      userSelect: 'none',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'max(env(safe-area-inset-top), 14px) 16px 10px',
        gap: 8,
      }}>
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            width: 36, height: 36, borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,0.08)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.7)', flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>

        <div style={{ textAlign: 'center', flex: 1 }}>
          <p style={{ margin: 0, fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
            QuieroComer
          </p>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>
            ¿Qué se te antoja hoy?
          </p>
        </div>

        {/* Counters */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
          {dislikes.length > 0 && (
            <span style={{
              padding: '3px 8px', borderRadius: 20,
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
              fontSize: '0.7rem', color: '#ef4444', fontWeight: 700,
            }}>✕ {dislikes.length}</span>
          )}
          {likes.length > 0 && (
            <span style={{
              padding: '3px 8px', borderRadius: 20,
              background: 'rgba(244,166,35,0.12)', border: '1px solid rgba(244,166,35,0.3)',
              fontSize: '0.7rem', color: ACCENT, fontWeight: 700,
            }}>✓ {likes.length}</span>
          )}
        </div>
      </div>

      {/* Card stack */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', padding: '0 14px 6px' }}>
        <div style={{ position: 'relative', height: '100%' }}>
          {pool.length === 0 ? (
            /* Empty state */
            <div style={{
              height: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 14,
              color: 'rgba(255,255,255,0.5)',
            }}>
              <div style={{ fontSize: '3rem' }}>✨</div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: '#fff' }}>Eso es todo</p>
              <p style={{ margin: 0, fontSize: '0.85rem', textAlign: 'center', maxWidth: 260 }}>
                {likes.length > 0
                  ? `Te antojaron ${likes.length} platos de ${new Set(likes.map(l => l.dish.restauranteSlug)).size} restaurantes`
                  : 'Vuelve más tarde para ver más platos'}
              </p>
              {likes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 340, marginTop: 4 }}>
                  {likes.slice(0, 4).map(({ dish }) => (
                    <a key={dish.id} href={`/qr/${dish.restauranteSlug}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', borderRadius: 14,
                        background: 'rgba(244,166,35,0.08)', border: '1px solid rgba(244,166,35,0.2)',
                        textDecoration: 'none', color: '#fff',
                      }}>
                      {dish.fotoUrl && <img src={dish.fotoUrl} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dish.nombre}</p>
                        <p style={{ margin: 0, color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem' }}>{dish.restaurante}</p>
                      </div>
                      <span style={{ color: ACCENT, fontSize: '0.78rem', fontWeight: 700, flexShrink: 0 }}>Ver →</span>
                    </a>
                  ))}
                </div>
              )}
              <button
                onClick={onClose}
                style={{
                  marginTop: 8, padding: '10px 24px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                }}
              >
                Volver al feed
              </button>
            </div>
          ) : (
            [...visibleStack].reverse().map((dish, revIdx) => {
              const stackIndex = visibleStack.length - 1 - revIdx
              const isTop = stackIndex === 0
              return (
                <SwipeCard
                  key={dish.id}
                  dish={dish}
                  isTop={isTop}
                  stackIndex={stackIndex}
                  onSwipe={(dir) => handleSwipe(dish, dir)}
                />
              )
            })
          )}
        </div>
      </div>

      {/* Buttons */}
      {pool.length > 0 && (
        <div style={{
          padding: '10px 40px max(env(safe-area-inset-bottom), 18px)',
          display: 'flex', justifyContent: 'center', gap: 32,
        }}>
          <button
            onClick={() => pool[0] && handleSwipe(pool[0], 'left')}
            style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.3)',
              display: 'grid', placeItems: 'center',
              cursor: 'pointer', fontSize: '1.4rem',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
          >✕</button>
          <button
            onClick={() => pool[0] && handleSwipe(pool[0], 'right')}
            style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'rgba(244,166,35,0.1)', border: `2px solid rgba(244,166,35,0.3)`,
              display: 'grid', placeItems: 'center',
              cursor: 'pointer', fontSize: '1.4rem',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(244,166,35,0.2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(244,166,35,0.1)')}
          >✓</button>
        </div>
      )}

      {/* Hint */}
      {history.length === 0 && pool.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 90, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,0.28)', fontWeight: 600, letterSpacing: '0.04em' }}>
            ← desliza para explorar →
          </p>
        </div>
      )}
    </div>
  )
}

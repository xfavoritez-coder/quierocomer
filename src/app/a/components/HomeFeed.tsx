'use client'

import { useMemo } from 'react'
import type { FeedDish } from '../types'
import type { FeedProfile } from '../lib/scoring'
import { ADJACENT_CATEGORIES } from '../lib/categories'
import { distanceKm } from '../lib/geo'

type Section = {
  id: string
  title: string
  emoji: string
  dishes: FeedDish[]
}

export default function HomeFeed({
  dishes,
  profile,
  userLocation,
  onDishTap,
}: {
  dishes: FeedDish[]
  profile: FeedProfile
  userLocation: { lat: number; lng: number } | null
  onDishTap: (dish: FeedDish) => void
}) {
  const sections = useMemo(() => {
    const result: Section[] = []
    const usedIds = new Set<string>()

    const addSection = (s: Section) => {
      if (s.dishes.length >= 3) {
        result.push(s)
        s.dishes.forEach(d => usedIds.add(d.id))
      }
    }

    // 1. Near you (if geolocation available)
    if (userLocation) {
      const withDist = dishes
        .filter(d => d.restauranteLat && d.restauranteLng)
        .map(d => ({
          dish: d,
          dist: distanceKm(userLocation.lat, userLocation.lng, d.restauranteLat!, d.restauranteLng!),
        }))
        .sort((a, b) => a.dist - b.dist)

      // Get commune from nearest restaurant address
      const nearest = withDist[0]?.dish
      const commune = nearest?.restauranteDireccion?.split(',').slice(-2, -1)[0]?.trim() || 'tu zona'

      addSection({
        id: 'near',
        title: `Cerca de ti en ${commune}`,
        emoji: '📍',
        dishes: withDist.filter(x => x.dist < 8).slice(0, 15).map(x => x.dish),
      })
    }

    // 2. Based on top categories from profile (exclude generic ones)
    const GENERIC = new Set([
      'Platos de fondo', 'Desayunos', 'Cafetería', 'Postres', 'Combos',
      'Acompañamientos', 'Extras', 'Entradas',
    ])
    const topCats = Object.entries(profile.categoryScores)
      .filter(([cat, s]) => s >= 10 && !GENERIC.has(cat))
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)

    for (const [cat, score] of topCats) {
      const catDishes = dishes
        .filter(d => d.categoriaNorm === cat && !usedIds.has(d.id) && d.fotoUrl)
        .slice(0, 15)
      // score >= 30 = liked/saved, < 30 = just viewed
      const liked = score >= 30
      addSection({
        id: `cat-${cat}`,
        title: liked ? `Porque te gusta ${cat.toLowerCase()}` : `Porque viste ${cat.toLowerCase()}`,
        emoji: liked ? '❤️' : '👀',
        dishes: catDishes,
      })
    }

    // 3. Based on top keywords
    const topKws = Object.entries(profile.keywordScores)
      .filter(([, s]) => s >= 6)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)

    for (const [kw, kwScore] of topKws) {
      const kwLower = kw.toLowerCase()
      const kwDishes = dishes
        .filter(d => {
          const text = `${d.nombre} ${d.descripcion || ''}`.toLowerCase()
          return text.includes(kwLower) && !usedIds.has(d.id) && d.fotoUrl
        })
        .slice(0, 15)
      const kwLiked = kwScore >= 15
      addSection({
        id: `kw-${kw}`,
        title: kwLiked ? `Porque te gusta ${kw}` : `Porque viste ${kw}`,
        emoji: kwLiked ? '❤️' : '👀',
        dishes: kwDishes,
      })
    }

    // 4. Adjacent category discovery
    if (topCats.length > 0) {
      const mainCat = topCats[0][0]
      const adjacent = ADJACENT_CATEGORIES[mainCat] ?? []
      for (const adj of adjacent.slice(0, 1)) {
        const adjDishes = dishes
          .filter(d => d.categoriaNorm === adj && !usedIds.has(d.id) && d.fotoUrl)
          .slice(0, 15)
        addSection({
          id: `adj-${adj}`,
          title: `Si te gusta ${mainCat.toLowerCase()}, prueba ${adj.toLowerCase()}`,
          emoji: '🧭',
          dishes: adjDishes,
        })
      }
    }

    // 5. Trending / Popular
    const trending = dishes
      .filter(d => !usedIds.has(d.id) && d.fotoUrl)
      .sort((a, b) => b.popularityScore - a.popularityScore)
      .slice(0, 15)
    addSection({
      id: 'trending',
      title: 'Trending esta semana',
      emoji: '🔥',
      dishes: trending,
    })

    // 6. New / Discover
    const discover = dishes
      .filter(d => !usedIds.has(d.id) && d.fotoUrl && !profile.seenDishIds.has(d.id))
      .sort(() => Math.random() - 0.5)
      .slice(0, 15)
    addSection({
      id: 'discover',
      title: 'Para descubrir',
      emoji: '💡',
      dishes: discover,
    })

    return result
  }, [dishes, profile, userLocation])

  if (sections.length === 0) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
        <p style={{ fontSize: 32, marginBottom: 12 }}>🍽</p>
        <p style={{ fontSize: 14 }}>Explora platos para personalizar tu inicio</p>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      {sections.map(section => (
        <div key={section.id} style={{ marginBottom: 28 }}>
          {/* Section header */}
          <div style={{ padding: '0 16px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>{section.emoji}</span>
            <h2 style={{
              fontSize: 16, fontWeight: 700, color: '#fff', margin: 0,
              fontFamily: 'var(--font-feed-display), serif',
            }}>
              {section.title}
            </h2>
          </div>

          {/* Horizontal scroll */}
          <div className="home-carousel" style={{
            display: 'flex', gap: 12, overflowX: 'auto', padding: '0 16px',
            scrollbarWidth: 'none', msOverflowStyle: 'none',
          }}>
            {section.dishes.map(dish => (
              <div key={dish.id} onClick={() => onDishTap(dish)} className="home-card" style={{
                flexShrink: 0, cursor: 'pointer',
                borderRadius: 14, overflow: 'hidden',
                background: 'rgba(255,255,255,0.03)',
              }}>
                <img src={dish.fotoUrl!} alt={dish.nombre} className="home-card-img" style={{
                  width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block',
                }} />
                <div style={{ padding: '8px 10px 10px' }}>
                  <p style={{
                    fontSize: 13, fontWeight: 600, color: '#fff', margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-feed-display), serif',
                  }}>{dish.nombre}</p>
                  <p style={{ fontSize: 12, color: '#F4A623', margin: '3px 0 0', fontWeight: 600 }}>
                    ${(dish.precioDescuento ?? dish.precio).toLocaleString('es-CL')}
                  </p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {dish.restaurante}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Eureka Engine — Detects when the user knows what they want to eat.
 *
 * Simple and decisive: if someone likes 3+ dishes of the same category,
 * they know what they want. Period.
 *
 * The confidence is NOT a weighted average of 4 signals. It's a direct
 * measure of how clear the user's craving is:
 * - 3 likes same category = strong signal → eureka
 * - Dislikes in OTHER categories = even stronger
 * - Historical profile agrees = fastest eureka
 */

import type { FeedDish } from '../types'
import { extractKeywords } from './keywords'
import { distanceKm } from './geo'

export type EurekaState = {
  confidence: number
  topCategory: string | null
  topCategoryShare: number
  totalLikes: number
  totalDislikes: number
  topDishes: FeedDish[]
  hintLevel: 0 | 1 | 2 | 3
  fallbackMode: boolean
}

// Categories too generic to be a craving
const GENERIC_CATEGORIES = new Set([
  'Entradas', 'Platos de fondo', 'Combos', 'Acompañamientos', 'Extras',
  'Desayunos', 'Asiática',
])

export function computeEurekaState(
  dishes: FeedDish[],
  sessionLikedIds: Set<string>,
  sessionDislikedIds: Set<string>,
  savedCategoryScores: Record<string, number>,
  savedKeywordScores: Record<string, number>,
  userLocation: { lat: number; lng: number } | null,
): EurekaState {
  const empty: EurekaState = {
    confidence: 0, topCategory: null, topCategoryShare: 0,
    totalLikes: 0, totalDislikes: 0, topDishes: [], hintLevel: 0, fallbackMode: false,
  }

  const totalLikes = sessionLikedIds.size
  const totalDislikes = sessionDislikedIds.size

  if (totalLikes === 0) return { ...empty, totalDislikes }

  const dishMap = new Map(dishes.map(d => [d.id, d]))
  const likedDishes = [...sessionLikedIds].map(id => dishMap.get(id)).filter(Boolean) as FeedDish[]
  const dislikedDishes = [...sessionDislikedIds].map(id => dishMap.get(id)).filter(Boolean) as FeedDish[]

  // ─── Count likes by specific category ────────────────────────
  const catCounts: Record<string, number> = {}
  for (const d of likedDishes) {
    if (!GENERIC_CATEGORIES.has(d.categoriaNorm)) {
      catCounts[d.categoriaNorm] = (catCounts[d.categoriaNorm] ?? 0) + 1
    }
  }

  const sortedCats = Object.entries(catCounts).sort(([, a], [, b]) => b - a)
  const topCategory = sortedCats[0]?.[0] ?? null
  const topCount = sortedCats[0]?.[1] ?? 0
  const specificLikes = Object.values(catCounts).reduce((s, c) => s + c, 0)
  const topCategoryShare = specificLikes > 0 ? topCount / specificLikes : 0

  // ─── Confidence: simple and decisive ─────────────────────────
  let confidence = 0

  // Core signal: how many likes in the top category
  // 1 like = weak, 2 = moderate, 3 = strong, 4+ = very strong
  if (topCount >= 4) confidence = 80
  else if (topCount >= 3) confidence = 65
  else if (topCount >= 2) confidence = 40
  else if (topCount >= 1) confidence = 15

  // Boost: concentration (all likes in same category vs spread)
  if (topCategoryShare >= 0.8 && topCount >= 2) confidence += 10
  else if (topCategoryShare >= 0.6 && topCount >= 2) confidence += 5

  // Boost: dislikes are from OTHER categories (confirms preference)
  if (totalDislikes > 0 && topCategory) {
    const dislikesInTopCat = dislikedDishes.filter(d => d.categoriaNorm === topCategory).length
    if (dislikesInTopCat === 0) confidence += 10 // never disliked the top category = strong
  }

  // Boost: historical profile agrees (returning user)
  if (topCategory && (savedCategoryScores[topCategory] ?? 0) > 10) {
    confidence += 10
  }

  // Boost: keywords converge (liked dishes share ingredients)
  const kwFreq: Record<string, number> = {}
  for (const d of likedDishes) {
    for (const kw of extractKeywords(d.nombre, d.descripcion)) {
      kwFreq[kw] = (kwFreq[kw] ?? 0) + 1
    }
  }
  const repeatedKws = Object.values(kwFreq).filter(c => c >= 2).length
  if (repeatedKws >= 2) confidence += 5

  confidence = Math.min(confidence, 100)

  // ─── Fallback: no clear category after many swipes ──────────
  const totalInteractions = totalLikes + totalDislikes
  const fallbackMode = !topCategory || (topCategoryShare < 0.3 && totalInteractions >= 12)

  // ─── Top dishes ─────────────────────────────────────────────
  const topDishes = fallbackMode
    ? selectFallbackDishes(likedDishes, userLocation)
    : selectTopDishes(dishes, topCategory!, sessionDislikedIds, sessionLikedIds, userLocation)

  // ─── Hint level ─────────────────────────────────────────────
  const hintLevel: 0 | 1 | 2 | 3 =
    confidence >= 55 ? 3 :
    confidence >= 35 ? 2 :
    confidence >= 15 ? 1 : 0

  return {
    confidence,
    topCategory: fallbackMode ? null : topCategory,
    topCategoryShare,
    totalLikes,
    totalDislikes,
    topDishes,
    hintLevel,
    fallbackMode,
  }
}

function selectTopDishes(
  dishes: FeedDish[],
  topCategory: string,
  dislikedIds: Set<string>,
  likedIds: Set<string>,
  userLocation: { lat: number; lng: number } | null,
): FeedDish[] {
  // EXCLUDE dishes already liked or disliked — show NEW discoveries only
  const candidates = dishes.filter(d =>
    d.categoriaNorm === topCategory &&
    d.fotoUrl &&
    !dislikedIds.has(d.id) &&
    !likedIds.has(d.id)
  )

  if (userLocation) {
    // Sort by proximity — closest restaurants first
    return candidates
      .map(d => ({
        dish: d,
        dist: d.restauranteLat && d.restauranteLng
          ? distanceKm(userLocation.lat, userLocation.lng, d.restauranteLat, d.restauranteLng)
          : 999,
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3)
      .map(x => x.dish)
  }

  // No location: sort by popularity
  return candidates
    .sort((a, b) => b.popularityScore - a.popularityScore)
    .slice(0, 3)
}

function selectFallbackDishes(
  likedDishes: FeedDish[],
  userLocation: { lat: number; lng: number } | null,
): FeedDish[] {
  // Fallback: show the liked dishes themselves (user has no clear category)
  // This IS the case where showing liked dishes makes sense
  const withPhotos = likedDishes.filter(d => d.fotoUrl)
  if (userLocation) {
    return withPhotos
      .map(d => ({
        dish: d,
        dist: d.restauranteLat && d.restauranteLng
          ? distanceKm(userLocation.lat, userLocation.lng, d.restauranteLat, d.restauranteLng)
          : 999,
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3)
      .map(x => x.dish)
  }
  return withPhotos.slice(-3).reverse()
}

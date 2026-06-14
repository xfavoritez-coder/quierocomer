/**
 * Eureka Engine — Detects when the user knows what they want to eat.
 *
 * Computes a confidence score (0-100) based on 4 signals:
 * 1. Category concentration (35%) — are likes clustered in 1-2 categories?
 * 2. Keyword convergence (25%) — do liked dishes share ingredients/flavors?
 * 3. Historical confirmation (20%) — does the persisted profile agree?
 * 4. Dislike consistency (20%) — are dislikes from different categories than likes?
 *
 * NOT mechanical: confidence rises when the DATA justifies it, not by swipe count.
 */

import type { FeedDish } from '../types'
import { extractKeywords } from './keywords'
import { distanceKm } from './geo'

// Categories too generic to be a craving — eureka ignores them
const GENERIC_CATEGORIES = new Set([
  'Entradas', 'Platos de fondo', 'Combos', 'Acompañamientos', 'Extras',
  'Desayunos', 'Asiática',
])

export type EurekaState = {
  confidence: number           // 0-100
  topCategory: string | null   // detected craving category
  topCategoryShare: number     // 0-1, fraction of likes in top category
  totalLikes: number
  totalDislikes: number
  topDishes: FeedDish[]        // top 3 dishes for the result
  hintLevel: 0 | 1 | 2 | 3    // which threshold was crossed
  fallbackMode: boolean        // true when no clear category, showing liked dishes
}

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

  // Get liked and disliked dish objects
  const dishMap = new Map(dishes.map(d => [d.id, d]))
  const likedDishes = [...sessionLikedIds].map(id => dishMap.get(id)).filter(Boolean) as FeedDish[]
  const dislikedDishes = [...sessionDislikedIds].map(id => dishMap.get(id)).filter(Boolean) as FeedDish[]

  // ─── Signal A: Category Concentration (35%) ─────────────────
  const catCounts: Record<string, number> = {}
  for (const d of likedDishes) {
    // Skip generic categories — they don't tell us what the user wants to eat
    if (!GENERIC_CATEGORIES.has(d.categoriaNorm)) {
      catCounts[d.categoriaNorm] = (catCounts[d.categoriaNorm] ?? 0) + 1
    }
  }
  const sortedCats = Object.entries(catCounts).sort(([, a], [, b]) => b - a)
  const topCategory = sortedCats[0]?.[0] ?? null
  const topCategoryCount = sortedCats[0]?.[1] ?? 0
  const likesInSpecificCats = Object.values(catCounts).reduce((s, c) => s + c, 0)
  const topCategoryShare = likesInSpecificCats > 0 ? topCategoryCount / likesInSpecificCats : 0

  // Concentration scales with both share AND absolute count
  // 1 like in 1 category = share 1.0 but count too low → damped
  const countDamping = Math.min(totalLikes / 4, 1) // need 4+ likes for full signal
  const catConcentration = topCategoryShare * countDamping

  // ─── Signal B: Keyword Convergence (25%) ────────────────────
  const kwFreq: Record<string, number> = {}
  let totalKws = 0
  for (const d of likedDishes) {
    const kws = extractKeywords(d.nombre, d.descripcion)
    for (const kw of kws) {
      kwFreq[kw] = (kwFreq[kw] ?? 0) + 1
      totalKws++
    }
  }
  const repeatedKws = Object.entries(kwFreq).filter(([, c]) => c >= 2)
  const uniqueKws = Object.keys(kwFreq).length
  let keywordConvergence = uniqueKws > 0 ? repeatedKws.length / uniqueKws : 0
  // Boost for keywords appearing in 3+ dishes
  const strongKws = repeatedKws.filter(([, c]) => c >= 3).length
  if (strongKws > 0) keywordConvergence = Math.min(keywordConvergence * 1.3, 1)

  // ─── Signal C: Historical Confirmation (20%) ────────────────
  let historicalConfirmation = 0
  if (topCategory) {
    const savedCatScore = savedCategoryScores[topCategory] ?? 0
    const catConfirm = Math.min(Math.max(savedCatScore, 0) / 30, 1)

    // Check if repeated keywords also have positive saved scores
    let kwConfirm = 0
    if (repeatedKws.length > 0) {
      const confirmedKws = repeatedKws.filter(([kw]) => (savedKeywordScores[kw] ?? 0) > 0).length
      kwConfirm = confirmedKws / repeatedKws.length
    }

    historicalConfirmation = catConfirm * 0.5 + kwConfirm * 0.5
  }

  // ─── Signal D: Dislike Consistency (20%) ────────────────────
  let dislikeConsistency = 0.5 // neutral when no dislikes
  if (totalDislikes > 0 && topCategory) {
    const dislikesInTopCat = dislikedDishes.filter(d => d.categoriaNorm === topCategory).length
    dislikeConsistency = 1 - (dislikesInTopCat / totalDislikes)
  }

  // ─── Final confidence ───────────────────────────────────────
  const confidence = Math.round(
    catConcentration * 35 +
    keywordConvergence * 25 +
    historicalConfirmation * 20 +
    dislikeConsistency * 20
  )

  // ─── Fallback mode ─────────────────────────────────────────
  const totalInteractions = totalLikes + totalDislikes
  const noPattern = topCategoryShare < 0.35 && totalInteractions >= 15
  const fallbackMode = noPattern

  // ─── Top dishes selection ──────────────────────────────────
  const topDishes = fallbackMode
    ? selectFallbackDishes(likedDishes, userLocation)
    : selectTopDishes(dishes, topCategory!, sessionDislikedIds, sessionLikedIds, userLocation)

  // ─── Hint level ────────────────────────────────────────────
  const hintLevel: 0 | 1 | 2 | 3 =
    confidence >= 65 ? 3 :
    confidence >= 50 ? 2 :
    confidence >= 30 ? 1 : 0

  return {
    confidence: Math.min(confidence, 100),
    topCategory: fallbackMode ? null : topCategory,
    topCategoryShare,
    totalLikes,
    totalDislikes,
    topDishes,
    hintLevel,
    fallbackMode,
  }
}

// Top 3 dishes from the detected category, sorted by proximity
function selectTopDishes(
  dishes: FeedDish[],
  topCategory: string,
  dislikedIds: Set<string>,
  likedIds: Set<string>,
  userLocation: { lat: number; lng: number } | null,
): FeedDish[] {
  const candidates = dishes.filter(d =>
    d.categoriaNorm === topCategory &&
    d.fotoUrl &&
    !dislikedIds.has(d.id)
  )

  if (userLocation) {
    // Sort by: liked first, then by distance
    return candidates
      .map(d => ({
        dish: d,
        liked: likedIds.has(d.id) ? 1 : 0,
        dist: d.restauranteLat && d.restauranteLng
          ? distanceKm(userLocation.lat, userLocation.lng, d.restauranteLat, d.restauranteLng)
          : 999,
      }))
      .sort((a, b) => b.liked - a.liked || a.dist - b.dist)
      .slice(0, 3)
      .map(x => x.dish)
  }

  // No location: liked first, then by popularity
  return candidates
    .sort((a, b) => {
      const aLiked = likedIds.has(a.id) ? 1 : 0
      const bLiked = likedIds.has(b.id) ? 1 : 0
      return bLiked - aLiked || b.popularityScore - a.popularityScore
    })
    .slice(0, 3)
}

// Fallback: show the 3 most recent liked dishes
function selectFallbackDishes(
  likedDishes: FeedDish[],
  userLocation: { lat: number; lng: number } | null,
): FeedDish[] {
  if (userLocation) {
    return likedDishes
      .filter(d => d.fotoUrl)
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
  return likedDishes.filter(d => d.fotoUrl).slice(-3).reverse()
}

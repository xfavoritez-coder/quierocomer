// Computes a 0-100 confidence score from swipe behavior.
// Drives the Eureka result overlay and subtle hints during exploration.

import type { FeedDish } from '../types'

export type ConfidenceResult = {
  score: number           // 0-100
  topDimKey: string | null  // e.g. "t:hamburguesa", "c:Sushi", "k:Italiana"
  topLabel: string | null   // human-readable label, first-letter capitalized
  fallback: boolean        // no clear pattern after many swipes → use liked dishes
}

// Prefixes that signal "what kind of food" (not diet/flavor/timing)
const FOOD_PREFIX_WEIGHT: Record<string, number> = {
  't:':  1.2,  // specific dish type (strongest signal)
  'tp:': 0.9,  // parent type group
  'c:':  0.8,  // broad category (fallback when no taxonomy)
  'k:':  0.9,  // cuisine origin
}

/**
 * Computes how confident the engine is that the user wants something specific.
 * Requires ≥ 3 swipes to start producing signal.
 */
export function computeConfidence(
  likeFreq: Record<string, number>,
  dislikeFreq: Record<string, number>,
  totalSwipes: number,
): ConfidenceResult {
  if (totalSwipes < 3) {
    return { score: 0, topDimKey: null, topLabel: null, fallback: false }
  }

  // Weighted net score per food dimension
  const netScores: Record<string, number> = {}
  for (const [dim, likes] of Object.entries(likeFreq)) {
    const prefix = Object.keys(FOOD_PREFIX_WEIGHT).find(p => dim.startsWith(p))
    if (!prefix) continue
    const weight = FOOD_PREFIX_WEIGHT[prefix]
    const dislikes = dislikeFreq[dim] ?? 0
    const net = (likes - dislikes * 0.5) * weight
    if (net > 0) netScores[dim] = net
  }

  const entries = Object.entries(netScores).sort(([, a], [, b]) => b - a)

  if (entries.length === 0) {
    return { score: 0, topDimKey: null, topLabel: null, fallback: totalSwipes >= 15 }
  }

  const [topDimKey, topNet] = entries[0]
  const totalNet = entries.reduce((s, [, v]) => s + v, 0)

  // Concentration: fraction of signal pointing at the dominant dimension
  const concentration = topNet / totalNet  // 0-1

  // Reliability: grows with swipe count, saturates around 10
  const reliability = Math.min(totalSwipes / 10, 1)

  const score = Math.min(Math.round(concentration * reliability * 100), 100)

  // Human label: strip prefix, capitalize first letter
  const raw = topDimKey.replace(/^[a-z]+:/, '')
  const topLabel = raw.charAt(0).toUpperCase() + raw.slice(1)

  return { score, topDimKey, topLabel, fallback: false }
}

/**
 * Returns up to 3 unseen dishes that best match the top food dimension.
 * Falls back to dishes ranked by popularity if no strong match.
 */
export function getEurekaTopDishes(
  dishes: FeedDish[],
  topDimKey: string | null,
  swipedIds: Set<string>,
  likeFreq: Record<string, number>,
): FeedDish[] {
  const candidates = dishes.filter(d => !swipedIds.has(d.id) && d.fotoUrl)

  if (!topDimKey) return candidates.slice(0, 3)

  const colonIdx = topDimKey.indexOf(':')
  const prefix = topDimKey.slice(0, colonIdx + 1)
  const value = topDimKey.slice(colonIdx + 1)

  const scored = candidates.map(dish => {
    let s = 0
    if (prefix === 't:') {
      if ((dish.txDishType ?? []).includes(value)) s += 3
    } else if (prefix === 'tp:') {
      if ((dish.txDishType ?? []).includes(value)) s += 2
    } else if (prefix === 'c:') {
      if (dish.categoriaNorm === value) s += 3
    } else if (prefix === 'k:') {
      if (dish.cuisineTag === value) s += 3
    }
    // Secondary boosts from other liked dims this dish has
    s += (likeFreq[`c:${dish.categoriaNorm}`] ?? 0) * 0.2
    s += dish.cuisineTag ? (likeFreq[`k:${dish.cuisineTag}`] ?? 0) * 0.2 : 0
    // Popularity tiebreaker
    s += dish.popularityScore * 0.001
    return { dish, s }
  })

  return scored
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map(({ dish }) => dish)
}

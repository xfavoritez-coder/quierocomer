import type { FeedDish } from '../types'
import { ADJACENT_CATEGORIES } from './categories'
import { extractKeywords, keywordAffinity } from './keywords'

// Deterministic noise based on dish ID + date (stable within a day, varies across days)
const _today = new Date().toISOString().slice(0, 10)
function deterministicNoise(id: string): number {
  let hash = 0
  const str = id + _today
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return ((hash & 0x7fffffff) % 1000) / 1000 * 6 // 0-6 range, same as before
}

// ─── Pesos de scoring ──────────────────────────────────────────────
export const SCORE_WEIGHTS = {
  VIEW:        { category: 2,  restaurant: 1  },
  TAP:         { category: 5,  restaurant: 2  },
  LIKE:        { category: 12, restaurant: 4  },
  SAVE:        { category: 15, restaurant: 5  },
  ANTOJO:      { category: 10, restaurant: 3  },
  PASS:        { category: -9, restaurant: -2 },
  SCROLL_BACK: { category: 7,  restaurant: 3  },
  RATE_HIGH:   { category: 8,  restaurant: 3  },
  RATE_LOW:    { category: -6, restaurant: -3 },
  COMMENT:     { category: 4,  restaurant: 2  },
}

// ─── Perfil del usuario ────────────────────────────────────────────
export type FeedProfile = {
  categoryScores: Record<string, number>
  restaurantScores: Record<string, number>
  keywordScores: Record<string, number>
  seenDishIds: Set<string>
  likedDishIds: Set<string>
  passedDishIds: Set<string>
  totalInteractions: number
  prices: number[]
  // Session momentum: recent actions in THIS session (decays)
  sessionKeywords: Record<string, number>  // keywords liked in current session
  sessionCategories: Record<string, number> // categories liked in current session
  // Dwell tracking: dishes the user paused on
  dwellDishIds: Set<string>  // dishes with dwell > 2s
}

export function createEmptyProfile(): FeedProfile {
  return {
    categoryScores: {},
    restaurantScores: {},
    keywordScores: {},
    seenDishIds: new Set(),
    likedDishIds: new Set(),
    passedDishIds: new Set(),
    totalInteractions: 0,
    prices: [],
    sessionKeywords: {},
    sessionCategories: {},
    dwellDishIds: new Set(),
  }
}

// ─── Actualizar perfil con una acción ──────────────────────────────
export function updateProfile(
  profile: FeedProfile,
  dish: FeedDish,
  action: keyof typeof SCORE_WEIGHTS,
): FeedProfile {
  const weights = SCORE_WEIGHTS[action]
  const cat = dish.categoriaNorm
  const rest = dish.restauranteId

  const newProfile = { ...profile }
  newProfile.categoryScores = { ...profile.categoryScores }
  newProfile.restaurantScores = { ...profile.restaurantScores }
  newProfile.keywordScores = { ...profile.keywordScores }
  newProfile.sessionKeywords = { ...profile.sessionKeywords }
  newProfile.sessionCategories = { ...profile.sessionCategories }
  newProfile.seenDishIds = new Set(profile.seenDishIds)
  newProfile.likedDishIds = new Set(profile.likedDishIds)
  newProfile.passedDishIds = new Set(profile.passedDishIds)
  newProfile.dwellDishIds = new Set(profile.dwellDishIds)
  newProfile.prices = [...profile.prices]

  // Category + restaurant (persistent)
  newProfile.categoryScores[cat] = (newProfile.categoryScores[cat] ?? 0) + weights.category
  newProfile.restaurantScores[rest] = (newProfile.restaurantScores[rest] ?? 0) + weights.restaurant

  // Keywords from name + description (persistent)
  const keywords = extractKeywords(dish.nombre, dish.descripcion)
  const isPositive = action === 'LIKE' || action === 'SAVE' || action === 'ANTOJO'
  const isNegative = action === 'PASS'
  // LIKE/SAVE/ANTOJO = strong signal (+5), TAP = weak (+1, just looked), PASS = negative (-3)
  const kwWeight = isPositive ? 5 : action === 'TAP' ? 1 : isNegative ? -3 : 0

  if (kwWeight !== 0) {
    for (const kw of keywords) {
      newProfile.keywordScores[kw] = (newProfile.keywordScores[kw] ?? 0) + kwWeight
    }
  }

  // Session momentum (stronger, ephemeral — only positive actions)
  if (isPositive) {
    for (const kw of keywords) {
      newProfile.sessionKeywords[kw] = (newProfile.sessionKeywords[kw] ?? 0) + 6
    }
    newProfile.sessionCategories[cat] = (newProfile.sessionCategories[cat] ?? 0) + 8
  }
  if (isNegative) {
    newProfile.sessionCategories[cat] = (newProfile.sessionCategories[cat] ?? 0) - 5
  }

  // Track state
  newProfile.seenDishIds.add(dish.id)
  if (isPositive) {
    newProfile.likedDishIds.add(dish.id)
    const priceVal = dish.precioDescuento ?? dish.precio
    if (priceVal != null) newProfile.prices.push(priceVal)
  }
  if (isNegative) {
    newProfile.passedDishIds.add(dish.id)
  }

  newProfile.totalInteractions++
  return newProfile
}

// ─── Register dwell (dish was visible > 2s) ────────────────────────
export function registerDwell(profile: FeedProfile, dishId: string): FeedProfile {
  if (profile.dwellDishIds.has(dishId)) return profile
  const newProfile = { ...profile }
  newProfile.dwellDishIds = new Set(profile.dwellDishIds)
  newProfile.dwellDishIds.add(dishId)
  return newProfile
}

// ─── Calcular afinidad de un plato ─────────────────────────────────
export function affinity(dish: FeedDish, profile: FeedProfile): number {
  const catScore = profile.categoryScores[dish.categoriaNorm] ?? 0
  const restScore = profile.restaurantScores[dish.restauranteId] ?? 0

  // Persistent signals (compressed with log)
  const catSignal = catScore > 0 ? Math.log2(catScore + 1) * 3 : catScore < 0 ? catScore * 0.5 : 0
  const restSignal = restScore > 0 ? Math.log2(restScore + 1) * 1.5 : 0

  // Keyword affinity (name + description)
  const kwScore = keywordAffinity(dish.nombre, dish.descripcion, profile.keywordScores)
  const kwSignal = kwScore > 0 ? Math.log2(kwScore + 1) * 2.5 : 0

  // Session momentum — what you've been liking RIGHT NOW matters more
  const sessionCatBoost = profile.sessionCategories[dish.categoriaNorm] ?? 0
  const sessionKwBoost = extractKeywords(dish.nombre, dish.descripcion)
    .reduce((sum, kw) => sum + (profile.sessionKeywords[kw] ?? 0), 0)
  const sessionSignal = (sessionCatBoost > 0 ? Math.log2(sessionCatBoost + 1) * 2 : 0)
    + (sessionKwBoost > 0 ? Math.log2(sessionKwBoost + 1) * 1.5 : 0)

  let score = catSignal + restSignal + kwSignal + sessionSignal

  // Adyacencia (descubrimiento)
  const adjacent = ADJACENT_CATEGORIES[dish.categoriaNorm] ?? []
  for (const adj of adjacent) {
    const adjScore = profile.categoryScores[adj] ?? 0
    if (adjScore >= 12) score += Math.log2(adjScore) * 1.5
  }

  // Popularidad
  if (dish.popularityScore > 0) score += dish.popularityScore * 0.2

  // Oferta
  if (dish.enOferta) score += 3

  // Penalización si ya fue visto
  if (profile.seenDishIds.has(dish.id)) score -= 8

  // Bonus si el usuario hizo dwell (se detuvo a mirarlo)
  if (profile.dwellDishIds.has(dish.id) && !profile.seenDishIds.has(dish.id)) score += 3

  // No mostrar platos pasados
  if (profile.passedDishIds.has(dish.id)) score -= 1000

  // Precio fuera de rango
  if (profile.prices.length >= 10) {
    const sorted = [...profile.prices].sort((a, b) => a - b)
    const p20 = sorted[Math.floor(sorted.length * 0.2)]
    const p80 = sorted[Math.floor(sorted.length * 0.8)]
    const price = dish.precioDescuento ?? dish.precio
    if (price != null && (price < p20 || price > p80)) score -= 3
  }

  // Deterministic noise for variety (stable within session, changes daily)
  score += deterministicNoise(dish.id)

  return score
}

// ─── Motivo de recomendación ───────────────────────────────────────
export function getRecommendationReason(
  dish: FeedDish,
  profile: FeedProfile,
): string | null {
  if (profile.totalInteractions < 5) return null

  // Session momentum reason (most immediate)
  const sessionCat = profile.sessionCategories[dish.categoriaNorm] ?? 0
  if (sessionCat >= 8) {
    return `Estás explorando ${dish.categoriaNorm.toLowerCase()}`
  }

  // Keyword reason — only if score is high enough (means they liked, not just saw)
  const keywords = extractKeywords(dish.nombre, dish.descripcion)
  const topKw = keywords
    .filter(kw => (profile.keywordScores[kw] ?? 0) >= 15)
    .sort((a, b) => (profile.keywordScores[b] ?? 0) - (profile.keywordScores[a] ?? 0))
  if (topKw.length > 0) {
    return `Porque te gusta ${topKw[0]}`
  }

  const catScore = profile.categoryScores[dish.categoriaNorm] ?? 0

  // Categoría — high threshold means real likes, not just views
  if (catScore >= 25) {
    return `Porque te gusta ${dish.categoriaNorm.toLowerCase()}`
  }
  if (catScore >= 12) {
    return `Basado en lo que has visto`
  }

  // Adyacencia
  const adjacent = ADJACENT_CATEGORIES[dish.categoriaNorm] ?? []
  for (const adj of adjacent) {
    if ((profile.categoryScores[adj] ?? 0) >= 16) {
      return `Si te gusta ${adj.toLowerCase()}, prueba esto`
    }
  }

  // Popularidad
  if (dish.popularityScore > 50) return `Popular en ${dish.restaurante}`

  // Oferta
  if (dish.enOferta) return 'En oferta'

  return null
}

// ─── Re-rankear el feed ────────────────────────────────────────────
export function rankFeed(dishes: FeedDish[], profile: FeedProfile): FeedDish[] {
  if (profile.totalInteractions < 3) return dishes

  const sorted = [...dishes].sort((a, b) => affinity(b, profile) - affinity(a, profile))

  // Intercalar: max 2 de la misma categoría seguidos
  const result: FeedDish[] = []
  const remaining = [...sorted]

  while (remaining.length > 0) {
    const recent = result.slice(-2).map(d => d.categoriaNorm)
    const allSame = recent.length === 2 && recent[0] === recent[1]

    if (allSame) {
      const diffIdx = remaining.findIndex(d => d.categoriaNorm !== recent[0])
      if (diffIdx >= 0) {
        result.push(remaining[diffIdx])
        remaining.splice(diffIdx, 1)
        continue
      }
    }

    result.push(remaining.shift()!)
  }

  return result
}

// ─── Indicador de calibración ──────────────────────────────────────
export function getCalibrationStatus(profile: FeedProfile): {
  isCalibrating: boolean
  message: string | null
} {
  if (profile.totalInteractions < 10) {
    return { isCalibrating: true, message: 'Aprendiendo tus gustos...' }
  }
  return { isCalibrating: false, message: null }
}

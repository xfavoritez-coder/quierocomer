import type { FeedDish } from '../types'
import { ADJACENT_CATEGORIES } from './categories'
import { extractKeywords, keywordAffinity } from './keywords'

// ─── Pesos de scoring ──────────────────────────────────────────────
export const SCORE_WEIGHTS = {
  VIEW:        { category: 2,  restaurant: 1  },
  TAP:         { category: 5,  restaurant: 2  },
  LIKE:        { category: 12, restaurant: 4  },
  SAVE:        { category: 15, restaurant: 5  },
  ANTOJO:      { category: 10, restaurant: 3  },
  PASS:        { category: -9, restaurant: -2 },
  SCROLL_BACK: { category: 7,  restaurant: 3  },
  RATE_HIGH:   { category: 8,  restaurant: 3  },  // 4-5 estrellas
  RATE_LOW:    { category: -6, restaurant: -3 },  // 1-2 estrellas
  COMMENT:     { category: 4,  restaurant: 2  },
}

// ─── Perfil del usuario (en memoria, sincronizado con BD) ──────────
export type FeedProfile = {
  categoryScores: Record<string, number>
  restaurantScores: Record<string, number>
  keywordScores: Record<string, number>
  seenDishIds: Set<string>
  likedDishIds: Set<string>
  passedDishIds: Set<string>
  totalInteractions: number
  prices: number[]
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
  newProfile.seenDishIds = new Set(profile.seenDishIds)
  newProfile.likedDishIds = new Set(profile.likedDishIds)
  newProfile.passedDishIds = new Set(profile.passedDishIds)
  newProfile.prices = [...profile.prices]

  // Update category + restaurant scores
  newProfile.categoryScores[cat] = (newProfile.categoryScores[cat] ?? 0) + weights.category
  newProfile.restaurantScores[rest] = (newProfile.restaurantScores[rest] ?? 0) + weights.restaurant

  // Update keyword scores from dish name
  const keywords = extractKeywords(dish.nombre)
  const kwWeight = action === 'LIKE' || action === 'SAVE' || action === 'ANTOJO' ? 4
    : action === 'TAP' ? 2
    : action === 'PASS' ? -3
    : 0
  if (kwWeight !== 0) {
    for (const kw of keywords) {
      newProfile.keywordScores[kw] = (newProfile.keywordScores[kw] ?? 0) + kwWeight
    }
  }

  // Track dish state
  newProfile.seenDishIds.add(dish.id)
  if (action === 'LIKE' || action === 'SAVE' || action === 'ANTOJO') {
    newProfile.likedDishIds.add(dish.id)
    newProfile.prices.push(dish.precioDescuento ?? dish.precio)
  }
  if (action === 'PASS') {
    newProfile.passedDishIds.add(dish.id)
  }

  newProfile.totalInteractions++

  return newProfile
}

// ─── Calcular afinidad de un plato ─────────────────────────────────
export function affinity(dish: FeedDish, profile: FeedProfile): number {
  const catScore = profile.categoryScores[dish.categoriaNorm] ?? 0
  const restScore = profile.restaurantScores[dish.restauranteId] ?? 0

  // Usar logaritmo para comprimir la diferencia entre categorías
  // Así Sushi(30) vs Sandwiches(15) se convierte en ~3.4 vs ~2.7 (no 30 vs 15)
  const catSignal = catScore > 0 ? Math.log2(catScore + 1) * 3 : catScore < 0 ? catScore * 0.5 : 0
  const restSignal = restScore > 0 ? Math.log2(restScore + 1) * 1.5 : 0

  // Keyword affinity — fine-grained scoring by dish name words
  const kwScore = keywordAffinity(dish.nombre, profile.keywordScores)
  const kwSignal = kwScore > 0 ? Math.log2(kwScore + 1) * 2.5 : 0

  let score = catSignal + restSignal + kwSignal

  // Bonus por adyacencia (descubrimiento)
  const adjacent = ADJACENT_CATEGORIES[dish.categoriaNorm] ?? []
  for (const adj of adjacent) {
    const adjScore = profile.categoryScores[adj] ?? 0
    if (adjScore >= 12) score += Math.log2(adjScore) * 1.5
  }

  // Bonus por popularidad
  if (dish.popularityScore > 0) score += dish.popularityScore * 0.2

  // Bonus por oferta
  if (dish.enOferta) score += 3

  // Penalización si ya fue visto
  if (profile.seenDishIds.has(dish.id)) score -= 8

  // No mostrar platos pasados
  if (profile.passedDishIds.has(dish.id)) score -= 1000

  // Penalización por precio fuera de rango
  if (profile.prices.length >= 10) {
    const sorted = [...profile.prices].sort((a, b) => a - b)
    const p20 = sorted[Math.floor(sorted.length * 0.2)]
    const p80 = sorted[Math.floor(sorted.length * 0.8)]
    const price = dish.precioDescuento ?? dish.precio
    if (price < p20 || price > p80) score -= 3
  }

  // Ruido grande para variedad — evita que una categoría domine
  score += Math.random() * 6

  return score
}

// ─── Motivo de recomendación ───────────────────────────────────────
export function getRecommendationReason(
  dish: FeedDish,
  profile: FeedProfile,
): string | null {
  if (profile.totalInteractions < 5) return null

  // Por keyword (más específico, va primero)
  const keywords = extractKeywords(dish.nombre)
  const topKw = keywords
    .filter(kw => (profile.keywordScores[kw] ?? 0) >= 8)
    .sort((a, b) => (profile.keywordScores[b] ?? 0) - (profile.keywordScores[a] ?? 0))
  if (topKw.length > 0) {
    return `Porque te gusta ${topKw[0]}`
  }

  const catScore = profile.categoryScores[dish.categoriaNorm] ?? 0

  // Por categoría directa
  if (catScore >= 16) {
    return `Porque te gusta ${dish.categoriaNorm.toLowerCase()}`
  }

  // Por adyacencia
  const adjacent = ADJACENT_CATEGORIES[dish.categoriaNorm] ?? []
  for (const adj of adjacent) {
    if ((profile.categoryScores[adj] ?? 0) >= 16) {
      return `Si te gusta ${adj.toLowerCase()}, prueba esto`
    }
  }

  // Por popularidad
  if (dish.popularityScore > 50) {
    return `Popular en ${dish.restaurante}`
  }

  // Por oferta
  if (dish.enOferta) return 'En oferta'

  return null
}

// ─── Re-rankear el feed ────────────────────────────────────────────
export function rankFeed(dishes: FeedDish[], profile: FeedProfile): FeedDish[] {
  if (profile.totalInteractions < 3) return dishes

  // Ordenar por afinidad
  const sorted = [...dishes].sort((a, b) => affinity(b, profile) - affinity(a, profile))

  // Intercalar para evitar que una categoría domine bloques consecutivos
  // Máximo 2 platos de la misma categoría seguidos
  const result: FeedDish[] = []
  const remaining = [...sorted]

  while (remaining.length > 0) {
    const recent = result.slice(-2).map(d => d.categoriaNorm)
    const allSame = recent.length === 2 && recent[0] === recent[1]

    if (allSame) {
      // Buscar el primer plato de categoría diferente
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
    return {
      isCalibrating: true,
      message: 'Aprendiendo tus gustos...',
    }
  }
  return { isCalibrating: false, message: null }
}

/**
 * Taste Engine — Phase 2: the brain of the recommender.
 *
 * Three layers of taste:
 * 1. GUSTO DE FONDO (background): slow-moving, built over weeks from likes
 * 2. ANTOJO DE HOY (today's craving): dishes liked/rejected TODAY, resets daily
 * 3. MOMENTUM DE SESIÓN (session): what you're looking at RIGHT NOW (in-memory only)
 *
 * Feed mix: 70% score / 15% popular / 15% discovery
 */

import { prisma } from '@/lib/prisma'
import { averageEmbeddings, getDishEmbedding } from './vectors'

/**
 * Meal period: resets antojo when switching between periods.
 * Desayuno (6-10), Brunch (10-12), Almuerzo (12-15), Once (15-19), Cena (19-23), Madrugada (23-6)
 */
function getMealPeriod(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const hour = now.getHours()
  const period = hour >= 6 && hour < 10 ? 'desayuno'
    : hour >= 10 && hour < 12 ? 'brunch'
    : hour >= 12 && hour < 15 ? 'almuerzo'
    : hour >= 15 && hour < 19 ? 'once'
    : hour >= 19 && hour < 23 ? 'cena'
    : 'madrugada'
  return `${date}_${period}`
}

const LEARNING_RATE_LIKE = 0.05    // gustoVector moves slowly toward liked dishes
const LEARNING_RATE_DISLIKE = 0.02 // moves even slower away from disliked
const MAX_TASTE_HISTORY = 50       // keep last N liked embeddings for clustering

// ─── Update taste after an action ──────────────────────────────────
export async function updateTaste(
  userId: string,
  dishId: string,
  action: 'LIKE' | 'DISLIKE' | 'ANTOJO' | 'FAVORITE' | 'UNDO',
) {
  const dishEmbedding = await getDishEmbedding(dishId)
  if (!dishEmbedding) return // dish has no embedding yet

  const user = await prisma.feedUser.findUnique({
    where: { id: userId },
    select: {
      tasteEmbeddings: true,
      antojoSessionDate: true,
      antojoDishIds: true,
      antojoRejectIds: true,
    },
  })
  if (!user) return

  const currentPeriod = getMealPeriod() // "2026-06-14_almuerzo"
  const isNewPeriod = user.antojoSessionDate !== currentPeriod

  // Reset antojo if meal period changed (desayuno→brunch→almuerzo→once→cena)
  let antojoDishIds = isNewPeriod ? [] : (user.antojoDishIds as string[] ?? [])
  let antojoRejectIds = isNewPeriod ? [] : (user.antojoRejectIds as string[] ?? [])
  let tasteEmbeddings = (user.tasteEmbeddings as any[] ?? [])

  if (action === 'LIKE' || action === 'ANTOJO') {
    // Antojo layer: mark as craved today
    if (!antojoDishIds.includes(dishId)) {
      antojoDishIds.push(dishId)
    }
    // Remove from rejects if was there
    antojoRejectIds = antojoRejectIds.filter((id: string) => id !== dishId)

    // Background taste: add embedding to history
    tasteEmbeddings.push({
      dishId,
      embedding: dishEmbedding,
      action,
      at: Date.now(),
    })
    // Keep only last N
    if (tasteEmbeddings.length > MAX_TASTE_HISTORY) {
      tasteEmbeddings = tasteEmbeddings.slice(-MAX_TASTE_HISTORY)
    }

    // Update gustoVector: move toward this dish
    await moveGustoVector(userId, dishEmbedding, LEARNING_RATE_LIKE)

  } else if (action === 'DISLIKE') {
    // Antojo layer: mark as rejected today
    if (!antojoRejectIds.includes(dishId)) {
      antojoRejectIds.push(dishId)
    }
    antojoDishIds = antojoDishIds.filter((id: string) => id !== dishId)

    // Background taste: move AWAY (slower)
    await moveGustoVector(userId, dishEmbedding, -LEARNING_RATE_DISLIKE)

  } else if (action === 'UNDO') {
    // Remove from both antojo lists
    antojoDishIds = antojoDishIds.filter((id: string) => id !== dishId)
    antojoRejectIds = antojoRejectIds.filter((id: string) => id !== dishId)
    // Remove from taste history
    const wasLiked = tasteEmbeddings.some((t: any) => t.dishId === dishId)
    tasteEmbeddings = tasteEmbeddings.filter((t: any) => t.dishId !== dishId)
    // Reverse the gustoVector drift
    if (wasLiked) {
      await moveGustoVector(userId, dishEmbedding, -LEARNING_RATE_LIKE)
    } else {
      await moveGustoVector(userId, dishEmbedding, LEARNING_RATE_DISLIKE)
    }
  }

  // Persist antojo state + taste history
  await prisma.feedUser.update({
    where: { id: userId },
    data: {
      antojoSessionDate: currentPeriod,
      antojoDishIds: antojoDishIds,
      antojoRejectIds: antojoRejectIds,
      tasteEmbeddings: tasteEmbeddings,
    },
  })
}

// ─── Move gustoVector toward/away from a dish ──────────────────────
async function moveGustoVector(
  userId: string,
  dishEmbedding: number[],
  learningRate: number,
) {
  // Get current gustoVector
  const result = await prisma.$queryRawUnsafe<{ v: string }[]>(
    `SELECT "gustoVector"::text as v FROM "FeedUser" WHERE id = $1`,
    userId,
  )

  let currentVector: number[]

  if (!result[0]?.v) {
    // First interaction: initialize with this dish's embedding
    const embStr = `[${dishEmbedding.join(',')}]`
    await prisma.$executeRawUnsafe(
      `UPDATE "FeedUser" SET "gustoVector" = $1::vector WHERE id = $2`,
      embStr, userId,
    )
    return
  }

  currentVector = JSON.parse(result[0].v)

  // Move: new = current + learningRate * (dish - current)
  const newVector = currentVector.map((v, i) =>
    v + learningRate * (dishEmbedding[i] - v)
  )

  // Normalize
  const norm = Math.sqrt(newVector.reduce((s, v) => s + v * v, 0))
  const normalized = norm > 0 ? newVector.map(v => v / norm) : newVector

  const embStr = `[${normalized.join(',')}]`
  await prisma.$executeRawUnsafe(
    `UPDATE "FeedUser" SET "gustoVector" = $1::vector WHERE id = $2`,
    embStr, userId,
  )
}

// ─── Get feed scored by taste ──────────────────────────────────────
export async function getScoredFeed(
  userId: string,
  limit = 60,
  excludeIds: string[] = [],
  dietFilter?: { isVegan?: boolean; isVegetarian?: boolean; isGlutenFree?: boolean; isLactoseFree?: boolean },
): Promise<{ dishId: string; score: number; reason: string }[]> {
  const user = await prisma.feedUser.findUnique({
    where: { id: userId },
    select: {
      totalInteractions: true,
      antojoSessionDate: true,
      antojoDishIds: true,
      antojoRejectIds: true,
    },
  })
  if (!user) return []

  const currentPeriod = getMealPeriod()
  const isNewPeriod = user.antojoSessionDate !== currentPeriod
  const antojoRejectIds = isNewPeriod ? [] : (user.antojoRejectIds as string[] ?? [])
  const antojoDishIds = isNewPeriod ? [] : (user.antojoDishIds as string[] ?? [])

  // Merge excludes
  const allExcludes = [...new Set([...excludeIds, ...antojoRejectIds])]

  // COLD START: < 8 interactions → popular + varied
  if (user.totalInteractions < 8) {
    return getColdStartFeed(limit, allExcludes, dietFilter)
  }

  // Build parameterized exclude clause using ANY()
  const excludeArr = allExcludes.length > 0 ? allExcludes : null

  // Check if user has gustoVector
  const vectorResult = await prisma.$queryRawUnsafe<{ v: string }[]>(
    `SELECT "gustoVector"::text as v FROM "FeedUser" WHERE id = $1`,
    userId,
  )

  if (!vectorResult[0]?.v) {
    return getColdStartFeed(limit, allExcludes, dietFilter)
  }

  const gustoVector = JSON.parse(vectorResult[0].v) as number[]

  // Build diet filter SQL
  let dietClause = ''
  if (dietFilter?.isVegan) dietClause += ` AND d."dishDiet" = 'VEGAN'`
  else if (dietFilter?.isVegetarian) dietClause += ` AND d."dishDiet" IN ('VEGAN', 'VEGETARIAN')`
  if (dietFilter?.isGlutenFree) dietClause += ` AND d."isGlutenFree" = true`
  if (dietFilter?.isLactoseFree) dietClause += ` AND d."isLactoseFree" = true`

  const excludeClause = excludeArr
    ? `AND d.id != ALL($3::text[])`
    : ''

  const embStr = `[${gustoVector.join(',')}]`

  // 70% — scored by taste similarity (preserves cosine order)
  const scoredLimit = Math.ceil(limit * 0.7)
  const scoredParams: any[] = [embStr, scoredLimit]
  if (excludeArr) scoredParams.push(excludeArr)

  const scored = await prisma.$queryRawUnsafe<any[]>(`
    SELECT d.id as "dishId", 1 - (d.embedding <=> $1::vector) as score
    FROM "Dish" d
    JOIN "Restaurant" r ON r.id = d."restaurantId"
    WHERE d.embedding IS NOT NULL
      AND d."isActive" = true AND d."deletedAt" IS NULL
      AND r."isActive" = true AND r."isDemo" = false
      AND d.photos != '{}'
      ${dietClause} ${excludeClause}
    ORDER BY d.embedding <=> $1::vector
    LIMIT $2
  `, ...scoredParams)

  // Tag each with reason, keep original score order
  for (const s of scored) {
    s.reason = 'Para ti'
  }

  // 15% — popular globally
  const popularLimit = Math.ceil(limit * 0.15)
  const scoredIds = scored.map((s: any) => s.dishId)
  const allUsedIds = [...allExcludes, ...scoredIds]

  const popular = await prisma.$queryRawUnsafe<any[]>(`
    SELECT d.id as "dishId", COALESCE(fs."popularityScore", 0) as score
    FROM "Dish" d
    JOIN "Restaurant" r ON r.id = d."restaurantId"
    LEFT JOIN "FeedDishStats" fs ON fs."dishId" = d.id
    WHERE d."isActive" = true AND d."deletedAt" IS NULL
      AND r."isActive" = true AND r."isDemo" = false
      AND d.photos != '{}'
      AND d.id != ALL($2::text[])
      ${dietClause}
    ORDER BY COALESCE(fs."popularityScore", 0) DESC
    LIMIT $1
  `, popularLimit, allUsedIds)

  for (const p of popular) {
    p.reason = 'Popular'
  }

  // 15% — discovery (random, unexplored)
  const discoveryLimit = Math.ceil(limit * 0.15)
  const allUsedIds2 = [...allUsedIds, ...popular.map((p: any) => p.dishId)]

  const discovery = await prisma.$queryRawUnsafe<any[]>(`
    SELECT d.id as "dishId", RANDOM() as score
    FROM "Dish" d
    JOIN "Restaurant" r ON r.id = d."restaurantId"
    WHERE d.embedding IS NOT NULL
      AND d."isActive" = true AND d."deletedAt" IS NULL
      AND r."isActive" = true AND r."isDemo" = false
      AND d.photos != '{}'
      AND d.id != ALL($2::text[])
      ${dietClause}
    ORDER BY RANDOM()
    LIMIT $1
  `, discoveryLimit, allUsedIds2)

  for (const d of discovery) {
    d.reason = 'Para descubrir'
  }

  // Score-preserving interleave: scored first (by vector order), then popular
  // (by popularity), then discovery — only break runs of 3+ same reason
  return interleave([...scored, ...popular, ...discovery])
}

// ─── Cold start feed ───────────────────────────────────────────────
async function getColdStartFeed(
  limit: number,
  excludeIds: string[],
  dietFilter?: any,
): Promise<{ dishId: string; score: number; reason: string }[]> {
  let dietClause = ''
  if (dietFilter?.isVegan) dietClause += ` AND d."dishDiet" = 'VEGAN'`
  else if (dietFilter?.isVegetarian) dietClause += ` AND d."dishDiet" IN ('VEGAN', 'VEGETARIAN')`
  if (dietFilter?.isGlutenFree) dietClause += ` AND d."isGlutenFree" = true`
  if (dietFilter?.isLactoseFree) dietClause += ` AND d."isLactoseFree" = true`

  const excludeClause = excludeIds.length > 0
    ? `AND d.id != ALL($2::text[])`
    : ''

  // Mix of popular + varied (top 2-3 per category for denser cold start)
  const params: any[] = [limit]
  if (excludeIds.length > 0) params.push(excludeIds)

  const results = await prisma.$queryRawUnsafe<any[]>(`
    SELECT DISTINCT ON (c.name) d.id as "dishId",
      COALESCE(fs."popularityScore", 0) + RANDOM() * 5 as score
    FROM "Dish" d
    JOIN "Category" c ON c.id = d."categoryId"
    JOIN "Restaurant" r ON r.id = d."restaurantId"
    LEFT JOIN "FeedDishStats" fs ON fs."dishId" = d.id
    WHERE d."isActive" = true AND d."deletedAt" IS NULL
      AND r."isActive" = true AND r."isDemo" = false
      AND d.photos != '{}'
      ${dietClause} ${excludeClause}
    ORDER BY c.name, COALESCE(fs."popularityScore", 0) + RANDOM() * 5 DESC
    LIMIT $1
  `, ...params)

  return results.map(r => ({ ...r, reason: 'Descubre' }))
}

// ─── Score-preserving interleave ──────────────────────────────────
// Keeps the original order (vector similarity → popularity → random)
// but breaks runs of 3+ consecutive items with the same reason.
function interleave(items: any[]): any[] {
  const result: any[] = []
  const remaining = [...items]

  while (remaining.length > 0) {
    const recent = result.slice(-2).map(r => r.reason)
    const allSame = recent.length === 2 && recent[0] === recent[1]

    if (allSame) {
      // Find the next item with a different reason
      const diffIdx = remaining.findIndex(r => r.reason !== recent[0])
      if (diffIdx >= 0) {
        result.push(remaining.splice(diffIdx, 1)[0])
        continue
      }
    }
    result.push(remaining.shift()!)
  }

  return result
}

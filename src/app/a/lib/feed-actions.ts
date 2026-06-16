'use server'

import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import type { FeedAction } from '@prisma/client'

const COOKIE_NAME = 'qc_feed_user'
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 // 1 año

// ─── Get or create feed user ───────────────────────────────────────
async function getFeedUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  const fingerprint = cookieStore.get(COOKIE_NAME)?.value
  if (!fingerprint) return null
  const user = await prisma.feedUser.findUnique({
    where: { fingerprint },
    select: { id: true },
  })
  return user?.id ?? null
}

// ─── Complete onboarding ───────────────────────────────────────────
export async function completeOnboarding(restrictions: {
  isVegan: boolean
  isVegetarian: boolean
  isGlutenFree: boolean
  isLactoseFree: boolean
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const cookieStore = await cookies()
    let fingerprint = cookieStore.get(COOKIE_NAME)?.value

    if (!fingerprint) {
      fingerprint = crypto.randomUUID()
      cookieStore.set(COOKIE_NAME, fingerprint, {
        httpOnly: false, // needs to be readable for redirect check
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
      })
    }

    // Upsert user
    await prisma.feedUser.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        ...restrictions,
        onboardingDone: true,
      },
      update: {
        ...restrictions,
        onboardingDone: true,
        lastSeenAt: new Date(),
      },
    })

    return { ok: true }
  } catch (e: any) {
    console.error('[Feed] completeOnboarding error:', e)
    return { ok: false, error: e.message ?? 'Error desconocido' }
  }
}

// ─── Track interaction ─────────────────────────────────────────────
export async function trackInteraction(
  dishId: string,
  action: FeedAction,
  category: string,
  price: number,
  dwellMs?: number,
) {
  try {
    const userId = await getFeedUserId()
    if (!userId) return

    await prisma.feedInteraction.create({
      data: {
        feedUserId: userId,
        dishId,
        action,
        category,
        price,
        dwellMs: dwellMs ?? null,
      },
    })

    // Update user scores
    const weights = getActionWeights(action)
    if (!weights) return

    const user = await prisma.feedUser.findUnique({
      where: { id: userId },
      select: { categoryScores: true, restaurantScores: true, keywordScores: true },
    })
    if (!user) return

    const dish = await prisma.dish.findUnique({
      where: { id: dishId },
      select: { restaurantId: true, name: true, description: true },
    })
    if (!dish) return

    const catScores = (user.categoryScores as Record<string, number>) ?? {}
    const restScores = (user.restaurantScores as Record<string, number>) ?? {}
    const kwScores = (user.keywordScores as Record<string, number>) ?? {}
    catScores[category] = (catScores[category] ?? 0) + weights.category
    restScores[dish.restaurantId] = (restScores[dish.restaurantId] ?? 0) + weights.restaurant

    // Update keyword scores from dish name
    const { extractKeywords } = await import('./keywords')
    const keywords = extractKeywords(dish.name, dish.description)
    const kwWeight = action === 'LIKE' || action === 'SAVE' || action === 'ANTOJO' ? 5
      : action === 'TAP' ? 1
      : action === 'PASS' ? -3
      : 0
    if (kwWeight !== 0) {
      for (const kw of keywords) {
        kwScores[kw] = (kwScores[kw] ?? 0) + kwWeight
      }
    }

    await prisma.feedUser.update({
      where: { id: userId },
      data: {
        categoryScores: catScores,
        restaurantScores: restScores,
        keywordScores: kwScores,
        totalInteractions: { increment: 1 },
      },
    })

    // Update dish stats
    await updateDishStats(dishId, action)
  } catch (e) {
    console.error('[Feed] trackInteraction error:', e)
  }
}

// ─── Rate dish ─────────────────────────────────────────────────────
export async function rateDish(dishId: string, stars: number) {
  try {
    const userId = await getFeedUserId()
    if (!userId) return

    await prisma.feedRating.upsert({
      where: { feedUserId_dishId: { feedUserId: userId, dishId } },
      create: { feedUserId: userId, dishId, stars },
      update: { stars },
    })

    const agg = await prisma.feedRating.aggregate({
      where: { dishId },
      _avg: { stars: true },
      _count: true,
    })

    await prisma.feedDishStats.upsert({
      where: { dishId },
      create: { dishId, avgRating: agg._avg.stars, ratingCount: agg._count },
      update: { avgRating: agg._avg.stars, ratingCount: agg._count },
    })
  } catch (e) {
    console.error('[Feed] rateDish error:', e)
  }
}

// ─── Comment on dish ───────────────────────────────────────────────
export async function commentDish(dishId: string, text: string) {
  try {
    const userId = await getFeedUserId()
    if (!userId) return null
    const trimmed = text.trim()
    if (!trimmed || trimmed.length > 500) return null

    const comment = await prisma.feedComment.create({
      data: { feedUserId: userId, dishId, text: trimmed },
    })

    const count = await prisma.feedComment.count({ where: { dishId } })
    await prisma.feedDishStats.upsert({
      where: { dishId },
      create: { dishId, commentCount: count },
      update: { commentCount: count },
    })

    return comment
  } catch (e) {
    console.error('[Feed] commentDish error:', e)
    return null
  }
}

// ─── Save / unsave dish ────────────────────────────────────────────
export async function saveDish(dishId: string, type: 'ANTOJO' | 'SAVED') {
  try {
    const userId = await getFeedUserId()
    if (!userId) return

    await prisma.feedSaved.upsert({
      where: { feedUserId_dishId: { feedUserId: userId, dishId } },
      create: { feedUserId: userId, dishId, type },
      update: { type },
    })
  } catch (e) {
    console.error('[Feed] saveDish error:', e)
  }
}

export async function unsaveDish(dishId: string) {
  try {
    const userId = await getFeedUserId()
    if (!userId) return

    await prisma.feedSaved.deleteMany({
      where: { feedUserId: userId, dishId },
    })
  } catch (e) {
    console.error('[Feed] unsaveDish error:', e)
  }
}

export async function getSavedDishIds(): Promise<string[]> {
  try {
    const userId = await getFeedUserId()
    if (!userId) return []
    const rows = await prisma.feedSaved.findMany({
      where: { feedUserId: userId, type: 'SAVED' },
      select: { dishId: true },
    })
    return rows.map(r => r.dishId)
  } catch (e) {
    return []
  }
}

// ─── Helpers ───────────────────────────────────────────────────────
function getActionWeights(action: string): { category: number; restaurant: number } | null {
  const map: Record<string, { category: number; restaurant: number }> = {
    VIEW:        { category: 2,  restaurant: 1  },
    TAP:         { category: 5,  restaurant: 2  },
    LIKE:        { category: 12, restaurant: 4  },
    SAVE:        { category: 15, restaurant: 5  },
    ANTOJO:      { category: 10, restaurant: 3  },
    PASS:        { category: -9, restaurant: -2 },
    SCROLL_BACK: { category: 7,  restaurant: 3  },
  }
  return map[action] ?? null
}

async function updateDishStats(dishId: string, action: FeedAction) {
  const fieldMap: Record<string, string> = {
    VIEW: 'totalViews',
    TAP: 'totalTaps',
    LIKE: 'totalLikes',
    DISLIKE: 'totalPasses',
    SAVE: 'totalSaves',
    ANTOJO: 'totalAntojos',
    PASS: 'totalPasses',
    SCROLL_BACK: 'totalViews',
    FAVORITE: 'totalSaves',
    UNFAVORITE: '', // don't increment — handled separately
    UNDO: '',
  }
  const field = fieldMap[action]

  if (!field) return

  try {
    await prisma.feedDishStats.upsert({
      where: { dishId },
      create: { dishId, [field]: 1 },
      update: { [field]: { increment: 1 } },
    })

    const stats = await prisma.feedDishStats.findUnique({ where: { dishId } })
    if (stats) {
      const popularity =
        stats.totalViews * 0.5 +
        stats.totalTaps * 2 +
        stats.totalLikes * 5 +
        stats.totalSaves * 7 +
        stats.totalAntojos * 10 -
        stats.totalPasses * 3 +
        (stats.avgRating ?? 0) * stats.ratingCount * 2

      await prisma.feedDishStats.update({
        where: { dishId },
        data: { popularityScore: popularity },
      })
    }
  } catch (e) {
    console.error('[Feed] updateDishStats error:', e)
  }
}

// ─── Update display name ──────────────────────────────────────
export async function updateDisplayName(name: string) {
  try {
    const userId = await getFeedUserId()
    if (!userId) return
    await prisma.feedUser.update({
      where: { id: userId },
      data: { displayName: name.trim().slice(0, 30) || null },
    })
  } catch (e) {
    console.error('[Feed] updateDisplayName error:', e)
  }
}

// ─── Reset profile ─────────────────────────────────────────────────
export async function resetProfile() {
  try {
    const userId = await getFeedUserId()
    if (!userId) return

    await prisma.feedUser.update({
      where: { id: userId },
      data: {
        categoryScores: {},
        restaurantScores: {},
        keywordScores: {},
        tasteEmbeddings: [],
        antojoDishIds: [],
        antojoRejectIds: [],
        antojoSessionDate: null,
        totalInteractions: 0,
      },
    })

    // Reset gustoVector via raw SQL
    await prisma.$executeRawUnsafe(
      `UPDATE "FeedUser" SET "gustoVector" = NULL WHERE id = $1`,
      userId,
    )
  } catch (e) {
    console.error('[Feed] resetProfile error:', e)
  }
}

// ─── Taste engine actions ──────────────────────────────────────────
export async function updateTasteAction(
  dishId: string,
  action: 'LIKE' | 'DISLIKE' | 'ANTOJO' | 'FAVORITE' | 'UNDO',
) {
  try {
    const userId = await getFeedUserId()
    if (!userId) return
    const { updateTaste } = await import('./taste-engine')
    await updateTaste(userId, dishId, action)
  } catch (e) {
    console.error('[Feed] updateTaste error:', e)
  }
}

// ─── Similar dishes by embedding (text + image combined) ─────────
export async function getSimilarDishIds(dishId: string): Promise<string[]> {
  try {
    const { getDishEmbedding, findSimilarDishes, findVisuallySimilarDishes } = await import('./vectors')

    // Get text-similar dishes
    const textEmbedding = await getDishEmbedding(dishId)
    const textSimilar = textEmbedding
      ? await findSimilarDishes(textEmbedding, 10, [dishId])
      : []

    // Get visually-similar dishes
    let imageSimilar: { id: string; similarity: number }[] = []
    try {
      const imgResult = await prisma.$queryRawUnsafe<{ embedding: string }[]>(
        `SELECT "imageEmbedding"::text as embedding FROM "Dish" WHERE id = $1 AND "imageEmbedding" IS NOT NULL`, dishId
      )
      if (imgResult[0]?.embedding) {
        const imgEmb = JSON.parse(imgResult[0].embedding)
        imageSimilar = await findVisuallySimilarDishes(imgEmb, 10, [dishId])
      }
    } catch {}

    // Merge: combine scores, deduplicate, take top 12
    const scoreMap = new Map<string, number>()
    for (const s of textSimilar) {
      scoreMap.set(s.id, (s.similarity ?? 0) * 0.6) // text weight 60%
    }
    for (const s of imageSimilar) {
      scoreMap.set(s.id, (scoreMap.get(s.id) ?? 0) + (s.similarity ?? 0) * 0.4) // image weight 40%
    }

    return [...scoreMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([id]) => id)
  } catch (e) {
    console.error('[Feed] getSimilarDishIds error:', e)
    return []
  }
}

// ─── Get fresh profile data ───────────────────────────────────────
export async function getProfileData(): Promise<{
  categoryScores: Record<string, number>
  keywordScores: Record<string, number>
  totalInteractions: number
  displayName: string | null
  likeCount: number
  passCount: number
  likedDishIds: string[]
  viewedDishIds: string[]
  tasteData: { antojoSessionDate: string | null; antojoDishIds: string[]; antojoRejectIds: string[]; tasteEmbeddingsCount: number; hasGustoVector: boolean }
  diet: { isVegan: boolean; isVegetarian: boolean; isGlutenFree: boolean; isLactoseFree: boolean }
} | null> {
  try {
    const userId = await getFeedUserId()
    if (!userId) return null
    const user = await prisma.feedUser.findUnique({
      where: { id: userId },
      select: {
        categoryScores: true, keywordScores: true, totalInteractions: true,
        displayName: true,
        isVegan: true, isVegetarian: true, isGlutenFree: true, isLactoseFree: true,
        antojoSessionDate: true, antojoDishIds: true, antojoRejectIds: true, tasteEmbeddings: true,
      },
    })
    if (!user) return null

    let hasGustoVector = false
    try {
      const vr = await prisma.$queryRawUnsafe<{ v: string }[]>(
        `SELECT "gustoVector"::text as v FROM "FeedUser" WHERE id = $1`, userId
      )
      hasGustoVector = !!vr[0]?.v
    } catch {}

    // Count likes and passes from interactions
    const [likeCount, passCount, likedDishIds, viewedDishIds] = await Promise.all([
      prisma.feedInteraction.count({ where: { feedUserId: userId, action: 'LIKE' } }),
      prisma.feedInteraction.count({ where: { feedUserId: userId, action: 'PASS' } }),
      prisma.feedInteraction.findMany({
        where: { feedUserId: userId, action: 'LIKE' },
        select: { dishId: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.feedInteraction.findMany({
        where: { feedUserId: userId, action: 'TAP' },
        select: { dishId: true },
        distinct: ['dishId'],
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ])

    return {
      categoryScores: (user.categoryScores as Record<string, number>) ?? {},
      keywordScores: (user.keywordScores as Record<string, number>) ?? {},
      totalInteractions: user.totalInteractions,
      displayName: user.displayName,
      likeCount,
      passCount,
      likedDishIds: likedDishIds.map(l => l.dishId),
      viewedDishIds: viewedDishIds.map(v => v.dishId),
      tasteData: {
        antojoSessionDate: user.antojoSessionDate,
        antojoDishIds: (user.antojoDishIds as string[]) ?? [],
        antojoRejectIds: (user.antojoRejectIds as string[]) ?? [],
        tasteEmbeddingsCount: Array.isArray(user.tasteEmbeddings) ? user.tasteEmbeddings.length : 0,
        hasGustoVector,
      },
      diet: { isVegan: user.isVegan, isVegetarian: user.isVegetarian, isGlutenFree: user.isGlutenFree, isLactoseFree: user.isLactoseFree },
    }
  } catch (e) {
    console.error('[Feed] getProfileData error:', e)
    return null
  }
}

// ─── Refresh vector-scored feed ───────────────────────────────────
export async function getVectorFeed(excludeIds: string[] = []): Promise<string[]> {
  try {
    const userId = await getFeedUserId()
    if (!userId) return []
    const { getScoredFeed } = await import('./taste-engine')
    const scored = await getScoredFeed(userId, 120, excludeIds)
    return scored.map(s => s.dishId)
  } catch (e) {
    console.error('[Feed] getVectorFeed error:', e)
    return []
  }
}

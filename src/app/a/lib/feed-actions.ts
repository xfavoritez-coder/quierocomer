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
    UNFAVORITE: 'totalSaves',
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

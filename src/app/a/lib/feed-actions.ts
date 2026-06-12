'use server'

import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import type { FeedAction } from '@prisma/client'

const COOKIE_NAME = 'qc_feed_user'
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 // 1 año

// ─── Get or create feed user ───────────────────────────────────────
export async function getOrCreateFeedUser() {
  const cookieStore = await cookies()
  const fingerprint = cookieStore.get(COOKIE_NAME)?.value

  if (fingerprint) {
    const user = await prisma.feedUser.findUnique({ where: { fingerprint } })
    if (user) {
      // Update lastSeenAt
      await prisma.feedUser.update({
        where: { id: user.id },
        data: { lastSeenAt: new Date() },
      })
      return user
    }
  }

  // Create new user
  const newFingerprint = crypto.randomUUID()
  const user = await prisma.feedUser.create({
    data: { fingerprint: newFingerprint },
  })

  cookieStore.set(COOKIE_NAME, newFingerprint, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })

  return user
}

// ─── Get current feed user (null if not exists) ────────────────────
export async function getCurrentFeedUser() {
  const cookieStore = await cookies()
  const fingerprint = cookieStore.get(COOKIE_NAME)?.value
  if (!fingerprint) return null
  return prisma.feedUser.findUnique({ where: { fingerprint } })
}

// ─── Track interaction ─────────────────────────────────────────────
export async function trackInteraction(
  dishId: string,
  action: FeedAction,
  category: string,
  price: number,
  dwellMs?: number,
) {
  const user = await getOrCreateFeedUser()

  // Create interaction
  await prisma.feedInteraction.create({
    data: {
      feedUserId: user.id,
      dishId,
      action,
      category,
      price,
      dwellMs: dwellMs ?? null,
    },
  })

  // Update user scores
  const weights = getActionWeights(action)
  if (weights) {
    const catScores = (user.categoryScores as Record<string, number>) ?? {}
    const restScores = (user.restaurantScores as Record<string, number>) ?? {}

    // Get restaurant ID for this dish
    const dish = await prisma.dish.findUnique({
      where: { id: dishId },
      select: { restaurantId: true },
    })

    if (dish) {
      catScores[category] = (catScores[category] ?? 0) + weights.category
      restScores[dish.restaurantId] = (restScores[dish.restaurantId] ?? 0) + weights.restaurant
    }

    await prisma.feedUser.update({
      where: { id: user.id },
      data: {
        categoryScores: catScores,
        restaurantScores: restScores,
        totalInteractions: { increment: 1 },
      },
    })
  }

  // Update dish stats
  await updateDishStats(dishId, action)
}

// ─── Rate dish ─────────────────────────────────────────────────────
export async function rateDish(dishId: string, stars: number) {
  const user = await getOrCreateFeedUser()

  await prisma.feedRating.upsert({
    where: { feedUserId_dishId: { feedUserId: user.id, dishId } },
    create: { feedUserId: user.id, dishId, stars },
    update: { stars },
  })

  // Recalculate avg rating
  const agg = await prisma.feedRating.aggregate({
    where: { dishId },
    _avg: { stars: true },
    _count: true,
  })

  await prisma.feedDishStats.upsert({
    where: { dishId },
    create: {
      dishId,
      avgRating: agg._avg.stars,
      ratingCount: agg._count,
    },
    update: {
      avgRating: agg._avg.stars,
      ratingCount: agg._count,
    },
  })

  // Track as interaction
  const dish = await prisma.dish.findUnique({
    where: { id: dishId },
    select: { restaurantId: true, category: { select: { name: true } } },
  })
  if (dish) {
    const action = stars >= 4 ? 'RATE_HIGH' : stars <= 2 ? 'RATE_LOW' : null
    if (action) {
      const weights = getActionWeights(action as any)
      if (weights) {
        const catScores = (user.categoryScores as Record<string, number>) ?? {}
        const restScores = (user.restaurantScores as Record<string, number>) ?? {}
        catScores[dish.category.name] = (catScores[dish.category.name] ?? 0) + weights.category
        restScores[dish.restaurantId] = (restScores[dish.restaurantId] ?? 0) + weights.restaurant
        await prisma.feedUser.update({
          where: { id: user.id },
          data: { categoryScores: catScores, restaurantScores: restScores },
        })
      }
    }
  }
}

// ─── Comment on dish ───────────────────────────────────────────────
export async function commentDish(dishId: string, text: string) {
  const user = await getOrCreateFeedUser()
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > 500) return null

  const comment = await prisma.feedComment.create({
    data: { feedUserId: user.id, dishId, text: trimmed },
  })

  // Update comment count in stats
  const count = await prisma.feedComment.count({ where: { dishId } })
  await prisma.feedDishStats.upsert({
    where: { dishId },
    create: { dishId, commentCount: count },
    update: { commentCount: count },
  })

  return comment
}

// ─── Save / unsave dish ────────────────────────────────────────────
export async function saveDish(dishId: string, type: 'ANTOJO' | 'SAVED') {
  const user = await getOrCreateFeedUser()

  await prisma.feedSaved.upsert({
    where: { feedUserId_dishId: { feedUserId: user.id, dishId } },
    create: { feedUserId: user.id, dishId, type },
    update: { type },
  })
}

export async function unsaveDish(dishId: string) {
  const user = await getOrCreateFeedUser()

  await prisma.feedSaved.deleteMany({
    where: { feedUserId: user.id, dishId },
  })
}

// ─── Complete onboarding ───────────────────────────────────────────
export async function completeOnboarding(restrictions: {
  isVegan: boolean
  isVegetarian: boolean
  isGlutenFree: boolean
  isLactoseFree: boolean
}) {
  const user = await getOrCreateFeedUser()

  await prisma.feedUser.update({
    where: { id: user.id },
    data: {
      ...restrictions,
      onboardingDone: true,
    },
  })

  return user.id
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
    RATE_HIGH:   { category: 8,  restaurant: 3  },
    RATE_LOW:    { category: -6, restaurant: -3 },
    COMMENT:     { category: 4,  restaurant: 2  },
  }
  return map[action] ?? null
}

async function updateDishStats(dishId: string, action: FeedAction) {
  const field = {
    VIEW: 'totalViews',
    TAP: 'totalTaps',
    LIKE: 'totalLikes',
    SAVE: 'totalSaves',
    ANTOJO: 'totalAntojos',
    PASS: 'totalPasses',
    SCROLL_BACK: 'totalViews',
  }[action]

  if (!field) return

  // Upsert stats
  await prisma.feedDishStats.upsert({
    where: { dishId },
    create: { dishId, [field]: 1 },
    update: { [field]: { increment: 1 } },
  })

  // Recalculate popularity score
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
}

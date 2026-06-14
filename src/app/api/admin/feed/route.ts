import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  // If userId provided, return detailed user data
  if (userId) {
    const user = await prisma.feedUser.findUnique({
      where: { id: userId },
      select: {
        id: true, fingerprint: true, displayName: true,
        isVegan: true, isVegetarian: true, isGlutenFree: true, isLactoseFree: true,
        categoryScores: true, keywordScores: true, totalInteractions: true,
        onboardingDone: true, lastSeenAt: true, createdAt: true,
        antojoSessionDate: true, antojoDishIds: true, antojoRejectIds: true,
      },
    })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Get interaction timeline
    const interactions = await prisma.feedInteraction.findMany({
      where: { feedUserId: userId },
      select: {
        action: true, category: true, price: true, createdAt: true,
        dish: { select: { name: true, photos: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    // Action counts
    const actionCounts = await prisma.feedInteraction.groupBy({
      by: ['action'],
      where: { feedUserId: userId },
      _count: true,
    })

    // Hourly distribution
    const hourly = await prisma.$queryRawUnsafe<{ hour: number; count: bigint }[]>(`
      SELECT EXTRACT(HOUR FROM "createdAt") as hour, COUNT(*) as count
      FROM "FeedInteraction"
      WHERE "feedUserId" = $1
      GROUP BY hour ORDER BY hour
    `, userId)

    // Category breakdown
    const categoryBreakdown = await prisma.feedInteraction.groupBy({
      by: ['category'],
      where: { feedUserId: userId, action: 'LIKE' },
      _count: true,
      orderBy: { _count: { category: 'desc' } },
      take: 10,
    })

    // Check gustoVector
    let hasGustoVector = false
    try {
      const vr = await prisma.$queryRawUnsafe<{ v: string }[]>(
        `SELECT "gustoVector"::text as v FROM "FeedUser" WHERE id = $1`, userId
      )
      hasGustoVector = !!vr[0]?.v
    } catch {}

    return NextResponse.json({
      user,
      interactions,
      actionCounts: Object.fromEntries(actionCounts.map(a => [a.action, a._count])),
      hourlyDistribution: hourly.map(h => ({ hour: Number(h.hour), count: Number(h.count) })),
      categoryBreakdown: categoryBreakdown.map(c => ({ category: c.category, count: c._count })),
      hasGustoVector,
    })
  }

  // Otherwise: return all users overview
  const users = await prisma.feedUser.findMany({
    where: { onboardingDone: true },
    select: {
      id: true, fingerprint: true, displayName: true,
      totalInteractions: true, lastSeenAt: true, createdAt: true,
      categoryScores: true,
      isVegan: true, isVegetarian: true, isGlutenFree: true,
    },
    orderBy: { lastSeenAt: 'desc' },
  })

  // Get like/pass counts per user in one query
  const actionStats = await prisma.feedInteraction.groupBy({
    by: ['feedUserId', 'action'],
    where: { action: { in: ['LIKE', 'PASS', 'TAP'] } },
    _count: true,
  })

  const statsByUser = new Map<string, Record<string, number>>()
  for (const s of actionStats) {
    if (!statsByUser.has(s.feedUserId)) statsByUser.set(s.feedUserId, {})
    statsByUser.get(s.feedUserId)![s.action] = s._count
  }

  // Global stats
  const totalUsers = users.length
  const activeToday = users.filter(u => u.lastSeenAt && new Date(u.lastSeenAt).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10)).length
  const totalInteractions = await prisma.feedInteraction.count()

  const enrichedUsers = users.map(u => {
    const stats = statsByUser.get(u.id) ?? {}
    const catScores = (u.categoryScores as Record<string, number>) ?? {}
    const topCat = Object.entries(catScores).sort(([, a], [, b]) => b - a)[0]
    return {
      id: u.id,
      fingerprint: u.fingerprint.slice(-6),
      displayName: u.displayName,
      totalInteractions: u.totalInteractions,
      likes: stats.LIKE ?? 0,
      passes: stats.PASS ?? 0,
      taps: stats.TAP ?? 0,
      topCategory: topCat?.[0] ?? null,
      diet: u.isVegan ? 'Vegano' : u.isVegetarian ? 'Vegetariano' : u.isGlutenFree ? 'Sin gluten' : 'Todo',
      lastSeenAt: u.lastSeenAt,
      createdAt: u.createdAt,
    }
  })

  return NextResponse.json({
    totalUsers,
    activeToday,
    totalInteractions,
    users: enrichedUsers,
  })
}

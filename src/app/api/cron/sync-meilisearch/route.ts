import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMeiliClient, isMeiliConfigured, buildMeiliDoc } from '@/lib/meilisearch'

/**
 * Full Meilisearch re-sync cron.
 * Vercel config: schedule "0 5 * * *" (5 AM UTC daily)
 *
 * Fetches all dishes in batches and upserts to Meilisearch.
 * This is a safety net — event-driven syncs handle real-time updates.
 */
export const maxDuration = 300

const BATCH_SIZE = 500

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isMeiliConfigured()) {
    return NextResponse.json({ skipped: true, reason: 'Meilisearch not configured' })
  }

  const start = Date.now()
  let totalIndexed = 0
  let totalErrors = 0

  try {
    const client = getMeiliClient()
    const index = client.index('dishes')

    // Fetch stats map once
    const statsRows = await prisma.feedDishStats.findMany({
      select: { dishId: true, avgRating: true, ratingCount: true, commentCount: true, popularityScore: true },
    })
    const statsMap = new Map(statsRows.map(s => [s.dishId, s]))

    let cursor: string | undefined = undefined

    while (true) {
      const rows: Array<{ id: string } & Record<string, unknown>> = await prisma.dish.findMany({
        take: BATCH_SIZE,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { id: 'asc' },
        include: {
          category: { select: { name: true, dishType: true, cuisineTag: true, normOverride: true } },
          restaurant: {
            select: {
              id: true, name: true, slug: true, logoUrl: true, address: true,
              lat: true, lng: true, primaryCategory: true, isShowcase: true,
              googleRating: true, googleRatingCount: true, googleMapsUrl: true,
              googlePlaceId: true, phone: true, website: true, websiteIsOrderUrl: true,
              cartaProvider: true, instagram: true, isActive: true, isDemo: true,
            },
          },
        },
      })

      if (rows.length === 0) break

      const docs = rows.map((row: any) => {
        const stats = statsMap.get(row.id) ?? null
        return buildMeiliDoc(row, row.category, row.restaurant, stats)
      })

      try {
        await index.addDocuments(docs)
        totalIndexed += docs.length
      } catch (err) {
        console.error('[sync-meilisearch] batch error', err)
        totalErrors += docs.length
      }

      cursor = rows[rows.length - 1]?.id
      if (rows.length < BATCH_SIZE) break
    }

    const elapsed = Date.now() - start
    console.log(`[sync-meilisearch] Done: ${totalIndexed} indexed, ${totalErrors} errors, ${elapsed}ms`)

    return NextResponse.json({ ok: true, totalIndexed, totalErrors, elapsed })
  } catch (err) {
    console.error('[sync-meilisearch] fatal error', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}

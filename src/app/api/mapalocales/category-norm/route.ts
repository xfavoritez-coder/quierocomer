import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST — guardar normOverride en una o varias categorías
// body: { mappings: { restaurantSlug: string, categoryName: string, norm: string }[] }
export async function POST(req: NextRequest) {
  const { mappings } = await req.json() as {
    mappings: { restaurantSlug: string; categoryName: string; norm: string }[]
  }

  if (!mappings?.length) return NextResponse.json({ error: 'Missing mappings' }, { status: 400 })

  const results = await Promise.all(
    mappings.map(async ({ restaurantSlug, categoryName, norm }) => {
      const updated = await prisma.category.updateMany({
        where: {
          restaurant: { slug: restaurantSlug },
          name: categoryName,
        },
        data: { normOverride: norm || null },
      })
      return { categoryName, norm, updated: updated.count }
    })
  )

  return NextResponse.json({ ok: true, results })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ fotos: [] })

  const dishes = await prisma.dish.findMany({
    where: {
      restaurantId: id,
      isActive: true,
      deletedAt: null,
      photos: { isEmpty: false },
    },
    select: { photos: true },
    take: 6,
  })

  const fotos = dishes.map((d) => d.photos[0]).filter(Boolean) as string[]

  return NextResponse.json({ fotos }, {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60' },
  })
}

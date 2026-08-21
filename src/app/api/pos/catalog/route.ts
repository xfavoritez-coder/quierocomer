import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) {
    return NextResponse.json({ error: 'restaurantId required' }, { status: 400 })
  }

  const categories = await prisma.category.findMany({
    where: { restaurantId, isActive: true },
    orderBy: { position: 'asc' },
    select: { id: true, name: true, position: true },
  })

  const dishes = await prisma.dish.findMany({
    where: {
      restaurantId,
      isActive: true,
      deletedAt: null,
    },
    orderBy: { position: 'asc' },
    select: {
      id: true,
      categoryId: true,
      name: true,
      description: true,
      price: true,
      discountPrice: true,
      photos: true,
      position: true,
      modifierTemplates: {
        select: {
          id: true,
          name: true,
          groups: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              name: true,
              required: true,
              minSelect: true,
              maxSelect: true,
              options: {
                where: { isHidden: false },
                orderBy: { position: 'asc' },
                select: {
                  id: true,
                  name: true,
                  priceAdjustment: true,
                  isDefault: true,
                },
              },
            },
          },
        },
      },
    },
  })

  // Filter dishes to only include those in active categories
  const activeCatIds = new Set(categories.map(c => c.id))
  const filteredDishes = dishes.filter(d => activeCatIds.has(d.categoryId))

  return NextResponse.json({ categories, dishes: filteredDishes })
}

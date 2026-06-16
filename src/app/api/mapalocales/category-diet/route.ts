import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST — marcar todos los platos de una categoría como VEGAN o VEGETARIAN
// body: { mappings: { restaurantSlug: string, categoryName: string, diet: 'VEGAN' | 'VEGETARIAN' }[] }
export async function POST(req: NextRequest) {
  const { mappings } = await req.json() as {
    mappings: { restaurantSlug: string; categoryName: string; diet: 'VEGAN' | 'VEGETARIAN' }[]
  }

  if (!mappings?.length) return NextResponse.json({ error: 'Missing mappings' }, { status: 400 })

  const results = await Promise.all(
    mappings.map(async ({ restaurantSlug, categoryName, diet }) => {
      // Find the category
      const category = await prisma.category.findFirst({
        where: { restaurant: { slug: restaurantSlug }, name: categoryName },
        select: { id: true },
      })
      if (!category) return { categoryName, diet, updated: 0 }

      const updated = await prisma.dish.updateMany({
        where: { categoryId: category.id },
        data: { dishDiet: diet },
      })
      return { categoryName, diet, updated: updated.count }
    })
  )

  return NextResponse.json({ ok: true, results })
}

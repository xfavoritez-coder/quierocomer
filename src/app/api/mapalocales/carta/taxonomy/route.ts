import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { classifyDishes, type DishTaxonomyInput } from '@/lib/taxonomy-classify'

export const maxDuration = 60

/**
 * POST /api/mapalocales/carta/taxonomy
 * Body: { slug: string }
 * Clasifica todos los platos del restaurante con la taxonomía AI y guarda.
 */
export async function POST(req: NextRequest) {
  try {
    const { slug } = await req.json()
    if (!slug) return NextResponse.json({ error: 'slug requerido' }, { status: 400 })

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!restaurant) return NextResponse.json({ error: 'Restaurante no encontrado' }, { status: 404 })

    const dishes = await prisma.dish.findMany({
      where: { restaurantId: restaurant.id, deletedAt: null, isActive: true },
      select: {
        id: true, name: true, description: true,
        category: { select: { name: true } },
      },
    })

    if (dishes.length === 0) return NextResponse.json({ classified: 0 })

    const inputs: DishTaxonomyInput[] = dishes.map(d => ({
      id: d.id,
      name: d.name,
      description: d.description,
      category: d.category.name,
    }))

    // Batch in groups of 50
    const BATCH = 50
    let classified = 0
    for (let i = 0; i < inputs.length; i += BATCH) {
      const batch = inputs.slice(i, i + BATCH)
      const taxonomy = await classifyDishes(batch)
      await Promise.all(
        Object.entries(taxonomy).map(([dishId, dims]) =>
          prisma.dish.update({
            where: { id: dishId },
            data: {
              txDishType:   dims.dishType        ?? [],
              txCuisine:    dims.cuisine         ?? [],
              txMealSlot:   dims.mealSlot        ?? [],
              txIngredient: dims.mainIngredient  ?? [],
              txEstilo:     dims.estilo          ?? [],
              ...(dims.flavor?.length ? { flavorTags: dims.flavor } : {}),
            },
          })
        )
      )
      classified += Object.keys(taxonomy).length
    }

    return NextResponse.json({ classified, total: dishes.length })
  } catch (e: any) {
    console.error('[taxonomy route]', e)
    return NextResponse.json({ error: e.message ?? 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/mapalocales/carta/taxonomy
 * Body: { overrides: Array<{ dishId, txDishType, txCuisine, txMealSlot, txIngredient, txEstilo, diet }> }
 * Guarda ediciones manuales de taxonomía plato por plato.
 */
export async function PATCH(req: NextRequest) {
  try {
    const { overrides } = await req.json()
    if (!Array.isArray(overrides) || overrides.length === 0) {
      return NextResponse.json({ error: 'overrides requerido' }, { status: 400 })
    }

    await Promise.all(
      overrides.map((o: any) =>
        prisma.dish.update({
          where: { id: o.dishId },
          data: {
            ...(o.txDishType   !== undefined ? { txDishType:   o.txDishType   } : {}),
            ...(o.txCuisine    !== undefined ? { txCuisine:    o.txCuisine    } : {}),
            ...(o.txMealSlot   !== undefined ? { txMealSlot:   o.txMealSlot   } : {}),
            ...(o.txIngredient !== undefined ? { txIngredient: o.txIngredient } : {}),
            ...(o.txEstilo     !== undefined ? { txEstilo:     o.txEstilo     } : {}),
            ...(o.flavorTags   !== undefined ? { flavorTags:   o.flavorTags   } : {}),
            ...(o.diet         !== undefined ? { dishDiet:     o.diet         } : {}),
          },
        })
      )
    )

    return NextResponse.json({ saved: overrides.length })
  } catch (e: any) {
    console.error('[taxonomy PATCH]', e)
    return NextResponse.json({ error: e.message ?? 'Error interno' }, { status: 500 })
  }
}

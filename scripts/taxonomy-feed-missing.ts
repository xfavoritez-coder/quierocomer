/**
 * Clasifica solo los platos del feed que tienen txDishType vacío.
 * Más rápido que re-correr taxonomy-bulk.ts completo.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { classifyDishesBatched, type DishTaxonomyInput } from '../src/lib/taxonomy-classify'

const prisma = new PrismaClient()

async function main() {
  // Traer solo los platos del feed sin txDishType, agrupados por restaurante
  const dishes = await prisma.$queryRaw<{
    id: string; name: string; description: string | null;
    categoryName: string; restaurantId: string; restaurantName: string;
  }[]>`
    SELECT d.id, d.name, d.description, c.name AS "categoryName",
           r.id AS "restaurantId", r.name AS "restaurantName"
    FROM "Dish" d
    JOIN "Category" c ON c.id = d."categoryId"
    JOIN "Restaurant" r ON r.id = d."restaurantId"
    WHERE d."isActive" = true
      AND d."deletedAt" IS NULL
      AND d."hiddenFromFeed" = false
      AND array_length(d.photos, 1) > 0
      AND (d.price > 0 OR r."isShowcase" = true)
      AND c."dishType" != 'drink'
      AND r."isActive" = true
      AND r."isDemo" = false
      AND r.lat IS NOT NULL
      AND r.lng IS NOT NULL
      AND (r."googleMapsUrl" IS NOT NULL OR r."isShowcase" = true)
      AND (r."googleRating" IS NOT NULL OR r."isShowcase" = true)
      AND (d."txDishType" = '{}' OR d."txDishType" IS NULL)
    ORDER BY r.name, d.name
  `

  // Agrupar por restaurante
  const byRestaurant = new Map<string, { name: string; dishes: typeof dishes }>()
  for (const d of dishes) {
    if (!byRestaurant.has(d.restaurantId)) {
      byRestaurant.set(d.restaurantId, { name: d.restaurantName, dishes: [] })
    }
    byRestaurant.get(d.restaurantId)!.dishes.push(d)
  }

  console.log(`${dishes.length} platos sin txDishType en ${byRestaurant.size} restaurantes\n${'─'.repeat(60)}`)

  let totalOk = 0, totalFailed = 0
  const startTime = Date.now()
  let i = 0

  for (const [, { name, dishes: rDishes }] of byRestaurant) {
    i++
    const pct = Math.round((i / byRestaurant.size) * 100)
    process.stdout.write(`[${i}/${byRestaurant.size}] ${name.slice(0, 42).padEnd(42)} ${rDishes.length} platos... `)

    try {
      const inputs: DishTaxonomyInput[] = rDishes.map(d => ({
        id: d.id, name: d.name, description: d.description, category: d.categoryName,
      }))

      const taxonomy = await classifyDishesBatched(inputs, 30, 2, name)

      await prisma.$transaction(
        Object.entries(taxonomy).map(([dishId, dims]) =>
          prisma.dish.update({
            where: { id: dishId },
            data: {
              txDishType:   dims.dishType       ?? [],
              txCuisine:    dims.cuisine        ?? [],
              txMealSlot:   dims.mealSlot       ?? [],
              txIngredient: dims.mainIngredient ?? [],
              txEstilo:     dims.estilo         ?? [],
              dishDiet:     dims.diet,
              ...(dims.flavor?.length ? { flavorTags: dims.flavor } : {}),
            },
          })
        )
      )

      console.log(`✓ ${Object.keys(taxonomy).length} clasificados`)
      totalOk += Object.keys(taxonomy).length
    } catch (e: any) {
      console.log(`✗ ${e.message?.slice(0, 50)}`)
      totalFailed++
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`✓ ${totalOk} clasificados | ✗ ${totalFailed} restaurantes fallidos | ${elapsed}s`)
}

main().catch(console.error).finally(() => prisma.$disconnect())

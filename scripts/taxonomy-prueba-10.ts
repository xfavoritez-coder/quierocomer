import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { classifyDishesBatched, type DishTaxonomyInput } from '../src/lib/taxonomy-classify'

const prisma = new PrismaClient()

// 10 restaurantes de categorías distintas para revisar antes del bulk
const SLUGS_PRUEBA = [
  'la-barra-del-sandwich',   // sándwiches chilenos (mechada, as, completo)
  'vegan-bunker',            // vegan
  'sushinikkei17',           // sushi/nikkei
  'delirio',                 // pastelería/postres
  'rustik-coffee',           // café/desayuno
  'pollos-en-llamas',        // pollo
  'empanadazo',              // empanadas
  'kantu',                   // peruana
  'gaman-asian-food',        // asiática
  'la-local-pizza',          // pizza
]

async function classifyRestaurant(slug: string) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true },
  })
  if (!restaurant) { console.log(`  ✗ No encontrado: ${slug}`); return null }

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id, deletedAt: null, isActive: true },
    select: { id: true, name: true, description: true, category: { select: { name: true } } },
  })
  if (dishes.length === 0) { console.log(`  ✗ Sin platos: ${slug}`); return null }

  const inputs: DishTaxonomyInput[] = dishes.map(d => ({
    id: d.id, name: d.name, description: d.description, category: d.category.name,
  }))

  const taxonomy = await classifyDishesBatched(inputs, 30, 2, restaurant.name)
  const validIds = new Set(dishes.map(d => d.id))
  const validEntries = Object.entries(taxonomy).filter(([id]) => validIds.has(id))

  await prisma.$transaction(
    validEntries.map(([dishId, dims]) =>
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

  // Resumen rápido
  const dietCount = { OMNIVORE: 0, VEGETARIAN: 0, VEGAN: 0 }
  const typeCount: Record<string, number> = {}
  for (const t of Object.values(taxonomy)) {
    dietCount[t.diet] = (dietCount[t.diet] || 0) + 1
    for (const dt of t.dishType) typeCount[dt] = (typeCount[dt] || 0) + 1
  }
  const topTypes = Object.entries(typeCount).sort((a,b) => b[1]-a[1]).slice(0,5).map(([k,v]) => `${k}(${v})`).join(', ')

  console.log(`  ✓ ${restaurant.name} — ${dishes.length} platos`)
  console.log(`    Diet: O:${dietCount.OMNIVORE} VG:${dietCount.VEGETARIAN} V:${dietCount.VEGAN}`)
  console.log(`    Tipos top: ${topTypes}`)
  return restaurant.name
}

async function main() {
  console.log(`Probando taxonomía en ${SLUGS_PRUEBA.length} restaurantes...\n`)
  for (const slug of SLUGS_PRUEBA) {
    console.log(`→ ${slug}`)
    try {
      await classifyRestaurant(slug)
    } catch (e: any) {
      console.log(`  ✗ Error: ${e.message}`)
    }
  }
  console.log('\n✓ Prueba terminada. Revisa los resultados en el panel antes de continuar.')
}

main().catch(console.error).finally(() => prisma.$disconnect())

import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { classifyDishesBatched, type DishTaxonomyInput } from '../src/lib/taxonomy-classify'

const prisma = new PrismaClient()

const SLUGS = [
  'kantu',
  'mr-sabroso-restaurant',
  'restaurante-el-sabroson-comida-peruana',
  'rocoto-cusqueno-gastronomia-peruana-vegana',
  'calendula-restaurante-peruano-brunch-y-cafe-en-barrio-italia',
  'restobar-la-picada-de-any',
  'la-picada-del-pa-vito',
  'la-fonda-paisa-restaurante',
]

async function main() {
  for (const slug of SLUGS) {
    const r = await prisma.restaurant.findUnique({ where: { slug }, select: { id: true, name: true } })
    if (!r) { console.log(`✗ No encontrado: ${slug}`); continue }

    const dishes = await prisma.dish.findMany({
      where: { restaurantId: r.id, isActive: true, deletedAt: null, photos: { isEmpty: false } },
      select: { id: true, name: true, description: true, category: { select: { name: true } } },
    })
    if (!dishes.length) { console.log(`— Sin platos: ${r.name}`); continue }

    process.stdout.write(`→ ${r.name} (${dishes.length} platos)... `)
    const inputs: DishTaxonomyInput[] = dishes.map(d => ({
      id: d.id, name: d.name, description: d.description, category: d.category.name,
    }))

    const taxonomy = await classifyDishesBatched(inputs, 30, 2, r.name)
    await prisma.$transaction(
      Object.entries(taxonomy).map(([dishId, dims]) =>
        prisma.dish.updateMany({
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

    // Mostrar causas encontradas
    const causas = Object.entries(taxonomy).filter(([,t]) => t.dishType.includes('causa'))
    const dish_names = dishes.reduce((m, d) => { m[d.id] = d.name; return m }, {} as Record<string,string>)
    console.log(`✓`)
    if (causas.length) console.log(`   Causas: ${causas.map(([id]) => dish_names[id]).join(', ')}`)
  }
  console.log('\nListo.')
}

main().catch(console.error).finally(() => prisma.$disconnect())

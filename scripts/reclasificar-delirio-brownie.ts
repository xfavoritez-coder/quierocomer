import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()

import { PrismaClient } from '@prisma/client'
import { classifyDishesBatched } from '../src/lib/taxonomy-classify'

const prisma = new PrismaClient()

async function main() {
  const restaurant = await prisma.restaurant.findFirst({
    where: { name: { contains: 'delirio', mode: 'insensitive' } },
    select: { id: true, name: true, slug: true },
  })
  if (!restaurant) { console.error('No se encontró Delirio'); process.exit(1) }
  console.log(`Restaurante: ${restaurant.name} (${restaurant.slug})`)

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id, isActive: true, deletedAt: null },
    select: { id: true, name: true, description: true, category: { select: { name: true } } },
  })
  console.log(`Platos a reclasificar: ${dishes.length}`)

  const input = dishes.map(d => ({
    id: d.id,
    name: d.name,
    description: d.description ?? '',
    category: d.category?.name ?? '',
  }))

  const results = await classifyDishesBatched(input, 30, 4)

  for (const [id, tax] of Object.entries(results)) {
    const dish = dishes.find(d => d.id === id)
    console.log(`  ${dish?.name} → [${tax.dishType.join(', ') || 'ninguno'}] | ${tax.mealSlot.join('+')} | ${tax.diet}`)
    await prisma.dish.update({
      where: { id },
      data: {
        txDishType:   tax.dishType       ?? [],
        txCuisine:    tax.cuisine        ?? [],
        txMealSlot:   tax.mealSlot       ?? [],
        txIngredient: tax.mainIngredient ?? [],
        txEstilo:     tax.estilo         ?? [],
        ...(tax.flavor?.length ? { flavorTags: tax.flavor } : {}),
        dishDiet: tax.diet,
      },
    })
  }
  console.log('Listo.')
}

main().catch(console.error).finally(() => prisma.$disconnect())

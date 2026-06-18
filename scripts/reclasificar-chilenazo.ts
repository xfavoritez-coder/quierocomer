/**
 * Reclasifica todos los platos de Chilenazo con la taxonomía actualizada.
 * Corrige cortes de carne mal clasificados como "churrasco".
 * Uso: npx tsx scripts/reclasificar-chilenazo.ts
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()

import { PrismaClient } from '@prisma/client'
import { classifyDishesBatched } from '../src/lib/taxonomy-classify'

const prisma = new PrismaClient()

async function main() {
  const restaurant = await prisma.restaurant.findFirst({
    where: { name: { contains: 'chilenazo', mode: 'insensitive' } },
    select: { id: true, name: true, slug: true },
  })
  if (!restaurant) {
    console.error('No se encontró Chilenazo')
    process.exit(1)
  }
  console.log(`Restaurante: ${restaurant.name} (${restaurant.slug})`)

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id, isActive: true, deletedAt: null },
    select: { id: true, name: true, description: true, category: { select: { name: true } } },
  })
  console.log(`Platos a clasificar: ${dishes.length}`)

  const input = dishes.map(d => ({
    id: d.id,
    name: d.name,
    description: d.description ?? '',
    category: d.category?.name ?? '',
  }))

  console.log('Clasificando con Claude...')
  const results = await classifyDishesBatched(input, 30, 4)

  let updated = 0
  for (const [id, tax] of Object.entries(results)) {
    await prisma.dish.update({
      where: { id },
      data: {
        txDishType:   tax.dishType        ?? [],
        txCuisine:    tax.cuisine         ?? [],
        txMealSlot:   tax.mealSlot        ?? [],
        txIngredient: tax.mainIngredient  ?? [],
        txEstilo:     tax.estilo          ?? [],
        ...(tax.flavor?.length ? { flavorTags: tax.flavor } : {}),
        dishDiet: tax.diet,
      },
    })
    updated++
  }

  console.log(`\nActualizados: ${updated} platos`)
  console.log('\nResumen:')
  for (const d of dishes) {
    const tax = results[d.id]
    if (tax) {
      console.log(`  ${d.name} → [${tax.dishType.join(', ') || 'ninguno'}]`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())

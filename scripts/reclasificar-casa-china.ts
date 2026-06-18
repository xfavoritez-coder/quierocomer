/**
 * Reclasifica todos los platos de Casa China con la taxonomía actualizada.
 * Incluye el nuevo tipo "chapsui" para salteados chino-chilenos.
 * Uso: npx tsx scripts/reclasificar-casa-china.ts
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()

import { PrismaClient } from '@prisma/client'
import { classifyDishesBatched } from '../src/lib/taxonomy-classify'

const prisma = new PrismaClient()

async function main() {
  const restaurant = await prisma.restaurant.findFirst({
    where: { name: { contains: 'china', mode: 'insensitive' } },
    select: { id: true, name: true, slug: true },
  })
  if (!restaurant) {
    console.error('No se encontró el restaurante Casa China')
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

  // Mostrar resumen de los platos clave
  const sample = ['chapsui', 'mongolian', 'china', 'a la china', 'chitén', 'wanton', 'pollo', 'diente']
  console.log('\nResumen de platos clave:')
  for (const keyword of sample) {
    const matching = dishes.filter(d => d.name.toLowerCase().includes(keyword))
    for (const d of matching) {
      const tax = results[d.id]
      if (tax) {
        console.log(`  ${d.name} [${d.category?.name}]`)
        console.log(`    dishType:    ${tax.dishType.join(', ') || '(vacío)'}`)
        console.log(`    cuisine:     ${tax.cuisine.join(', ') || '(vacío)'}`)
        console.log(`    ingredients: ${tax.mainIngredient.join(', ') || '(vacío)'}`)
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())

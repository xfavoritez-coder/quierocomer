import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { classifyDishesBatched, type DishTaxonomyInput } from '../src/lib/taxonomy-classify'

const prisma = new PrismaClient()

async function main() {
  const restaurant = await prisma.restaurant.findFirst({
    where: { name: { contains: 'barra del sandwich', mode: 'insensitive' } },
    select: { id: true, name: true },
  })
  if (!restaurant) { console.error('Restaurante no encontrado'); return }
  console.log('Restaurante:', restaurant.name)

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id, deletedAt: null, isActive: true },
    select: {
      id: true, name: true, description: true,
      category: { select: { name: true } },
    },
  })
  console.log(`${dishes.length} platos a reclasificar`)

  const inputs: DishTaxonomyInput[] = dishes.map(d => ({
    id: d.id,
    name: d.name,
    description: d.description,
    category: d.category.name,
  }))

  const taxonomy = await classifyDishesBatched(inputs, 30, 2, restaurant.name)

  await prisma.$transaction(
    Object.entries(taxonomy).map(([dishId, dims]) =>
      prisma.dish.update({
        where: { id: dishId },
        data: {
          txDishType:   dims.dishType        ?? [],
          txCuisine:    dims.cuisine         ?? [],
          txMealSlot:   dims.mealSlot        ?? [],
          txIngredient: dims.mainIngredient  ?? [],
          txEstilo:     dims.estilo          ?? [],
          dishDiet:     dims.diet,
          ...(dims.flavor?.length ? { flavorTags: dims.flavor } : {}),
        },
      })
    )
  )

  console.log(`✓ ${Object.keys(taxonomy).length} platos reclasificados`)

  // Verificar vienesas
  const vienesas = dishes.filter(d => /vienesa/i.test(d.name))
  console.log('\nVienesas encontradas:')
  for (const v of vienesas) {
    const t = taxonomy[v.id]
    console.log(` - ${v.name} → ${t?.dishType?.join(',')} | ${t?.diet}`)
  }

  // Verificar mechadas
  const mechadas = dishes.filter(d => /mechada/i.test(d.name))
  console.log('\nMechadas encontradas:')
  for (const m of mechadas) {
    const t = taxonomy[m.id]
    console.log(` - ${m.name} → ${t?.dishType?.join(',')} | ${t?.diet}`)
  }

  // Verificar "as "
  const as_ = dishes.filter(d => /^as\s/i.test(d.name))
  console.log('\n"As" encontrados:')
  for (const a of as_) {
    const t = taxonomy[a.id]
    console.log(` - ${a.name} → ${t?.dishType?.join(',')} | ${t?.diet}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())

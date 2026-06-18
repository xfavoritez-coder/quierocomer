import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { classifyDishesBatched, type DishTaxonomyInput } from '../src/lib/taxonomy-classify'
import * as fs from 'fs'

const prisma = new PrismaClient()
const PROGRESS_FILE = './scripts/taxonomy-bulk-progress.json'

function loadProgress(): Set<string> {
  try {
    const data = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'))
    return new Set(data.done)
  } catch { return new Set() }
}

function saveProgress(done: Set<string>) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({ done: [...done], updatedAt: new Date().toISOString() }))
}

async function classifyRestaurant(id: string, name: string): Promise<{ ok: boolean; count: number; error?: string }> {
  const dishes = await prisma.dish.findMany({
    where: { restaurantId: id, deletedAt: null, isActive: true },
    select: { id: true, name: true, description: true, category: { select: { name: true } } },
  })
  if (dishes.length === 0) return { ok: true, count: 0 }

  const inputs: DishTaxonomyInput[] = dishes.map(d => ({
    id: d.id, name: d.name, description: d.description, category: d.category.name,
  }))

  const taxonomy = await classifyDishesBatched(inputs, 30, 2, name)

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

  return { ok: true, count: Object.keys(taxonomy).length }
}

async function main() {
  const restaurants = await prisma.restaurant.findMany({
    where: {
      isActive: true,
      isDemo: false,
      lat: { not: null },
      lng: { not: null },
      OR: [
        { googleMapsUrl: { not: null }, googleRating: { not: null } },
        { isShowcase: true },
      ],
    },
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  })

  const done = loadProgress()
  const pending = restaurants.filter(r => !done.has(r.slug))

  console.log(`Total: ${restaurants.length} | Ya procesados: ${done.size} | Pendientes: ${pending.length}`)
  console.log('─'.repeat(60))

  let ok = 0, skipped = 0, failed = 0
  const startTime = Date.now()

  for (let i = 0; i < pending.length; i++) {
    const r = pending[i]
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    const eta = i > 0 ? Math.round((elapsed / i) * (pending.length - i)) : '?'
    process.stdout.write(`[${i + 1}/${pending.length}] ${r.name.slice(0, 40).padEnd(40)} `)

    try {
      const res = await classifyRestaurant(r.id, r.name)
      if (res.count === 0) {
        console.log(`— sin platos`)
        skipped++
      } else {
        console.log(`✓ ${res.count} platos (${elapsed}s transcurridos, ETA ~${eta}s)`)
        ok++
      }
      done.add(r.slug)
      saveProgress(done)
    } catch (e: any) {
      console.log(`✗ ${e.message?.slice(0, 60)}`)
      failed++
      // No marcamos como done para poder reintentar
    }
  }

  const total = Math.round((Date.now() - startTime) / 1000)
  console.log('\n' + '─'.repeat(60))
  console.log(`✓ ${ok} ok | ${skipped} sin platos | ${failed} errores | ${total}s total`)
  if (failed > 0) console.log('Vuelve a correr el script para reintentar los fallidos.')
}

main().catch(console.error).finally(() => prisma.$disconnect())

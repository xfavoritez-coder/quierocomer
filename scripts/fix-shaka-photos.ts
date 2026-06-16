import { config } from 'dotenv'
config({ path: '.env.local' })
import { prisma } from '../src/lib/prisma'

async function main() {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: 'shaka-burger' },
    select: { id: true }
  })
  if (!restaurant) { console.log('No encontrado'); return }

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id },
    select: { id: true, name: true, photos: true }
  })

  const withPhotos = dishes.filter(d => d.photos.length > 0)
  console.log(`${dishes.length} platos total, ${withPhotos.length} con fotos`)

  let broken = 0
  const brokenIds: string[] = []

  for (const dish of withPhotos) {
    const url = dish.photos[0]
    try {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
      if (!res.ok) {
        brokenIds.push(dish.id)
        broken++
        if (broken <= 3) console.log(`✗ ${dish.name}: ${res.status}`)
      }
    } catch {
      brokenIds.push(dish.id)
      broken++
      if (broken <= 3) console.log(`✗ ${dish.name}: sin respuesta`)
    }
  }

  console.log(`\n${broken} imágenes rotas de ${withPhotos.length}`)

  if (brokenIds.length > 0) {
    await prisma.dish.updateMany({
      where: { id: { in: brokenIds } },
      data: { photos: [] }
    })
    console.log(`✓ Limpiadas ${brokenIds.length} imágenes rotas`)
  }

  await prisma.$disconnect()
}

main()

import { config } from 'dotenv'
config({ path: '.env.local' })
import { importFromProspecto } from '../src/lib/extractors/pipeline'
import { prisma } from '../src/lib/prisma'
import { randomUUID } from 'crypto'

async function main() {
  let prospecto = await prisma.mapaProspecto.findFirst({ where: { name: { contains: 'Zocalo' } } })
  if (!prospecto) {
    prospecto = await prisma.mapaProspecto.create({
      data: {
        id: randomUUID(),
        name: 'El Zocalo',
        address: 'Providencia, Región Metropolitana',
        lat: -33.4352771,
        lng: -70.6274337,
        mapsUrl: 'https://maps.app.goo.gl/N8ou6Fu2k4E5vStG7',
        cartaUrl: 'https://www.elzocalo.cl/pedir',
        provider: 'Justo',
      }
    })
  }

  console.log('Importando El Zocalo...')
  const result = await importFromProspecto({
    prospectoId: prospecto.id,
    name: 'El Zocalo',
    address: 'Providencia, Región Metropolitana',
    lat: -33.4352771,
    lng: -70.6274337,
    mapsUrl: 'https://maps.app.goo.gl/N8ou6Fu2k4E5vStG7',
    cartaUrl: 'https://www.elzocalo.cl/pedir',
    providerName: 'Justo',
  })

  console.log('✓ Importado:', JSON.stringify(result))

  // Ver categorías creadas
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: result.slug },
    select: { categories: { select: { name: true, _count: { select: { dishes: true } } }, orderBy: { position: 'asc' } } }
  })
  console.log('\nCategorías:')
  for (const cat of restaurant?.categories ?? []) {
    console.log(`  - ${cat.name} (${cat._count.dishes} platos)`)
  }

  await prisma.$disconnect()
}

main().catch(async e => {
  console.error('✗ ERROR:', e.message)
  await prisma.$disconnect()
  process.exit(1)
})

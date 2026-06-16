import { config } from 'dotenv'
config({ path: '.env.local' })
import { importFromProspecto } from '../src/lib/extractors/pipeline'
import { prisma } from '../src/lib/prisma'
import { randomUUID } from 'crypto'

async function main() {
  const NAME = 'El Bajón Express'
  const LAT = -33.5554988
  const LNG = -70.576649
  const MAPS_URL = 'https://maps.app.goo.gl/yzuaBdeTS5vEzfAYA'
  const CARTA_URL = 'https://www.rappi.cl/restaurantes/900111529-el-bajon-express'

  let prospecto = await prisma.mapaProspecto.findFirst({ where: { name: { contains: 'Bajón' } } })
  if (!prospecto) {
    prospecto = await prisma.mapaProspecto.create({
      data: {
        id: randomUUID(),
        name: NAME,
        address: 'La Cisterna, Región Metropolitana',
        lat: LAT,
        lng: LNG,
        mapsUrl: MAPS_URL,
        cartaUrl: CARTA_URL,
        provider: 'Rappi',
      },
    })
  }

  console.log(`Importando ${NAME}...`)
  const result = await importFromProspecto({
    prospectoId: prospecto.id,
    name: NAME,
    address: 'La Cisterna, Región Metropolitana',
    lat: LAT,
    lng: LNG,
    mapsUrl: MAPS_URL,
    cartaUrl: CARTA_URL,
    providerName: 'Rappi',
  })

  console.log('✓ Importado:', JSON.stringify(result))

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: result.slug },
    select: { categories: { select: { name: true, _count: { select: { dishes: true } } }, orderBy: { position: 'asc' } } },
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

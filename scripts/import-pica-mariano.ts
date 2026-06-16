import { config } from 'dotenv'
config({ path: '.env.local' })
import { importFromProspecto } from '../src/lib/extractors/pipeline'
import { prisma } from '../src/lib/prisma'
import { randomUUID } from 'crypto'

async function main() {
  let prospecto = await prisma.mapaProspecto.findFirst({ where: { name: { contains: 'Mariano' } } })
  if (!prospecto) {
    prospecto = await prisma.mapaProspecto.create({
      data: {
        id: randomUUID(),
        name: 'La Pica del Mariano',
        address: 'Santiago, Región Metropolitana',
        lat: -33.4964448,
        lng: -70.6360709,
        mapsUrl: 'https://maps.app.goo.gl/BM7HkhmLCQEkpi5b8',
        cartaUrl: 'https://www.ubereats.com/cl/store/la-pica-del-mariano/C4hpnr-zWZmuPyy-1RPorw',
        provider: 'UberEats',
      }
    })
  }

  console.log('Importando La Pica del Mariano...')
  const result = await importFromProspecto({
    prospectoId: prospecto.id,
    name: 'La Pica del Mariano',
    address: 'Santiago, Región Metropolitana',
    lat: -33.4964448,
    lng: -70.6360709,
    mapsUrl: 'https://maps.app.goo.gl/BM7HkhmLCQEkpi5b8',
    cartaUrl: 'https://www.ubereats.com/cl/store/la-pica-del-mariano/C4hpnr-zWZmuPyy-1RPorw',
    providerName: 'UberEats',
  })

  console.log('✓ Importado:', JSON.stringify(result))

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

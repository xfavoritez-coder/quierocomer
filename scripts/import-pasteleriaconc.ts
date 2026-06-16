import { config } from 'dotenv'
config({ path: '.env.local' })
import { importFromProspecto } from '../src/lib/extractors/pipeline'
import { prisma } from '../src/lib/prisma'
import { randomUUID } from 'crypto'

async function main() {
  let prospecto = await prisma.mapaProspecto.findFirst({ where: { name: { contains: 'Pasteleria con C' } } })
  if (!prospecto) {
    prospecto = await prisma.mapaProspecto.create({
      data: {
        id: randomUUID(),
        name: 'Pastelería con C',
        address: 'Santiago, Región Metropolitana',
        lat: null,
        lng: null,
        mapsUrl: '',
        cartaUrl: 'https://www.pasteleriaconc.cl/tienda/',
        provider: 'WooCommerce',
      }
    })
  }

  console.log('Importando Pastelería con C...')
  const result = await importFromProspecto({
    prospectoId: prospecto.id,
    name: 'Pastelería con C',
    address: 'Santiago, Región Metropolitana',
    lat: null,
    lng: null,
    mapsUrl: '',
    cartaUrl: 'https://www.pasteleriaconc.cl/tienda/',
    providerName: 'WooCommerce',
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

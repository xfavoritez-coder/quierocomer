import { config } from 'dotenv'
config({ path: '.env.local' })
import { importFromProspecto } from '../src/lib/extractors/pipeline'
import { prisma } from '../src/lib/prisma'
import { randomUUID } from 'crypto'

// Coordenadas de Av. Concha y Toro 3050, Puente Alto
// (obtenidas de Google Maps para Casa China Puente Alto)
const LAT = -33.5905
const LNG = -70.5782
const MAPS_URL = 'https://maps.app.goo.gl/V3MFVS6LyQFfEt8e6y'
const CARTA_URL = 'https://queresto.com/casachinapuentealto'
const NAME = 'Casa China Puente Alto'
const ADDRESS = 'Av. Concha y Toro 3050, Puente Alto, Región Metropolitana'
const SLUG = 'casa-china-puente-alto'

async function main() {
  console.log('=== Importando Casa China Puente Alto ===\n')

  // Verificar si ya existe
  const existing = await prisma.restaurant.findUnique({ where: { slug: SLUG } })
  if (existing) {
    console.log(`Ya existe restaurante con slug "${SLUG}" (id: ${existing.id}) — se va a reimportar`)
  }

  // Buscar o crear MapaProspecto
  let prospecto = await prisma.mapaProspecto.findFirst({
    where: { OR: [{ cartaUrl: CARTA_URL }, { name: { contains: 'Casa China' } }] }
  })

  if (!prospecto) {
    prospecto = await prisma.mapaProspecto.create({
      data: {
        id: randomUUID(),
        name: NAME,
        address: ADDRESS,
        lat: LAT,
        lng: LNG,
        mapsUrl: MAPS_URL,
        cartaUrl: CARTA_URL,
        provider: 'Queresto',
      }
    })
    console.log('MapaProspecto creado:', prospecto.id)
  } else {
    console.log('MapaProspecto existente:', prospecto.id)
  }

  console.log('\nExtrayendo carta y creando restaurante...')
  const result = await importFromProspecto({
    prospectoId: prospecto.id,
    name: NAME,
    address: ADDRESS,
    lat: LAT,
    lng: LNG,
    mapsUrl: MAPS_URL,
    cartaUrl: CARTA_URL,
    providerName: 'Queresto',
  })

  console.log('\n=== RESULTADO ===')
  console.log('Slug:', result.slug)
  console.log('Platos importados:', result.dishCount)

  // Verificar resultado en DB
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: result.slug },
    select: { id: true, name: true, slug: true, plan: true, isActive: true, isDemo: true, menuImported: true, lat: true, lng: true }
  })
  console.log('\nRestaurante en DB:', JSON.stringify(restaurant, null, 2))

  // Contar categorías y listarlas
  const categories = await prisma.category.findMany({
    where: { restaurantId: restaurant!.id },
    select: { name: true, dishType: true, _count: { select: { dishes: true } } },
    orderBy: { position: 'asc' }
  })
  console.log('\nCategorías:')
  for (const cat of categories) {
    console.log(`  [${cat.dishType}] ${cat.name}: ${cat._count.dishes} platos`)
  }

  const totalDishes = await prisma.dish.count({ where: { restaurantId: restaurant!.id } })
  console.log(`\nTotal platos en DB: ${totalDishes}`)
  console.log(`URL: https://quierocomer.com/qr/${result.slug}`)

  await prisma.$disconnect()
}

main().catch(async e => {
  console.error('ERROR:', e.message)
  console.error(e.stack)
  await prisma.$disconnect()
  process.exit(1)
})

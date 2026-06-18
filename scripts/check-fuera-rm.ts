import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Bounding box aproximado de la Región Metropolitana
const RM_LAT_MIN = -34.50
const RM_LAT_MAX = -32.90
const RM_LNG_MIN = -71.80
const RM_LNG_MAX = -70.00

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
    select: { id: true, name: true, address: true, lat: true, lng: true, slug: true },
    orderBy: { name: 'asc' },
  })

  const fueraRM = restaurants.filter(r => {
    const lat = r.lat as number
    const lng = r.lng as number
    return lat < RM_LAT_MIN || lat > RM_LAT_MAX || lng < RM_LNG_MIN || lng > RM_LNG_MAX
  })

  const dentroRM = restaurants.filter(r => {
    const lat = r.lat as number
    const lng = r.lng as number
    return lat >= RM_LAT_MIN && lat <= RM_LAT_MAX && lng >= RM_LNG_MIN && lng <= RM_LNG_MAX
  })

  console.log(`Total en feed: ${restaurants.length}`)
  console.log(`Dentro de RM: ${dentroRM.length}`)
  console.log(`Fuera de RM (o coordenadas sospechosas): ${fueraRM.length}`)

  if (fueraRM.length > 0) {
    console.log('\n--- Restaurantes FUERA de la RM ---')
    for (const r of fueraRM) {
      console.log(`\n  ${r.name}`)
      console.log(`  Dirección: ${r.address}`)
      console.log(`  Coords: ${r.lat}, ${r.lng}`)
      console.log(`  Slug: ${r.slug}`)
    }
  }

  // También mostrar los que tienen direcciones genéricas sospechosas
  const sospechosos = restaurants.filter(r =>
    r.address && (
      /ficticia|fake|test|prueba|sin dirección|dirección|calle\s+\d+$/i.test(r.address) ||
      r.address.trim().length < 10
    )
  )
  if (sospechosos.length > 0) {
    console.log('\n--- Direcciones sospechosas (cortas o palabras clave) ---')
    for (const r of sospechosos) {
      console.log(`  ${r.name} — "${r.address}" (${r.lat}, ${r.lng})`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())

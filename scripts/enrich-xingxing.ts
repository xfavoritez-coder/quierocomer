import { config } from 'dotenv'
config({ path: '.env.local' })
import { prisma } from '../src/lib/prisma'
import { findPlaceInfo } from '../src/lib/google-places'

async function main() {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: 'restaurant-xing-xing' },
    select: { id: true, name: true, address: true, lat: true, lng: true }
  })
  if (!restaurant) { console.log('No encontrado'); return }
  console.log('Restaurante:', restaurant.name)

  // Actualizar dirección
  const address = 'Serrano 720, 8330712 Santiago, Región Metropolitana'

  // Buscar por nombre en Places API (texto) usando centro de Santiago como bias
  // Serrano 720 está en el barrio Yungay, aprox -33.442, -70.659
  const LAT = -33.442
  const LNG = -70.659

  // Actualizar dirección + coordenadas aproximadas (Places lookup las va a refinar)
  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { address, lat: LAT, lng: LNG }
  })

  // Google Places lookup para rating y coordenadas exactas
  const placeInfo = await findPlaceInfo(`${restaurant.name} Serrano Santiago`, LAT, LNG)
  if (placeInfo) {
    console.log('Places:', JSON.stringify(placeInfo))
    await (prisma.restaurant.update as any)({
      where: { id: restaurant.id },
      data: {
        googlePlaceId: placeInfo.placeId,
        googleMapsUrl: placeInfo.mapsUrl,
        googleRating: placeInfo.rating,
        googleRatingCount: placeInfo.ratingCount,
        ...(placeInfo.scheduleJson ? { scheduleJson: placeInfo.scheduleJson } : {}),
      }
    })
    console.log(`✓ Rating: ${placeInfo.rating} (${placeInfo.ratingCount} reseñas)`)
  } else {
    console.log('No se encontró en Google Places')
  }

  await prisma.$disconnect()
}

main().catch(async e => {
  console.error('✗ ERROR:', e.message)
  await prisma.$disconnect()
  process.exit(1)
})

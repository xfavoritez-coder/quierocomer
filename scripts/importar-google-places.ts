import { prisma } from '../src/lib/prisma'
import { findPlaceInfo } from '../src/lib/google-places'

async function main() {
  const restaurants = await prisma.restaurant.findMany({
    where: {
      isActive: true,
      isDemo: false,
      lat: { not: null },
      lng: { not: null },
      googlePlaceId: null,
    },
    select: { id: true, name: true, lat: true, lng: true },
  })

  console.log(`Procesando ${restaurants.length} locales...`)
  let ok = 0, fail = 0

  for (const r of restaurants) {
    await new Promise(res => setTimeout(res, 200))
    const info = await findPlaceInfo(r.name, r.lat!, r.lng!)
    if (!info) {
      console.log(`  ✗ No encontrado: ${r.name}`)
      fail++
      continue
    }
    await prisma.restaurant.update({
      where: { id: r.id },
      data: {
        googlePlaceId: info.placeId,
        googleMapsUrl: info.mapsUrl,
        googleRating: info.rating,
        googleRatingCount: info.ratingCount,
      },
    })
    console.log(`  ✓ ${r.name} — ${info.rating}★ (${info.ratingCount})`)
    ok++
  }

  console.log(`\nListo: ${ok} ok, ${fail} fallidos`)
}

main().catch(console.error).finally(() => prisma.$disconnect())

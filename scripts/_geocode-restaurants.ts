import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL })

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'QuieroComer/1.0' } })
    const data = await res.json()
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
    }
  } catch (e) {
    console.error(`  Error geocoding: ${(e as Error).message}`)
  }
  return null
}

async function main() {
  const restaurants = await prisma.restaurant.findMany({
    where: { isActive: true, isDemo: false, address: { not: null }, lat: null },
    select: { id: true, name: true, slug: true, address: true },
  })

  console.log(`Geocoding ${restaurants.length} restaurants...\n`)
  let success = 0

  for (const r of restaurants) {
    if (!r.address) continue
    console.log(`${r.name}: "${r.address}"`)

    const coords = await geocode(r.address + ', Chile')
    if (coords) {
      await prisma.restaurant.update({
        where: { id: r.id },
        data: { lat: coords.lat, lng: coords.lng },
      })
      console.log(`  ✓ ${coords.lat}, ${coords.lng}`)
      success++
    } else {
      // Try with just the restaurant name + Santiago Chile
      const coords2 = await geocode(r.name + ' Santiago Chile')
      if (coords2) {
        await prisma.restaurant.update({
          where: { id: r.id },
          data: { lat: coords2.lat, lng: coords2.lng },
        })
        console.log(`  ✓ (by name) ${coords2.lat}, ${coords2.lng}`)
        success++
      } else {
        console.log(`  ✗ Not found`)
      }
    }

    // Rate limit: 1 request per second (Nominatim policy)
    await new Promise(resolve => setTimeout(resolve, 1100))
  }

  console.log(`\nDone: ${success}/${restaurants.length} geocoded`)
  await prisma.$disconnect()
}
main()

/**
 * fill-restaurant-phones.ts
 * Busca el teléfono de todos los restaurantes activos en el feed
 * que tienen googlePlaceId pero no tienen phone, y lo guarda en BD.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const API_KEY = process.env.GOOGLE_PLACES_API_KEY!

async function getPhone(placeId: string): Promise<string | null> {
  try {
    // Places API (New)
    const url = `https://places.googleapis.com/v1/places/${placeId}`
    const res = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'nationalPhoneNumber,internationalPhoneNumber',
      },
    })
    if (!res.ok) return null
    const data = await res.json() as { nationalPhoneNumber?: string; internationalPhoneNumber?: string }
    return data.internationalPhoneNumber ?? data.nationalPhoneNumber ?? null
  } catch {
    return null
  }
}

async function main() {
  const restaurants = await prisma.restaurant.findMany({
    where: {
      isActive: true,
      isDemo: false,
      googlePlaceId: { not: null },
      OR: [{ phone: null }, { phone: '' }],
    },
    select: { id: true, name: true, googlePlaceId: true },
  })

  console.log(`Encontrados ${restaurants.length} restaurantes sin teléfono con placeId`)

  let updated = 0
  let notFound = 0

  for (const r of restaurants) {
    const phone = await getPhone(r.googlePlaceId!)
    if (phone) {
      await prisma.restaurant.update({ where: { id: r.id }, data: { phone } })
      console.log(`✓ ${r.name}: ${phone}`)
      updated++
    } else {
      console.log(`✗ ${r.name}: sin teléfono en Places API`)
      notFound++
    }
    // Rate limit: 10 requests/s es el límite de Places API
    await new Promise(r => setTimeout(r, 120))
  }

  console.log(`\nResultado: ${updated} actualizados, ${notFound} sin teléfono`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

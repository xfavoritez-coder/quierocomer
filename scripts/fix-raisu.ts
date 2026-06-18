import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function geocodeAddress(address: string): Promise<{ lat: number, lng: number, formatted: string } | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY no configurada')
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&language=es&key=${key}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== 'OK' || !data.results?.[0]) return null
  const r = data.results[0]
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    formatted: r.formatted_address,
  }
}

async function main() {
  // Geocodificar la dirección correcta de Raisu en Santiago
  const query = 'Ayacucho 352, Santiago, Chile'
  console.log(`Geocodificando: "${query}"...`)
  const geo = await geocodeAddress(query)
  if (!geo) { console.error('No se pudo geocodificar'); return }

  console.log(`Resultado: ${geo.formatted}`)
  console.log(`Coords: ${geo.lat}, ${geo.lng}`)

  await prisma.restaurant.update({
    where: { slug: 'raisu' },
    data: {
      address: geo.formatted,
      lat: geo.lat,
      lng: geo.lng,
    },
  })

  console.log('✓ Raisu actualizado')
}

main().catch(console.error).finally(() => prisma.$disconnect())

/**
 * Re-geocode restaurants using Google Places API (New) — much more precise than Nominatim.
 * Prioritizes googlePlaceId (exact), then falls back to text search.
 *
 * Usage:
 *   npx ts-node -r dotenv/config scripts/_geocode-restaurants.ts           # only missing coords
 *   npx ts-node -r dotenv/config scripts/_geocode-restaurants.ts --all     # all active restaurants
 *   npx ts-node -r dotenv/config scripts/_geocode-restaurants.ts --slug=horus
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL })
const API_KEY = process.env.GOOGLE_PLACES_API_KEY!

interface PlaceResult {
  lat: number
  lng: number
  formattedAddress: string
  placeId?: string
}

/** Lookup by placeId (most accurate — no ambiguity) */
async function getPlaceById(placeId: string): Promise<PlaceResult | null> {
  const url = `https://places.googleapis.com/v1/places/${placeId}`
  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'location,formattedAddress,id',
    },
  })
  if (!res.ok) return null
  const d = await res.json() as any
  if (!d.location) return null
  return {
    lat: d.location.latitude,
    lng: d.location.longitude,
    formattedAddress: d.formattedAddress ?? '',
    placeId: d.id,
  }
}

/** Text search (fallback) */
async function searchPlace(query: string): Promise<PlaceResult | null> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'places.location,places.formattedAddress,places.id',
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'es', regionCode: 'CL' }),
  })
  if (!res.ok) return null
  const d = await res.json() as any
  const place = d.places?.[0]
  if (!place?.location) return null
  return {
    lat: place.location.latitude,
    lng: place.location.longitude,
    formattedAddress: place.formattedAddress ?? '',
    placeId: place.id,
  }
}

async function main() {
  const args = process.argv.slice(2)
  const reAll = args.includes('--all')
  const slugArg = args.find(a => a.startsWith('--slug='))?.split('=')[1]

  const where: any = { isActive: true, isDemo: false }
  if (slugArg) {
    where.slug = slugArg
  } else if (!reAll) {
    where.lat = null
  }

  const restaurants = await prisma.restaurant.findMany({
    where,
    select: { id: true, name: true, slug: true, address: true, lat: true, lng: true, googlePlaceId: true },
    orderBy: { name: 'asc' },
  })

  console.log(`Geocoding ${restaurants.length} restaurants (${reAll ? 'all' : slugArg ? `slug=${slugArg}` : 'missing coords only'})...\n`)
  let updated = 0, unchanged = 0, failed = 0

  for (const r of restaurants) {
    const prevLat = r.lat != null ? Number(r.lat).toFixed(5) : 'null'
    const prevLng = r.lng != null ? Number(r.lng).toFixed(5) : 'null'
    process.stdout.write(`${r.name}: `)

    let coords: PlaceResult | null = null

    // 1. If we have a placeId, use it directly (no ambiguity)
    if (r.googlePlaceId) {
      coords = await getPlaceById(r.googlePlaceId)
      if (coords) process.stdout.write('[by placeId] ')
    }

    // 2. Full address search
    if (!coords && r.address) {
      const query = `${r.name} ${r.address} Chile`
      coords = await searchPlace(query)
      if (coords) process.stdout.write('[by address] ')
    }

    // 3. Name-only fallback
    if (!coords) {
      coords = await searchPlace(`${r.name} restaurante Chile`)
      if (coords) process.stdout.write('[by name] ')
    }

    if (coords) {
      const newLat = coords.lat.toFixed(5)
      const newLng = coords.lng.toFixed(5)
      if (prevLat === newLat && prevLng === newLng) {
        console.log(`SAME (${newLat}, ${newLng})`)
        unchanged++
      } else {
        const updateData: any = { lat: coords.lat, lng: coords.lng }
        // Store placeId if we discovered it via text search and didn't have it
        if (coords.placeId && !r.googlePlaceId) updateData.googlePlaceId = coords.placeId
        await prisma.restaurant.update({ where: { id: r.id }, data: updateData })
        console.log(`(${prevLat},${prevLng}) → (${newLat},${newLng}) — "${coords.formattedAddress}"`)
        updated++
      }
    } else {
      console.log(`FAILED`)
      failed++
    }

    await new Promise(r => setTimeout(r, 100)) // ~10 req/s to be safe
  }

  console.log(`\nDone: ${updated} updated, ${unchanged} unchanged, ${failed} failed`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

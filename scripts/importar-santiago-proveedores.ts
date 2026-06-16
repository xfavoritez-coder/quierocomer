/**
 * Busca restaurantes en comunas de Santiago que usan proveedores conocidos
 * (Fudo, Justo, OlaClick, Queresto, Gourmedia) y los importa a QuieroComer.
 *
 * Estrategia: búsqueda web "site:proveedor.com comuna" para encontrar
 * restaurantes que usan esos proveedores, sin depender de Google Places.
 *
 * Uso: npx ts-node --skip-project scripts/importar-santiago-proveedores.ts
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
})

const COMUNAS = [
  'Ñuñoa', 'Providencia', 'Santiago Centro', 'La Florida',
  'Las Condes', 'Peñalolén', 'Macul',
]

const PROVIDERS = [
  { name: 'Fudo', searchDomain: 'menu.fu.do', urlPattern: /menu\.fu\.do\/([^\/\s"?]+)/g },
  { name: 'Justo', searchDomain: 'pedir.justo.cl', urlPattern: /pedir\.justo\.cl\/([^\/\s"?]+)/g },
  { name: 'OlaClick', searchDomain: 'ola.click', urlPattern: /([a-z0-9-]+)\.ola\.click/g },
  { name: 'Queresto', searchDomain: 'queresto.com', urlPattern: /queresto\.com\/([^\/\s"?]+)/g },
  { name: 'Gourmedia', searchDomain: 'gour.media', urlPattern: /gour\.media\/([^\/\s"?]+)/g },
]

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

const API_KEY = process.env.GOOGLE_PLACES_API_KEY!

type FoundRestaurant = {
  name: string
  menuUrl: string
  provider: string
  comuna: string
  address?: string
  lat?: number
  lng?: number
  phone?: string
}

// Enrich with Google Places: get exact address + lat/lng
async function enrichWithPlaces(restaurant: FoundRestaurant): Promise<FoundRestaurant> {
  if (!API_KEY) return restaurant

  try {
    const query = `${restaurant.name} ${restaurant.comuna} Santiago Chile`
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.formattedAddress,places.location,places.nationalPhoneNumber,places.displayName',
      },
      body: JSON.stringify({ textQuery: query, languageCode: 'es', regionCode: 'CL', maxResultCount: 1 }),
      signal: AbortSignal.timeout(8000),
    })

    const json = await res.json() as any
    const place = json.places?.[0]
    if (place) {
      restaurant.address = place.formattedAddress ?? restaurant.address
      restaurant.lat = place.location?.latitude ?? undefined
      restaurant.lng = place.location?.longitude ?? undefined
      restaurant.phone = place.nationalPhoneNumber ?? undefined
    }
  } catch {}

  return restaurant
}

async function searchProviderInComuna(provider: typeof PROVIDERS[0], comuna: string): Promise<FoundRestaurant[]> {
  const query = `site:${provider.searchDomain} restaurante ${comuna} Santiago Chile`
  const results: FoundRestaurant[] = []

  try {
    const res = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
      headers: { 'Accept': 'text/plain', 'X-No-Cache': 'true' },
      signal: AbortSignal.timeout(15000),
    })
    const text = await res.text()

    // Extract URLs matching the provider pattern
    const urls = new Set<string>()
    const urlRegex = new RegExp(`https?://[^\\s"<>]*${provider.searchDomain.replace('.', '\\.')}[^\\s"<>]*`, 'gi')
    const matches = text.match(urlRegex) || []

    for (const url of matches) {
      // Clean URL
      const clean = url.split(/[)\]}>]/)[0].replace(/[.,;:!?]+$/, '')
      if (clean.includes(provider.searchDomain)) {
        urls.add(clean)
      }
    }

    // Extract restaurant names from URLs/text
    for (const url of urls) {
      // Skip generic pages
      if (url.endsWith('/products') || url.includes('/qr-menu') || url.includes('/sitemap')) continue

      // Try to extract a name from the URL slug
      let name = ''
      const slugMatch = url.match(/\/([a-z0-9%_-]+)\/?$/i) || url.match(/([a-z0-9-]+)\.ola\.click/i)
      if (slugMatch) {
        name = decodeURIComponent(slugMatch[1])
          .replace(/-/g, ' ')
          .replace(/%[0-9a-f]{2}/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .split(' ')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
      }

      if (name && name.length > 2 && name.length < 60) {
        results.push({
          name,
          menuUrl: url,
          provider: provider.name,
          comuna,
        })
      }
    }
  } catch (e: any) {
    console.log(`   ⚠ Error buscando ${provider.name} en ${comuna}: ${e.message}`)
  }

  return results
}

async function main() {
  console.log('🔍 Buscando restaurantes con proveedores conocidos en Santiago...\n')

  const allFound: FoundRestaurant[] = []
  const seenUrls = new Set<string>()

  for (const comuna of COMUNAS) {
    console.log(`📍 ${comuna}`)
    for (const provider of PROVIDERS) {
      process.stdout.write(`   ${provider.name}... `)
      const found = await searchProviderInComuna(provider, comuna)
      const newOnes = found.filter(f => !seenUrls.has(f.menuUrl))
      for (const f of newOnes) seenUrls.add(f.menuUrl)
      allFound.push(...newOnes)
      console.log(`${newOnes.length} encontrados`)
      await sleep(2000) // rate limit Jina
    }
    console.log()
  }

  console.log(`\n📊 Total encontrados: ${allFound.length}\n`)

  if (allFound.length === 0) {
    console.log('No se encontraron restaurantes.')
    await prisma.$disconnect()
    return
  }

  // Show what we found
  for (const f of allFound) {
    console.log(`  🍽 ${f.name} (${f.provider}) — ${f.comuna}`)
    console.log(`     ${f.menuUrl}`)
  }

  // Enrich with Google Places (address + lat/lng)
  console.log(`\n📍 Obteniendo direcciones de Google Places...\n`)
  for (let i = 0; i < allFound.length; i++) {
    process.stdout.write(`   ${i + 1}/${allFound.length} ${allFound[i].name}... `)
    allFound[i] = await enrichWithPlaces(allFound[i])
    console.log(allFound[i].address ? `✓ ${allFound[i].address}` : '✗ sin dirección')
    await sleep(300) // rate limit Places API
  }

  // Import
  console.log(`\n🚀 Importando...\n`)
  let imported = 0, skipped = 0

  for (const f of allFound) {
    const slug = slugify(f.name)

    // Check if already exists
    const existing = await prisma.restaurant.findFirst({
      where: { OR: [{ slug }, { name: f.name }, { website: f.menuUrl }] },
    })

    if (existing) {
      console.log(`   ⏭ ${f.name} — ya existe`)
      skipped++
      continue
    }

    const restaurant = await prisma.restaurant.create({
      data: {
        name: f.name,
        slug,
        address: f.address ?? `${f.comuna}, Santiago`,
        lat: f.lat ?? null,
        lng: f.lng ?? null,
        phone: f.phone ?? null,
        website: f.menuUrl,
        isActive: false,
        menuImported: false,
        plan: 'FREE',
      },
    })

    await prisma.lead.create({
      data: {
        localName: f.name,
        ownerName: `${f.provider} Import`,
        email: 'import@quierocomer.cl',
        cartaType: 'LINK',
        cartaUrl: f.menuUrl,
        cartaStatus: 'PENDING',
        generatedSlug: restaurant.slug,
      },
    })

    console.log(`   ✅ ${f.name} → ${slug} (${f.provider})`)
    imported++

    // Small delay to not overwhelm DB
    if (imported % 10 === 0) await sleep(500)
  }

  console.log(`\n📊 Resultado: ${imported} importados, ${skipped} ya existían`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

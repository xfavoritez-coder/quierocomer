/**
 * Busca restaurantes en El Quisco con Google Places API,
 * filtra los que tienen website con menú extraíble,
 * y los importa a QuieroComer usando el pipeline de extracción.
 *
 * Uso: npx ts-node --skip-project scripts/importar-elquisco.ts
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const API_KEY = process.env.GOOGLE_PLACES_API_KEY!

if (!API_KEY) {
  console.error('ERROR: Falta GOOGLE_PLACES_API_KEY en .env.local')
  process.exit(1)
}

// Dominios de proveedores que sabemos extraer fácilmente
const EXTRACTABLE_DOMAINS = [
  'ola.click',
  'justo.app',
  'micartaqr.cl',
  'carta.avocaty.io',
  'queresto.com',
  'fudo.com',
  'toteat.app',
  'mer-cat.com',
  'pedidosya.cl',
  'ubereats.com',
  'rappi.cl',
  'influye.app',
  'sites.google.com',
  'heyzine.com',
  'canva.com',
  // Common menu/ordering platforms
  'restomovil.cl',
  'tu-mesa.cl',
  'recafy.com',
  'wix.com',
  'square.site',
  'menudigital',
]

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function slugify(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function isExtractable(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return EXTRACTABLE_DOMAINS.some(d => hostname.includes(d))
  } catch { return false }
}

// ─── Google Places API search ──────────────────────────────────
async function searchPlaces(query: string): Promise<any[]> {
  const allPlaces: any[] = []
  let pageToken: string | undefined

  do {
    const body: any = {
      textQuery: query,
      languageCode: 'es',
      regionCode: 'CL',
      maxResultCount: 20,
    }
    if (pageToken) body.pageToken = pageToken

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': [
          'places.id', 'places.displayName', 'places.formattedAddress',
          'places.location', 'places.rating', 'places.userRatingCount',
          'places.types', 'places.regularOpeningHours', 'places.websiteUri',
          'places.nationalPhoneNumber', 'places.googleMapsUri',
          'nextPageToken',
        ].join(','),
      },
      body: JSON.stringify(body),
    })

    const json = await res.json() as any
    if (json.error) {
      console.error(`   API Error: ${json.error.message}`)
      break
    }

    if (json.places) allPlaces.push(...json.places)
    pageToken = json.nextPageToken
    if (pageToken) await sleep(2000) // rate limit
  } while (pageToken)

  return allPlaces
}

// ─── Main ──────────────────────────────────────────────────────
async function main() {
  console.log('🔍 Buscando restaurantes en El Quisco, Chile...\n')

  const queries = [
    'restaurantes en El Quisco, Chile',
    'cafeterías en El Quisco, Chile',
    'comida en El Quisco, Chile',
    'heladerías en El Quisco, Chile',
    'pizzerías en El Quisco, Chile',
    'sushi en El Quisco, Chile',
    'marisquerías en El Quisco, Chile',
    'comida rápida en El Quisco, Chile',
  ]

  // Deduplicate by Google Place ID
  const seenIds = new Set<string>()
  const allPlaces: any[] = []

  for (const query of queries) {
    console.log(`   📡 "${query}"`)
    const places = await searchPlaces(query)
    console.log(`      → ${places.length} resultados`)

    for (const p of places) {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id)
        allPlaces.push(p)
      }
    }
    await sleep(1000)
  }

  console.log(`\n📊 Total únicos: ${allPlaces.length}\n`)

  // Classify
  const withWebsite = allPlaces.filter(p => p.websiteUri)
  const extractable = withWebsite.filter(p => isExtractable(p.websiteUri))
  const withAnyWebsite = withWebsite.filter(p => !isExtractable(p.websiteUri))

  console.log(`🌐 Con website: ${withWebsite.length}`)
  console.log(`✅ Extraíbles (proveedores conocidos): ${extractable.length}`)
  console.log(`🔗 Otros websites (generic scrape): ${withAnyWebsite.length}`)
  console.log(`❌ Sin website: ${allPlaces.length - withWebsite.length}\n`)

  // Show extractable ones
  if (extractable.length > 0) {
    console.log('═══ EXTRAÍBLES (proveedores conocidos) ═══')
    for (const p of extractable) {
      console.log(`  🍽  ${p.displayName.text}`)
      console.log(`     📍 ${p.formattedAddress}`)
      console.log(`     ⭐ ${p.rating ?? '?'} (${p.userRatingCount ?? 0} reviews)`)
      console.log(`     🔗 ${p.websiteUri}`)
      console.log()
    }
  }

  // Show ones with other websites (potential generic scrape)
  if (withAnyWebsite.length > 0) {
    console.log('═══ OTROS WEBSITES (podrían extraerse con scraper genérico) ═══')
    for (const p of withAnyWebsite) {
      console.log(`  🍽  ${p.displayName.text}`)
      console.log(`     📍 ${p.formattedAddress}`)
      console.log(`     ⭐ ${p.rating ?? '?'} (${p.userRatingCount ?? 0} reviews)`)
      console.log(`     🔗 ${p.websiteUri}`)
      console.log()
    }
  }

  // ─── Import extractable restaurants ──────────────────────────
  if (extractable.length === 0 && withAnyWebsite.length === 0) {
    console.log('❌ No se encontraron restaurantes con menús extraíbles')
    await prisma.$disconnect()
    return
  }

  // Import ALL with websites (extractable first, then generic)
  const toImport = [...extractable, ...withAnyWebsite]
  console.log(`\n🚀 Importando ${toImport.length} restaurantes...\n`)

  let imported = 0
  let skipped = 0

  for (const place of toImport) {
    const name = place.displayName.text
    const slug = slugify(name)
    const website = place.websiteUri

    // Check if already exists
    const existing = await prisma.restaurant.findFirst({
      where: { OR: [{ slug }, { name }, { website }] },
    })

    if (existing) {
      console.log(`   ⏭  ${name} — ya existe (${existing.slug})`)
      skipped++
      continue
    }

    // Create restaurant
    const restaurant = await prisma.restaurant.create({
      data: {
        name,
        slug: slug + '-elquisco',
        address: place.formattedAddress ?? '',
        lat: place.location?.latitude ?? null,
        lng: place.location?.longitude ?? null,
        phone: place.nationalPhoneNumber ?? null,
        website: website ?? null,
        isActive: false, // activate after menu extraction
        menuImported: false,
        plan: 'FREE',
      },
    })

    // Create a Lead so the extraction pipeline picks it up
    await prisma.lead.create({
      data: {
        localName: name,
        ownerName: 'Google Places Import',
        email: 'import@quierocomer.cl',
        cartaType: 'LINK',
        cartaUrl: website,
        cartaStatus: 'PENDING',
        generatedSlug: restaurant.slug,
      },
    })

    console.log(`   ✅ ${name} → ${restaurant.slug} (lead creado para extracción)`)
    imported++
  }

  console.log(`\n📊 Resultado: ${imported} importados, ${skipped} ya existían`)
  console.log(`\n💡 Los leads quedaron en estado PENDING. Procesa con:`)
  console.log(`   npx ts-node --skip-project scripts/procesar-leads-pendientes.ts`)

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

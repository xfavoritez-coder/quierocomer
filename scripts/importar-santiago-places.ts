/**
 * Busca restaurantes en comunas de Santiago via Google Places API,
 * filtra los que tienen website de proveedores conocidos (Fudo, Justo, OlaClick, etc.)
 * y los importa con dirección + coordenadas.
 *
 * Uso: npx ts-node --skip-project scripts/importar-santiago-places.ts
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const API_KEY = process.env.GOOGLE_PLACES_API_KEY!

if (!API_KEY) { console.error('Falta GOOGLE_PLACES_API_KEY'); process.exit(1) }

const COMUNAS = ['Ñuñoa', 'Providencia', 'Santiago Centro', 'La Florida', 'Las Condes', 'Peñalolén', 'Macul']

const EXTRACTABLE_DOMAINS = ['fu.do', 'menu.fu.do', 'justo.cl', 'pedir.justo.cl', 'ola.click', 'queresto.com', 'gour.media', 'micartaqr.cl', 'carta.avocaty.io', 'toteat.app']

const QUERIES = ['restaurantes', 'cafeterías', 'sushi', 'pizzería', 'comida peruana', 'comida mexicana', 'hamburguesas', 'comida china', 'comida thai']

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
function slugify(t: string) { return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') }

function isExtractable(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return EXTRACTABLE_DOMAINS.some(d => hostname.includes(d))
  } catch { return false }
}

async function searchPlaces(query: string): Promise<any[]> {
  const allPlaces: any[] = []
  let pageToken: string | undefined

  do {
    const body: any = { textQuery: query, languageCode: 'es', regionCode: 'CL', maxResultCount: 20 }
    if (pageToken) body.pageToken = pageToken

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri,places.nationalPhoneNumber,nextPageToken',
      },
      body: JSON.stringify(body),
    })

    const json = await res.json() as any
    if (json.error) { console.error(`   API Error: ${json.error.message}`); break }
    if (json.places) allPlaces.push(...json.places)
    pageToken = json.nextPageToken
    if (pageToken) await sleep(2000)
  } while (pageToken)

  return allPlaces
}

async function main() {
  console.log('🔍 Buscando restaurantes con proveedores extraíbles en Santiago...\n')

  const seenIds = new Set<string>()
  const extractable: any[] = []
  let totalSearched = 0

  for (const comuna of COMUNAS) {
    console.log(`📍 ${comuna}`)
    let comunaFound = 0

    for (const q of QUERIES) {
      const query = `${q} en ${comuna}, Santiago, Chile`
      const places = await searchPlaces(query)
      totalSearched += places.length

      for (const p of places) {
        if (seenIds.has(p.id)) continue
        seenIds.add(p.id)

        if (p.websiteUri && isExtractable(p.websiteUri)) {
          extractable.push(p)
          comunaFound++
        }
      }
      await sleep(1000) // rate limit
    }
    console.log(`   → ${comunaFound} con proveedor extraíble\n`)
  }

  console.log(`📊 Total buscados: ${totalSearched} | Únicos: ${seenIds.size} | Extraíbles: ${extractable.length}\n`)

  if (extractable.length === 0) {
    console.log('No se encontraron restaurantes con proveedores conocidos.')
    await prisma.$disconnect()
    return
  }

  // Show results
  for (const p of extractable) {
    const domain = new URL(p.websiteUri).hostname
    console.log(`  🍽 ${p.displayName.text}`)
    console.log(`     📍 ${p.formattedAddress}`)
    console.log(`     🔗 ${p.websiteUri} (${domain})`)
  }

  // Import
  console.log(`\n🚀 Importando ${extractable.length} restaurantes...\n`)
  let imported = 0, skipped = 0

  for (const p of extractable) {
    const name = p.displayName.text
    const slug = slugify(name)
    const website = p.websiteUri

    const existing = await prisma.restaurant.findFirst({
      where: { OR: [{ slug }, { name }, { website }] },
    })

    if (existing) {
      // Update address/coords if missing
      if (!existing.lat && p.location?.latitude) {
        await prisma.restaurant.update({
          where: { id: existing.id },
          data: {
            address: p.formattedAddress ?? existing.address,
            lat: p.location.latitude,
            lng: p.location.longitude,
            phone: p.nationalPhoneNumber ?? existing.phone,
          },
        })
        console.log(`   🔄 ${name} — actualizado dirección`)
      } else {
        console.log(`   ⏭ ${name} — ya existe`)
      }
      skipped++
      continue
    }

    const restaurant = await prisma.restaurant.create({
      data: {
        name, slug,
        address: p.formattedAddress ?? '',
        lat: p.location?.latitude ?? null,
        lng: p.location?.longitude ?? null,
        phone: p.nationalPhoneNumber ?? null,
        website,
        isActive: false,
        isDemo: true,
        menuImported: false,
        plan: 'FREE',
      },
    })

    await prisma.lead.create({
      data: {
        localName: name,
        ownerName: 'Google Places Import',
        email: 'import@quierocomer.com',
        cartaType: 'LINK',
        cartaUrl: website,
        cartaStatus: 'PENDING',
        generatedSlug: restaurant.slug,
      },
    })

    console.log(`   ✅ ${name} → ${slug}`)
    console.log(`      📍 ${p.formattedAddress}`)
    console.log(`      🔗 ${website}`)
    imported++
  }

  console.log(`\n📊 Resultado: ${imported} importados, ${skipped} ya existían`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

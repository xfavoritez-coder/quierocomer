/**
 * Sincroniza teléfonos de restaurantes con Google Places API.
 * Compara el teléfono actual en BD con el de Google y actualiza si difiere.
 *
 * Uso: node scripts/sync-phones-from-google.mjs [--dry-run]
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

const prisma = new PrismaClient()
const API_KEY = process.env.GOOGLE_PLACES_API_KEY
const DRY_RUN = process.argv.includes('--dry-run')

if (!API_KEY) {
  console.error('❌ GOOGLE_PLACES_API_KEY no está definida en .env.local')
  process.exit(1)
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function normalizePhone(p) {
  if (!p) return null
  return p.replace(/\s+/g, ' ').trim()
}

function phonesEqual(a, b) {
  if (!a && !b) return true
  if (!a || !b) return false
  // Normalizar: quitar espacios, guiones, paréntesis para comparar
  const clean = (s) => s.replace(/[\s\-().]/g, '')
  return clean(a) === clean(b)
}

async function getGooglePhone(placeId) {
  try {
    const url = `https://places.googleapis.com/v1/places/${placeId}`
    const res = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'nationalPhoneNumber,internationalPhoneNumber',
      },
    })
    if (!res.ok) {
      const err = await res.text()
      if (res.status === 404) return { phone: null, notFound: true }
      console.warn(`  ⚠️  API error ${res.status}: ${err.slice(0, 100)}`)
      return { phone: null }
    }
    const data = await res.json()
    const phone = data.internationalPhoneNumber ?? data.nationalPhoneNumber ?? null
    return { phone: normalizePhone(phone) }
  } catch (e) {
    console.warn(`  ⚠️  Fetch error: ${e.message}`)
    return { phone: null }
  }
}

async function main() {
  console.log(`🔍 Modo: ${DRY_RUN ? 'DRY RUN (sin cambios)' : 'REAL (actualiza BD)'}`)
  console.log('Cargando restaurantes con googlePlaceId...\n')

  // Solo locales que aparecen en el feed (tienen platos activos con foto)
  const withDishes = await prisma.dish.findMany({
    where: { isActive: true, deletedAt: null, hiddenFromFeed: false, photos: { isEmpty: false } },
    select: { restaurantId: true },
    distinct: ['restaurantId'],
  })
  const feedRestaurantIds = new Set(withDishes.map(d => d.restaurantId))

  const restaurants = await prisma.restaurant.findMany({
    where: { googlePlaceId: { not: null }, isActive: true, isDemo: false, id: { in: [...feedRestaurantIds] } },
    select: { id: true, name: true, slug: true, phone: true, googlePlaceId: true },
    orderBy: { name: 'asc' },
  })

  console.log(`Total: ${restaurants.length} restaurantes\n`)

  let updated = 0
  let noPhone = 0
  let same = 0
  let errors = 0
  const changes = []

  for (let i = 0; i < restaurants.length; i++) {
    const r = restaurants[i]
    process.stdout.write(`[${i + 1}/${restaurants.length}] ${r.name}... `)

    const { phone: googlePhone, notFound } = await getGooglePhone(r.googlePlaceId)

    if (notFound) {
      console.log('❓ PlaceId no encontrado en Google')
      errors++
    } else if (!googlePhone) {
      console.log('📵 Sin teléfono en Google')
      noPhone++
    } else if (phonesEqual(r.phone, googlePhone)) {
      console.log(`✓ igual (${googlePhone})`)
      same++
    } else {
      console.log(`\n   BD:     ${r.phone ?? '(vacío)'}`)
      console.log(`   Google: ${googlePhone}`)
      changes.push({ id: r.id, name: r.name, slug: r.slug, old: r.phone, new: googlePhone })
      if (!DRY_RUN) {
        await prisma.restaurant.update({
          where: { id: r.id },
          data: { phone: googlePhone },
        })
        console.log(`   ✅ Actualizado`)
      } else {
        console.log(`   → (dry-run, sin cambio)`)
      }
      updated++
    }

    // Rate limit: 10 req/s → 120ms entre requests
    await sleep(120)
  }

  console.log('\n─────────────────────────────────')
  console.log(`✅ Actualizados:    ${updated}`)
  console.log(`≈  Sin cambio:      ${same}`)
  console.log(`📵 Sin tel Google:  ${noPhone}`)
  console.log(`❓ Errores/404:     ${errors}`)
  console.log('─────────────────────────────────')

  if (changes.length > 0) {
    console.log('\nResumen de cambios:')
    for (const c of changes) {
      console.log(`  ${c.name} (/${c.slug})`)
      console.log(`    Antes: ${c.old ?? '(vacío)'}`)
      console.log(`    Ahora: ${c.new}`)
    }
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})

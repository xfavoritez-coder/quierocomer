/**
 * Lista todos los restaurantes en Santiago que usan proveedores conocidos.
 * NO importa ni extrae — solo genera un JSON con la lista.
 * Guarda en public/locales-feed.json para la página /localesfeed.
 *
 * Uso: npx ts-node --skip-project scripts/listar-santiago-proveedores.ts
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import fs from 'fs'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY!
if (!API_KEY) { console.error('Falta GOOGLE_PLACES_API_KEY'); process.exit(1) }

const COMUNAS = [
  'Ñuñoa', 'Providencia', 'Santiago Centro', 'La Florida', 'Las Condes',
  'Peñalolén', 'Macul', 'Vitacura', 'La Reina', 'San Miguel',
  'Independencia', 'Recoleta', 'Maipú', 'Estación Central', 'Lo Barnechea',
  'San Joaquín', 'Huechuraba', 'Quinta Normal', 'Pudahuel', 'Cerrillos',
  'La Cisterna', 'San Bernardo', 'Puente Alto', 'Lo Prado', 'Conchalí',
  'Pedro Aguirre Cerda', 'Lo Espejo', 'Renca', 'El Bosque', 'La Granja',
  'La Pintana', 'San Ramón', 'Peñaflor', 'Talagante', 'Buin', 'Colina',
]

const EXTRACTABLE_DOMAINS = [
  'fu.do', 'menu.fu.do', 'justo.cl', 'pedir.justo.cl', 'ola.click',
  'queresto.com', 'gour.media', 'toteat.app', 'toteat.shop',
]

const QUERIES = [
  'restaurantes', 'cafeterías', 'sushi', 'pizzería', 'comida peruana',
  'hamburguesas', 'comida china', 'comida thai', 'comida mexicana',
  'pastas', 'mariscos', 'comida japonesa', 'comida italiana',
  'parrilla', 'comida rápida', 'heladerías', 'postres',
  'comida vegana', 'comida india', 'comida coreana', 'empanadas',
  'sandwichería', 'brunch', 'bar restaurante',
]

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function isExtractable(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return EXTRACTABLE_DOMAINS.some(d => hostname.includes(d))
  } catch { return false }
}

function getProvider(url: string): string {
  try {
    const h = new URL(url).hostname.toLowerCase()
    if (h.includes('fu.do')) return 'Fudo'
    if (h.includes('justo')) return 'Justo'
    if (h.includes('ola.click')) return 'OlaClick'
    if (h.includes('queresto')) return 'Queresto'
    if (h.includes('gour.media')) return 'Gourmedia'
    if (h.includes('toteat')) return 'Toteat'
    return 'Otro'
  } catch { return 'Otro' }
}

async function searchPlaces(query: string): Promise<any[]> {
  const body = { textQuery: query, languageCode: 'es', regionCode: 'CL', maxResultCount: 20 }
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri,places.rating,places.userRatingCount',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    })
    const json = await res.json() as any
    return json.places || []
  } catch { return [] }
}

// Search Google for restaurants on specific provider domains
async function searchGoogle(query: string): Promise<{ name: string; url: string }[]> {
  try {
    const res = await fetch(`https://www.google.com/search?q=${encodeURIComponent(query)}&num=50&hl=es`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    })
    const html = await res.text()
    const results: { name: string; url: string }[] = []

    // Extract URLs from Google results
    const urlMatches = html.match(/https?:\/\/[^\s"<>]+/g) || []
    for (const url of urlMatches) {
      if (isExtractable(url) && !url.includes('google.com')) {
        // Extract name from URL slug
        const slug = url.match(/\/([a-z0-9%_-]+)\/?$/i)?.[1] ||
                     url.match(/([a-z0-9-]+)\.ola\.click/i)?.[1]
        if (slug) {
          const name = decodeURIComponent(slug).replace(/-/g, ' ').replace(/%[0-9a-f]{2}/gi, ' ').trim()
            .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
          if (name.length > 2 && name.length < 60) {
            results.push({ name, url: url.split(/[)}\]]/)[0] })
          }
        }
      }
    }
    return results
  } catch { return [] }
}

// Enrich a web-found restaurant with Google Places data
async function enrichWithPlaces(name: string, comuna?: string): Promise<Partial<Local>> {
  try {
    const query = `${name} ${comuna || 'Santiago'} Chile restaurante`
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.formattedAddress,places.location,places.rating,places.userRatingCount,places.displayName',
      },
      body: JSON.stringify({ textQuery: query, languageCode: 'es', regionCode: 'CL', maxResultCount: 1 }),
      signal: AbortSignal.timeout(8000),
    })
    const json = await res.json() as any
    const p = json.places?.[0]
    if (p) {
      return {
        name: p.displayName?.text || name,
        address: p.formattedAddress || '',
        lat: p.location?.latitude,
        lng: p.location?.longitude,
        rating: p.rating,
        reviews: p.userRatingCount,
      }
    }
  } catch {}
  return {}
}

type Local = {
  name: string; address: string; lat: number; lng: number;
  website: string; provider: string; rating: number; reviews: number; comuna: string;
}

async function main() {
  console.log('🔍 Listando restaurantes con proveedores conocidos en Santiago...\n')

  const seenIds = new Set<string>()
  const seenUrls = new Set<string>()
  const results: Local[] = []

  // ─── PHASE 1: Google Places por comuna ──────────────────────
  console.log('═══ Fase 1: Google Places por comuna ═══\n')

  for (const comuna of COMUNAS) {
    process.stdout.write(`📍 ${comuna} `)
    let comunaFound = 0

    for (const q of QUERIES) {
      const places = await searchPlaces(`${q} en ${comuna}, Santiago, Chile`)
      for (const p of places) {
        if (seenIds.has(p.id)) continue
        seenIds.add(p.id)
        if (p.websiteUri && isExtractable(p.websiteUri)) {
          seenUrls.add(p.websiteUri.toLowerCase())
          results.push({
            name: p.displayName.text,
            address: p.formattedAddress || '',
            lat: p.location?.latitude,
            lng: p.location?.longitude,
            website: p.websiteUri,
            provider: getProvider(p.websiteUri),
            rating: p.rating,
            reviews: p.userRatingCount,
            comuna,
          })
          comunaFound++
        }
      }
      await sleep(800)
    }
    console.log(`→ ${comunaFound}`)
  }

  console.log(`\nFase 1: ${results.length} encontrados via Google Places\n`)

  // ─── PHASE 2: Búsqueda directa en Google por proveedor ─────
  console.log('═══ Fase 2: Búsqueda directa por proveedor ═══\n')

  const providerSearches = [
    'site:menu.fu.do Santiago',
    'site:menu.fu.do restaurante Chile',
    'site:pedir.justo.cl Santiago',
    'site:pedir.justo.cl restaurante Chile',
    'site:gour.media Santiago',
    'site:gour.media restaurante Chile',
    'site:gour.media carta menu',
    'site:queresto.com Santiago',
    'site:queresto.com restaurante Chile',
    'site:toteat.app Santiago',
    'site:toteat.app restaurante menu Chile',
    '"ola.click" restaurante Santiago carta',
    '"ola.click" menu restaurante Chile',
  ]

  let phase2Count = 0
  for (const query of providerSearches) {
    process.stdout.write(`   🔎 ${query.substring(0, 50)}... `)
    const found = await searchGoogle(query)
    let newOnes = 0
    for (const f of found) {
      if (seenUrls.has(f.url.toLowerCase())) continue
      seenUrls.add(f.url.toLowerCase())
      // Enrich with Google Places to get address
      const enriched = await enrichWithPlaces(f.name)
      await sleep(300)
      results.push({
        name: enriched.name || f.name,
        address: enriched.address || 'Santiago, Chile',
        lat: enriched.lat || 0,
        lng: enriched.lng || 0,
        website: f.url,
        provider: getProvider(f.url),
        rating: enriched.rating || 0,
        reviews: enriched.reviews || 0,
        comuna: '',
      })
      newOnes++
      phase2Count++
    }
    console.log(`${newOnes} nuevos`)
    await sleep(2000)
  }

  console.log(`\nFase 2: ${phase2Count} adicionales via Google Search`)
  console.log(`\n📊 Total: ${results.length} restaurantes\n`)

  // Group by provider
  const byProvider: Record<string, number> = {}
  for (const r of results) byProvider[r.provider] = (byProvider[r.provider] || 0) + 1
  console.log('Por proveedor:')
  for (const [p, c] of Object.entries(byProvider).sort(([,a],[,b]) => b - a)) console.log(`  ${p}: ${c}`)

  // Save JSON
  fs.writeFileSync('public/locales-feed.json', JSON.stringify(results, null, 2))
  console.log(`\n✅ Guardado en public/locales-feed.json`)
}

main().catch(e => { console.error(e); process.exit(1) })

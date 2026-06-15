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
]

const EXTRACTABLE_DOMAINS = [
  'fu.do', 'menu.fu.do', 'justo.cl', 'pedir.justo.cl', 'ola.click',
  'queresto.com', 'gour.media', 'toteat.app', 'toteat.shop',
]

const QUERIES = ['restaurantes', 'cafeterías', 'sushi', 'pizzería', 'comida peruana', 'hamburguesas', 'comida china', 'comida thai', 'comida mexicana', 'pastas', 'mariscos']

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

async function main() {
  console.log('🔍 Listando restaurantes con proveedores conocidos en Santiago...\n')

  const seenIds = new Set<string>()
  const results: any[] = []

  for (const comuna of COMUNAS) {
    process.stdout.write(`📍 ${comuna} `)
    let comunaFound = 0

    for (const q of QUERIES) {
      const places = await searchPlaces(`${q} en ${comuna}, Santiago, Chile`)
      for (const p of places) {
        if (seenIds.has(p.id)) continue
        seenIds.add(p.id)
        if (p.websiteUri && isExtractable(p.websiteUri)) {
          results.push({
            name: p.displayName.text,
            address: p.formattedAddress,
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

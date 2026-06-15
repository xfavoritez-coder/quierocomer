/**
 * Busca restaurantes DIRECTO en los sitemaps/directorios de cada proveedor.
 * Luego enriquece con Google Places para dirección + coordenadas.
 * Guarda en public/locales-feed.json
 *
 * Uso: npx ts-node --skip-project scripts/listar-proveedores-directo.ts
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import fs from 'fs'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY!

type Local = {
  name: string; address: string; lat: number; lng: number;
  website: string; provider: string; rating: number; reviews: number; comuna: string;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function slugToName(slug: string): string {
  return decodeURIComponent(slug)
    .replace(/-/g, ' ').replace(/%[0-9a-f]{2}/gi, ' ').trim()
    .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

async function enrichWithPlaces(name: string): Promise<Partial<Local>> {
  if (!API_KEY) return {}
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.formattedAddress,places.location,places.rating,places.userRatingCount,places.displayName',
      },
      body: JSON.stringify({ textQuery: `${name} restaurante Santiago Chile`, languageCode: 'es', regionCode: 'CL', maxResultCount: 1 }),
      signal: AbortSignal.timeout(8000),
    })
    const json = await res.json() as any
    const p = json.places?.[0]
    if (p) {
      const addr = p.formattedAddress || ''
      // Extract comuna from address
      const parts = addr.split(',').map((s: string) => s.trim())
      const comuna = parts.length >= 3 ? parts[parts.length - 2]?.replace(/Región.*/, '').trim() : ''
      return {
        name: p.displayName?.text || name,
        address: addr,
        lat: p.location?.latitude || 0,
        lng: p.location?.longitude || 0,
        rating: p.rating || 0,
        reviews: p.userRatingCount || 0,
        comuna,
      }
    }
  } catch {}
  return {}
}

// ─── Gourmedia: sitemap ──────────────────────────────────────
async function getGourmediaSlugs(): Promise<string[]> {
  try {
    const res = await fetch('https://gour.media/sitemap.xml', { signal: AbortSignal.timeout(10000) })
    const xml = await res.text()
    const urls = xml.match(/<loc>https:\/\/gour\.media\/([a-z0-9-]+)\/?<\/loc>/gi) || []
    const exclude = new Set(['login','menu-digital','loyalty-passes','sistema-de-reservas','blog','contacto','precios','about','privacy','terms','it','he','pt','de','fr','eu','ca','gl','ko','zh','ja'])
    return urls.map(u => u.replace(/<\/?loc>/gi, '').replace('https://gour.media/', '').replace(/\/$/, ''))
      .filter(s => s && !s.includes('/') && s.length > 2 && !exclude.has(s))
  } catch { return [] }
}

// ─── Queresto: known patterns ─────────────────────────────────
async function getQuerestoSlugs(): Promise<string[]> {
  try {
    const res = await fetch('https://queresto.com/sitemap.xml', { signal: AbortSignal.timeout(10000) })
    const xml = await res.text()
    const urls = xml.match(/<loc>https:\/\/queresto\.com\/([a-z0-9-]+)\/?<\/loc>/gi) || []
    const exclude = new Set(['login','register','about','contact','privacy','terms','sitemap','blog','help','faq'])
    return urls.map(u => u.replace(/<\/?loc>/gi, '').replace('https://queresto.com/', '').replace(/\/$/, ''))
      .filter(s => s && !s.includes('/') && s.length > 2 && !exclude.has(s))
  } catch { return [] }
}

async function main() {
  console.log('🔍 Buscando restaurantes directo en proveedores...\n')

  // Load existing results to merge
  let existing: Local[] = []
  try { existing = JSON.parse(fs.readFileSync('public/locales-feed.json', 'utf-8')) } catch {}
  const seenUrls = new Set(existing.map(l => l.website.toLowerCase()))
  const results = [...existing]
  console.log(`Existentes: ${existing.length}\n`)

  // ─── GOURMEDIA ──────────────────────────────────────────────
  console.log('═══ Gourmedia (sitemap) ═══')
  const gourSlugs = await getGourmediaSlugs()
  console.log(`Slugs encontrados: ${gourSlugs.length}`)

  let gourNew = 0
  for (let i = 0; i < gourSlugs.length; i++) {
    const slug = gourSlugs[i]
    const url = `https://gour.media/${slug}/`
    if (seenUrls.has(url.toLowerCase()) || seenUrls.has(url.toLowerCase().replace(/\/$/, ''))) continue
    seenUrls.add(url.toLowerCase())

    const name = slugToName(slug)
    process.stdout.write(`  ${i + 1}/${gourSlugs.length} ${name}... `)

    const enriched = await enrichWithPlaces(name)
    const isChile = (enriched.address || '').includes('Chile') || (enriched.address || '').includes('Santiago')

    if (isChile || !enriched.address) {
      results.push({
        name: enriched.name || name,
        address: enriched.address || '',
        lat: enriched.lat || 0,
        lng: enriched.lng || 0,
        website: url,
        provider: 'Gourmedia',
        rating: enriched.rating || 0,
        reviews: enriched.reviews || 0,
        comuna: enriched.comuna || '',
      })
      gourNew++
      console.log('✓', enriched.address?.substring(0, 40) || 'sin dirección')
    } else {
      console.log('✗ fuera de Chile:', enriched.address?.substring(0, 40))
    }

    await sleep(250) // rate limit Places
  }
  console.log(`Gourmedia nuevos en Chile: ${gourNew}\n`)

  // ─── QUERESTO ───────────────────────────────────────────────
  console.log('═══ Queresto (sitemap) ═══')
  const qrSlugs = await getQuerestoSlugs()
  console.log(`Slugs encontrados: ${qrSlugs.length}`)

  let qrNew = 0
  for (let i = 0; i < qrSlugs.length; i++) {
    const slug = qrSlugs[i]
    const url = `https://queresto.com/${slug}`
    if (seenUrls.has(url.toLowerCase())) continue
    seenUrls.add(url.toLowerCase())

    const name = slugToName(slug)
    process.stdout.write(`  ${i + 1}/${qrSlugs.length} ${name}... `)

    const enriched = await enrichWithPlaces(name)
    const isChile = (enriched.address || '').includes('Chile')

    if (isChile || !enriched.address) {
      results.push({
        name: enriched.name || name,
        address: enriched.address || '',
        lat: enriched.lat || 0,
        lng: enriched.lng || 0,
        website: url,
        provider: 'Queresto',
        rating: enriched.rating || 0,
        reviews: enriched.reviews || 0,
        comuna: enriched.comuna || '',
      })
      qrNew++
      console.log('✓')
    } else {
      console.log('✗ fuera de Chile')
    }

    await sleep(250)
  }
  console.log(`Queresto nuevos: ${qrNew}\n`)

  // ─── Summary ────────────────────────────────────────────────
  console.log(`📊 Total: ${results.length} restaurantes`)
  const byProvider: Record<string, number> = {}
  for (const r of results) byProvider[r.provider] = (byProvider[r.provider] || 0) + 1
  for (const [p, c] of Object.entries(byProvider).sort(([,a],[,b]) => b - a)) console.log(`  ${p}: ${c}`)

  fs.writeFileSync('public/locales-feed.json', JSON.stringify(results, null, 2))
  console.log(`\n✅ Guardado en public/locales-feed.json`)
}

main().catch(e => { console.error(e); process.exit(1) })

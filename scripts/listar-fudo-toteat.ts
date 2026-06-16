/**
 * Extrae restaurantes de los sitemaps de Fudo (2712) y Toteat (4804).
 * Filtra solo Chile, enriquece con Google Places.
 * Mergea con locales-feed.json existente.
 *
 * Uso: npx ts-node --skip-project scripts/listar-fudo-toteat.ts
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

async function enrichWithPlaces(name: string): Promise<Partial<Local> & { country?: string }> {
  if (!API_KEY) return {}
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'places.formattedAddress,places.location,places.rating,places.userRatingCount,places.displayName',
      },
      body: JSON.stringify({ textQuery: `${name} restaurante Chile`, languageCode: 'es', regionCode: 'CL', maxResultCount: 1 }),
      signal: AbortSignal.timeout(8000),
    })
    const json = await res.json() as any
    const p = json.places?.[0]
    if (p) {
      const addr = p.formattedAddress || ''
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
        country: addr.includes('Chile') ? 'CL' : 'other',
      }
    }
  } catch {}
  return {}
}

async function main() {
  // Load existing
  let existing: Local[] = []
  try { existing = JSON.parse(fs.readFileSync('public/locales-feed.json', 'utf-8')) } catch {}
  const seenUrls = new Set(existing.map(l => l.website.toLowerCase()))
  const results = [...existing]
  console.log(`Existentes: ${existing.length}\n`)

  // ─── FUDO ──────────────────────────────────────────────────
  console.log('═══ Fudo (sitemap: 2712 slugs) ═══')
  const fudoRes = await fetch('https://menu.fu.do/sitemap.xml', { signal: AbortSignal.timeout(15000) })
  const fudoXml = await fudoRes.text()
  const fudoMatches = fudoXml.match(/<loc>https:\/\/menu\.fu\.do\/([^<]+)<\/loc>/gi) || []
  const fudoSlugs = [...new Set(
    fudoMatches.map(m => m.replace(/<\/?loc>/gi, '').replace('https://menu.fu.do/', '').replace(/\/.*/, '').replace(/\?.*/, ''))
  )].filter(s => s && s.length > 2 && !['sitemap', 'robots', 'assets', 'qr-menu'].includes(s))
  console.log(`Slugs únicos: ${fudoSlugs.length}`)

  let fudoNew = 0, fudoSkip = 0
  for (let i = 0; i < fudoSlugs.length; i++) {
    const slug = fudoSlugs[i]
    const url = `https://menu.fu.do/${slug}`
    if (seenUrls.has(url.toLowerCase())) { fudoSkip++; continue }
    seenUrls.add(url.toLowerCase())

    const name = slugToName(slug)
    if (i % 50 === 0) console.log(`  Procesando ${i}/${fudoSlugs.length} (${fudoNew} nuevos Chile)...`)

    const enriched = await enrichWithPlaces(name)
    const isSantiago = enriched.country === 'CL' && (
      (enriched.address || '').includes('Metropolitana') ||
      (enriched.address || '').includes('Santiago') ||
      (enriched.address || '').includes('Maipú') ||
      (enriched.address || '').includes('Puente Alto') ||
      (enriched.address || '').includes('La Florida')
    )
    if (isSantiago) {
      results.push({
        name: enriched.name || name,
        address: enriched.address || '',
        lat: enriched.lat || 0, lng: enriched.lng || 0,
        website: url, provider: 'Fudo',
        rating: enriched.rating || 0, reviews: enriched.reviews || 0,
        comuna: enriched.comuna || '',
      })
      fudoNew++
    }
    await sleep(200)
  }
  console.log(`Fudo: ${fudoNew} nuevos en Chile (${fudoSkip} ya existían)\n`)

  // Save intermediate
  fs.writeFileSync('public/locales-feed.json', JSON.stringify(results, null, 2))
  console.log(`Guardado intermedio: ${results.length} total\n`)

  // ─── TOTEAT ────────────────────────────────────────────────
  console.log('═══ Toteat (sitemap: 4804 URLs) ═══')
  const toteatRes = await fetch('https://toteat.app/sitemap.xml', { signal: AbortSignal.timeout(15000) })
  const toteatXml = await toteatRes.text()
  // Extract unique restaurant URLs (only /r/cl/ = Chile)
  const toteatMatches = toteatXml.match(/<loc>https:\/\/toteat\.app\/r\/cl\/([^<]+)<\/loc>/gi) || []
  const toteatEntries = [...new Set(
    toteatMatches.map(m => {
      const url = m.replace(/<\/?loc>/gi, '')
      const match = url.match(/\/r\/cl\/([^/]+)\/(\d+)/)
      if (match) return { slug: match[1], id: match[2], url: `https://toteat.app/r/cl/${match[1]}/${match[2]}/menu` }
      return null
    }).filter(Boolean)
  )] as { slug: string; id: string; url: string }[]

  // Dedupe by id
  const seenToteatIds = new Set<string>()
  const uniqueToteat = toteatEntries.filter(e => {
    if (seenToteatIds.has(e.id)) return false
    seenToteatIds.add(e.id)
    return true
  })
  console.log(`Restaurantes Chile únicos: ${uniqueToteat.length}`)

  let toteatNew = 0
  for (let i = 0; i < uniqueToteat.length; i++) {
    const entry = uniqueToteat[i]
    if (seenUrls.has(entry.url.toLowerCase())) continue
    seenUrls.add(entry.url.toLowerCase())

    const name = slugToName(entry.slug)
    if (i % 50 === 0) console.log(`  Procesando ${i}/${uniqueToteat.length} (${toteatNew} nuevos)...`)

    const enriched = await enrichWithPlaces(name)
    const isSantiago = (enriched.address || '').includes('Metropolitana') ||
      (enriched.address || '').includes('Santiago') ||
      (enriched.address || '').includes('Maipú') ||
      (enriched.address || '').includes('Puente Alto') ||
      (enriched.address || '').includes('La Florida')
    if (!isSantiago) continue
    results.push({
      name: enriched.name || name,
      address: enriched.address || '',
      lat: enriched.lat || 0, lng: enriched.lng || 0,
      website: entry.url, provider: 'Toteat',
      rating: enriched.rating || 0, reviews: enriched.reviews || 0,
      comuna: enriched.comuna || '',
    })
    toteatNew++
    await sleep(200)

    // Save every 100
    if (toteatNew % 100 === 0) {
      fs.writeFileSync('public/locales-feed.json', JSON.stringify(results, null, 2))
      console.log(`  Guardado: ${results.length} total`)
    }
  }
  console.log(`Toteat: ${toteatNew} nuevos\n`)

  // ─── Final ─────────────────────────────────────────────────
  console.log(`📊 Total: ${results.length} restaurantes`)
  const byProvider: Record<string, number> = {}
  for (const r of results) byProvider[r.provider] = (byProvider[r.provider] || 0) + 1
  for (const [p, c] of Object.entries(byProvider).sort(([,a],[,b]) => b - a)) console.log(`  ${p}: ${c}`)

  fs.writeFileSync('public/locales-feed.json', JSON.stringify(results, null, 2))
  console.log(`\n✅ Guardado final en public/locales-feed.json`)
}

main().catch(e => { console.error(e); process.exit(1) })

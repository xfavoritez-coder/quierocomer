/**
 * populate-communes.ts
 *
 * Parses the `address` field of each active Restaurant to extract the commune,
 * then updates `commune` (display) and `communeSlug` (URL) fields.
 *
 * Chilean address format: "Av. Italia 1350, Providencia, Santiago"
 * Commune is the second-to-last comma-segment (trimmed).
 *
 * Set DRY_RUN = false to actually write to the DB.
 */

const DRY_RUN = false

import { Client } from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })
const db = new Client({ connectionString: process.env.DIRECT_URL })

// Special-character overrides: raw string (lowercased) → commune slug
const SLUG_MAP: Record<string, string> = {
  'ñuñoa': 'nunoa',
  'nunoa': 'nunoa',
  'maipú': 'maipu',
  'maipu': 'maipu',
  'quilicura': 'quilicura',
  'peñalolén': 'penalolen',
  'penalolen': 'penalolen',
  'peñaflor': 'penaflor',
  'penaflor': 'penaflor',
  'estación central': 'estacion-central',
  'estacion central': 'estacion-central',
  'san joaquín': 'san-joaquin',
  'san joaquin': 'san-joaquin',
  'conchalí': 'conchali',
  'conchali': 'conchali',
  'huechuraba': 'huechuraba',
  'macul': 'macul',
  'pudahuel': 'pudahuel',
  'renca': 'renca',
  'cerrillos': 'cerrillos',
  'cerro navia': 'cerro-navia',
  'lo espejo': 'lo-espejo',
  'lo prado': 'lo-prado',
  'el bosque': 'el-bosque',
  'lo barnechea': 'lo-barnechea',
  'san ramón': 'san-ramon',
  'san ramon': 'san-ramon',
  'pedro aguirre cerda': 'pedro-aguirre-cerda',
  'la granja': 'la-granja',
  'la pintana': 'la-pintana',
  'san miguel': 'san-miguel',
  'la cisterna': 'la-cisterna',
  'el monte': 'el-monte',
  'talagante': 'talagante',
  'melipilla': 'melipilla',
  'buin': 'buin',
  'paine': 'paine',
  'isla de maipo': 'isla-de-maipo',
  'isla de maipó': 'isla-de-maipu',
  'curacaví': 'curacavi',
  'curacavi': 'curacavi',
}

// Known commune display name overrides (lowercase raw → display string)
const DISPLAY_MAP: Record<string, string> = {
  'providencia': 'Providencia',
  'santiago': 'Santiago',
  'santiago centro': 'Santiago Centro',
  'las condes': 'Las Condes',
  'vitacura': 'Vitacura',
  'la florida': 'La Florida',
  'la reina': 'La Reina',
  'ñuñoa': 'Ñuñoa',
  'nunoa': 'Ñuñoa',
  'la dehesa': 'La Dehesa',
  'lo barnechea': 'Lo Barnechea',
  'pudahuel': 'Pudahuel',
  'maipú': 'Maipú',
  'maipu': 'Maipú',
  'cerrillos': 'Cerrillos',
  'el bosque': 'El Bosque',
  'san miguel': 'San Miguel',
  'miraflores': 'Miraflores',
  'macul': 'Macul',
  'quilicura': 'Quilicura',
  'estación central': 'Estación Central',
  'estacion central': 'Estación Central',
  'peñalolén': 'Peñalolén',
  'penalolen': 'Peñalolén',
  'san joaquín': 'San Joaquín',
  'san joaquin': 'San Joaquín',
  'conchalí': 'Conchalí',
  'conchali': 'Conchalí',
  'renca': 'Renca',
  'la granja': 'La Granja',
  'la cisterna': 'La Cisterna',
  'la pintana': 'La Pintana',
  'pedro aguirre cerda': 'Pedro Aguirre Cerda',
  'cerro navia': 'Cerro Navia',
  'lo espejo': 'Lo Espejo',
  'lo prado': 'Lo Prado',
  'huechuraba': 'Huechuraba',
  'independencia': 'Independencia',
  'recoleta': 'Recoleta',
  'buin': 'Buin',
  'paine': 'Paine',
  'talagante': 'Talagante',
  'melipilla': 'Melipilla',
  'isla de maipo': 'Isla de Maipo',
  'curacaví': 'Curacaví',
  'curacavi': 'Curacaví',
  'peñaflor': 'Peñaflor',
  'penaflor': 'Peñaflor',
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

// Segments to skip when scanning for the commune
const SKIP_SEGMENTS = [
  'chile', 'región metropolitana', 'region metropolitana',
  'valparaíso', 'valparaiso', 'región de valparaíso', 'region de valparaiso',
  'biobío', 'biobio', 'los lagos', 'maule', 'araucanía', 'araucania',
]

function extractCommune(address: string): { commune: string; communeSlug: string } | null {
  const parts = address.split(',').map(p => p.trim()).filter(Boolean)
  if (parts.length < 2) return null

  // Scan from second-to-last backwards, skip noise segments
  let raw: string | null = null
  for (let i = parts.length - 1; i >= 1; i--) {
    let part = parts[i]
    const lower = part.toLowerCase()
    // Skip region/country noise
    if (SKIP_SEGMENTS.some(s => lower.includes(s))) continue
    // Strip leading postal code: "7510259 Providencia" → "Providencia"
    part = part.replace(/^\d{5,7}\s+/, '').trim()
    if (part.length >= 3) { raw = part; break }
  }

  if (!raw) return null

  const lower = raw.toLowerCase().normalize('NFC')
  const communeSlug = SLUG_MAP[lower] ?? slugify(raw)
  // Title-case fallback using word split (handles accented chars better than \b\w)
  const commune = DISPLAY_MAP[lower]
    ?? raw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')

  if (!communeSlug || communeSlug.length < 3) return null
  // Skip if it still looks like a postal code slug
  if (/^\d/.test(communeSlug)) return null

  return { commune, communeSlug }
}

async function main() {
  await db.connect()

  const { rows } = await db.query<{ id: string; slug: string; address: string | null; commune: string | null; communeSlug: string | null }>(
    `SELECT id, slug, address, commune, "communeSlug" FROM "Restaurant" WHERE "isActive" = true AND "isDemo" = false`
  )

  console.log(`\nTotal restaurants: ${rows.length}`)
  console.log(`DRY_RUN: ${DRY_RUN}\n`)

  let found = 0, skipped = 0, alreadySet = 0

  for (const r of rows) {
    if (!r.address) { console.log(`[SKIP] ${r.slug} — no address`); skipped++; continue }

    const result = extractCommune(r.address)
    if (!result) { console.log(`[SKIP] ${r.slug} — can't parse: "${r.address}"`); skipped++; continue }

    const { commune, communeSlug } = result
    if (r.commune === commune && r.communeSlug === communeSlug) { alreadySet++; continue }

    console.log(`[SET]  ${r.slug}`)
    console.log(`       address:     ${r.address}`)
    console.log(`       commune:     ${commune}  /  slug: ${communeSlug}`)
    found++

    if (!DRY_RUN) {
      await db.query(
        `UPDATE "Restaurant" SET commune = $1, "communeSlug" = $2 WHERE id = $3`,
        [commune, communeSlug, r.id]
      )
    }
  }

  console.log(`\nSummary:`)
  console.log(`  Would update: ${found}`)
  console.log(`  Already set:  ${alreadySet}`)
  console.log(`  Skipped:      ${skipped}`)
  if (DRY_RUN) console.log(`\nRe-run with DRY_RUN = false to apply changes.`)

  await db.end()
}

main().catch(err => { console.error(err); process.exit(1) })

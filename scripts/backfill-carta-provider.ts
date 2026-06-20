/**
 * Backfill Restaurant.cartaProvider + website desde MapaProspecto.
 * Tres vías de match: importedSlug → googleMapsUrl → nombre.
 *
 * DRY_RUN=0 npx ts-node -r tsconfig-paths/register scripts/backfill-carta-provider.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN !== "0";
const ORDERING_PROVIDERS = new Set(['UberEats', 'Rappi', 'Justo', 'PedidosYa', 'Mercat'])

function needsUpdate(r: { cartaProvider: string | null; website: string | null }, mp: { provider: string | null; cartaUrl: string | null }) {
  return r.cartaProvider !== mp.provider || (!r.website && mp.cartaUrl)
}

async function applyUpdate(id: string, slug: string, mp: { provider: string | null; cartaUrl: string | null }, currentWebsite: string | null, via: string) {
  const isOrder = ORDERING_PROVIDERS.has(mp.provider ?? '')
  const data: any = { cartaProvider: mp.provider }
  if (!currentWebsite && mp.cartaUrl) {
    data.website = mp.cartaUrl
    data.websiteIsOrderUrl = isOrder
  }
  console.log(`  [${slug}] via ${via}: provider→${mp.provider}${!currentWebsite && mp.cartaUrl ? ` | website→${mp.cartaUrl}` : ''}`)
  if (!DRY_RUN) await prisma.restaurant.update({ where: { id }, data })
}

async function main() {
  // Traer todos los prospectos con datos útiles
  const prospectos = await prisma.mapaProspecto.findMany({
    where: { provider: { not: null } },
    select: { id: true, importedSlug: true, mapsUrl: true, name: true, provider: true, cartaUrl: true },
  })

  // Traer todos los restaurants feed (no demo, no showcase vacío)
  const restaurants = await prisma.restaurant.findMany({
    where: { isDemo: false },
    select: { id: true, slug: true, name: true, cartaProvider: true, website: true, googleMapsUrl: true },
  })

  // Índices de prospectos
  const bySlug = new Map(prospectos.filter(p => p.importedSlug).map(p => [p.importedSlug!, p]))
  const byMapsUrl = new Map(prospectos.filter(p => p.mapsUrl).map(p => [p.mapsUrl!.split('?')[0], p]))
  const byName = new Map(prospectos.map(p => [p.name.toLowerCase().trim(), p]))

  let updated = 0
  const seen = new Set<string>()

  for (const r of restaurants) {
    if (seen.has(r.id)) continue

    // 1. Match por importedSlug
    let mp = bySlug.get(r.slug)
    let via = 'slug'

    // 2. Match por googleMapsUrl
    if (!mp && r.googleMapsUrl) {
      const base = r.googleMapsUrl.split('?')[0]
      mp = byMapsUrl.get(base)
      via = 'mapsUrl'
    }

    // 3. Match por nombre exacto
    if (!mp) {
      mp = byName.get(r.name.toLowerCase().trim())
      via = 'nombre'
    }

    if (!mp) continue
    if (!needsUpdate(r, mp)) continue

    seen.add(r.id)
    await applyUpdate(r.id, r.slug, mp, r.website, via)
    updated++
  }

  console.log(`\n${DRY_RUN ? 'DRY_RUN —' : '✓'} ${updated} restaurants ${DRY_RUN ? 'a actualizar' : 'actualizados'}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1) })

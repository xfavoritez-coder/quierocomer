/**
 * Backfill Restaurant.cartaProvider y Restaurant.website desde MapaProspecto.
 * Cubre dos casos:
 *   A) importedSlug está seteado → link directo
 *   B) importedSlug es null pero el nombre/mapsUrl coincide → link por nombre
 *
 * Uso:
 *   DRY_RUN=0 npx ts-node -r tsconfig-paths/register scripts/backfill-carta-provider.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN !== "0";

const ORDERING_PROVIDERS = new Set(['UberEats', 'Rappi', 'Justo', 'PedidosYa', 'Mercat'])

async function main() {
  // Caso A: prospectos con importedSlug definido
  const linked = await prisma.mapaProspecto.findMany({
    where: { importedSlug: { not: null }, provider: { not: null } },
    select: { importedSlug: true, provider: true, cartaUrl: true },
  })

  console.log(`=== Caso A: prospectos con importedSlug (${linked.length}) ===`)
  let updatedA = 0

  for (const p of linked) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: p.importedSlug! },
      select: { id: true, name: true, cartaProvider: true, website: true },
    })
    if (!restaurant) continue

    const needsProvider = restaurant.cartaProvider !== p.provider
    const needsWebsite = !restaurant.website && p.cartaUrl
    const isOrderProvider = ORDERING_PROVIDERS.has(p.provider ?? '')
    const needsOrderUrl = needsWebsite && isOrderProvider

    if (!needsProvider && !needsWebsite) continue

    console.log(`  [${p.importedSlug}] provider: ${restaurant.cartaProvider ?? 'null'} → ${p.provider}${needsWebsite ? ` | website: null → ${p.cartaUrl}` : ''}`)

    if (!DRY_RUN) {
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: {
          ...(needsProvider ? { cartaProvider: p.provider } : {}),
          ...(needsWebsite ? { website: p.cartaUrl, websiteIsOrderUrl: isOrderProvider } : {}),
        },
      })
    }
    updatedA++
  }

  // Caso B: restaurants sin website y sin cartaProvider, buscar en prospectos por nombre
  console.log(`\n=== Caso B: restaurants sin website ni provider ===`)
  const orphans = await prisma.restaurant.findMany({
    where: { website: null, cartaProvider: null, isShowcase: false, isDemo: false },
    select: { id: true, slug: true, name: true },
  })

  console.log(`Restaurants sin website ni cartaProvider: ${orphans.length}`)
  let updatedB = 0

  for (const r of orphans) {
    // Buscar prospecto que coincida por nombre (case insensitive)
    const prospecto = await prisma.mapaProspecto.findFirst({
      where: {
        name: { equals: r.name, mode: 'insensitive' },
        cartaUrl: { not: null },
        provider: { not: null },
      },
      select: { provider: true, cartaUrl: true },
    })
    if (!prospecto) continue

    console.log(`  [${r.slug}] "${r.name}" → provider: ${prospecto.provider} | website: ${prospecto.cartaUrl}`)

    if (!DRY_RUN) {
      const isOrderProvider = ORDERING_PROVIDERS.has(prospecto.provider ?? '')
      await prisma.restaurant.update({
        where: { id: r.id },
        data: {
          cartaProvider: prospecto.provider,
          website: prospecto.cartaUrl,
          websiteIsOrderUrl: isOrderProvider,
        },
      })
    }
    updatedB++
  }

  if (DRY_RUN) {
    console.log(`\nDRY_RUN — A:${updatedA} + B:${updatedB} = ${updatedA + updatedB} a actualizar.`)
  } else {
    console.log(`\n✓ Caso A: ${updatedA} | Caso B: ${updatedB} | Total: ${updatedA + updatedB}`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1) })

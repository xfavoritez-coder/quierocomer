/**
 * Backfill Restaurant.cartaProvider desde MapaProspecto.provider
 * para los restaurantes ya importados vía /mapalocales.
 *
 * Uso:
 *   DRY_RUN=0 npx ts-node -r tsconfig-paths/register scripts/backfill-carta-provider.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN !== "0";

async function main() {
  // Traer todos los prospectos que tienen slug importado y provider definido
  const prospectos = await prisma.mapaProspecto.findMany({
    where: { importedSlug: { not: null }, provider: { not: null } },
    select: { importedSlug: true, provider: true },
  })

  console.log(`Prospectos con importedSlug y provider: ${prospectos.length}`)

  let updated = 0
  let skipped = 0

  for (const p of prospectos) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: p.importedSlug! },
      select: { id: true, cartaProvider: true },
    })

    if (!restaurant) { skipped++; continue }
    if (restaurant.cartaProvider === p.provider) { skipped++; continue }

    console.log(`  [${p.importedSlug}] ${restaurant.cartaProvider ?? 'null'} → ${p.provider}`)

    if (!DRY_RUN) {
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: { cartaProvider: p.provider },
      })
    }
    updated++
  }

  if (DRY_RUN) {
    console.log(`\nDRY_RUN — ${updated} restaurants a actualizar. Ejecutar con DRY_RUN=0 para aplicar.`)
  } else {
    console.log(`\n✓ ${updated} restaurants actualizados, ${skipped} sin cambios.`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1) })

/**
 * Mueve platos que son bebidas de marca industrial a una categoría "Bebestibles"
 * con dishType='drink', que el feed excluye a nivel SQL (c."dishType" != 'drink').
 * Los platos siguen activos y aparecen en la carta QR del restaurante.
 *
 * Uso (dry-run por defecto, DRY_RUN=0 para aplicar):
 *   npx ts-node -r tsconfig-paths/register scripts/deactivate-branded-drinks.ts
 *   DRY_RUN=0 npx ts-node -r tsconfig-paths/register scripts/deactivate-branded-drinks.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN !== "0";

const BRANDED_DRINK_RE = /\b(sprite|fanta|coca.?cola|pepsi|7\s*up|seven\s*up|gatorade|powerade|monster|red\s*bull|lipton|nestea|crush|inca\s*kola|bilz|pap[iy]|rc\s*cola|canada\s*dry|schweppes|agua\s*mineral|agua\s*de\s*manantial|evian|vittel|san\s*pellegrino|guaraná|guarana)\b/i

async function getOrCreateBebestiblesCategory(restaurantId: string): Promise<string> {
  // Buscar categoría existente que sea tipo drink y se llame Bebestibles (o similar)
  const existing = await prisma.category.findFirst({
    where: {
      restaurantId,
      dishType: 'drink',
      name: { in: ['Bebestibles', 'Bebidas', 'BEBIDAS', 'Bebestible', 'BEBESTIBLES'] },
    },
    select: { id: true },
  })
  if (existing) return existing.id

  // También aceptar cualquier categoría con dishType='drink'
  const anyDrink = await prisma.category.findFirst({
    where: { restaurantId, dishType: 'drink' },
    select: { id: true },
  })
  if (anyDrink) return anyDrink.id

  if (DRY_RUN) return '__dry_run__'

  // Crear categoría "Bebestibles" con dishType='drink'
  const maxPos = await prisma.category.aggregate({
    where: { restaurantId },
    _max: { position: true },
  })
  const cat = await prisma.category.create({
    data: {
      restaurantId,
      name: 'Bebestibles',
      dishType: 'drink',
      position: (maxPos._max.position ?? 0) + 1,
      isActive: true,
    },
    select: { id: true },
  })
  return cat.id
}

async function main() {
  const dishes = await prisma.dish.findMany({
    where: { isActive: true, deletedAt: null, photos: { isEmpty: false } },
    select: {
      id: true,
      name: true,
      categoryId: true,
      restaurantId: true,
      restaurant: { select: { name: true, slug: true } },
      category: { select: { name: true, dishType: true } },
    },
  })

  // Solo platos de marca en categorías que NO sean ya drink
  const toMove = dishes.filter(d =>
    BRANDED_DRINK_RE.test(d.name) && d.category.dishType !== 'drink'
  )

  console.log(`Platos de marca en categorías no-drink: ${toMove.length}`)

  // Agrupar por restaurante
  const byRestaurant = new Map<string, typeof toMove>()
  for (const d of toMove) {
    const key = d.restaurantId
    if (!byRestaurant.has(key)) byRestaurant.set(key, [])
    byRestaurant.get(key)!.push(d)
  }

  let moved = 0
  for (const [restaurantId, group] of byRestaurant) {
    const slug = group[0].restaurant.slug
    const catId = await getOrCreateBebestiblesCategory(restaurantId)
    console.log(`\n[${slug}] → categoría bebestibles (${catId === '__dry_run__' ? 'nueva' : catId})`)
    for (const d of group) {
      console.log(`  "${d.name}" (antes: ${d.category.name})`)
      if (!DRY_RUN && catId !== '__dry_run__') {
        await prisma.dish.update({
          where: { id: d.id },
          data: { categoryId: catId },
        })
        moved++
      }
    }
  }

  if (DRY_RUN) {
    console.log(`\nDRY_RUN — no se hicieron cambios. Ejecutar con DRY_RUN=0 para aplicar.`)
  } else {
    console.log(`\n✓ ${moved} platos movidos a categoría Bebestibles (dishType=drink).`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1) })

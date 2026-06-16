/**
 * Retroactivamente aplica inferFlavorTags y detección de dieta vegetariana
 * a los platos de un restaurante dado por slug.
 *
 * Uso: npx ts-node --skip-project scripts/backfill-oceanika-flavortags.ts
 * O con otro slug: SLUG=otro-slug npx ts-node --skip-project scripts/backfill-oceanika-flavortags.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SLUG = process.env.SLUG ?? "oceanika-sushi-ii";
const DRY_RUN = process.env.DRY_RUN === "1";

// ── Inline de inferFlavorTags (no importamos desde src/ para evitar problemas de paths) ──

const PREPARATIONS: [RegExp, string][] = [
  [/\bpanko\b/, 'panko'],
  [/\btempura\b/, 'tempura'],
  [/\bfrit[ao]s?\b/, 'frito'],
  [/\bgrill(ado|ed)?\b/, 'grillado'],
  [/\bplancha\b/, 'a la plancha'],
  [/\bal\s+vapor\b/, 'al vapor'],
  [/\bhorneado\b/, 'horneado'],
  [/\bgratinado\b/, 'gratinado'],
  [/\bahumado\b/, 'ahumado'],
  [/\bcrudo\b/, 'crudo'],
  [/\bsalteado\b/, 'salteado'],
  [/\brebozado\b/, 'rebozado'],
  [/\bteriyaki\b/, 'teriyaki'],
  [/\bcurry\b/, 'curry'],
]

function inferFlavorTags(name: string, _catName: string, _desc: string | null): string[] {
  // Solo el nombre del plato — la descripción tiene acompañamientos que causan falsos positivos
  const text = name.toLowerCase()
  const tags: string[] = []
  for (const [re, tag] of PREPARATIONS) if (re.test(text)) tags.push(tag)
  return tags
}

async function main() {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: SLUG },
    select: { id: true, name: true },
  })
  if (!restaurant) { console.error(`No encontré restaurante con slug: ${SLUG}`); process.exit(1) }
  console.log(`Restaurante: ${restaurant.name} (${SLUG})`)

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id, deletedAt: null },
    select: {
      id: true, name: true, description: true, dishDiet: true, flavorTags: true,
      category: { select: { name: true, dishType: true } },
    },
  })

  console.log(`${dishes.length} platos a procesar...\n`)

  let updated = 0
  for (const dish of dishes) {
    const catName = dish.category.name
    const isDrinkCat = dish.category.dishType === 'drink' ||
      /caf[eé]|t[eé]\b|infusi[oó]n|bebida|bebestible|jugo|trago/i.test(catName)

    const flavorTags = isDrinkCat ? [] : inferFlavorTags(dish.name, catName, dish.description)

    // Dieta: si el nombre del plato dice "vegetariano" o "vegano"
    const dishNameText = `${dish.name} ${dish.description ?? ''}`
    const isVeganDish = /\bvegan[ao]?\b|plant.based/i.test(dishNameText)
    const isVeggieDish = !isVeganDish && /\bveget[ae]rian[ao]?\b|vegetariano|veggie\b|sin carne/i.test(dishNameText)
    const newDiet = isVeganDish ? 'VEGAN' : isVeggieDish ? 'VEGETARIAN' : null  // null = no cambiar

    const currentTags = (dish as any).flavorTags as string[] ?? []
    const hasFlavorChange = JSON.stringify([...flavorTags].sort()) !== JSON.stringify([...currentTags].sort())
    const hasDietChange = newDiet && newDiet !== dish.dishDiet

    if (!hasFlavorChange && !hasDietChange) continue

    console.log(`  ${dish.name}`)
    if (hasFlavorChange) console.log(`    flavorTags: [${flavorTags.join(', ')}]`)
    if (hasDietChange) console.log(`    diet: ${dish.dishDiet} → ${newDiet}`)

    if (!DRY_RUN) {
      await prisma.dish.update({
        where: { id: dish.id },
        data: {
          ...(hasFlavorChange && { flavorTags }),
          ...(hasDietChange && { dishDiet: newDiet as any }),
        },
      })
      updated++
    }
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN]' : 'Actualizado'}: ${updated} platos`)
}

main().catch(console.error).finally(() => prisma.$disconnect())

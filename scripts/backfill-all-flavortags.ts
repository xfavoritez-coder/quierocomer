/**
 * Re-computa flavorTags para TODOS los platos activos de todos los restaurantes.
 * Usa la misma lógica que inferFlavorTags en categories.ts.
 *
 * Uso:
 *   npx ts-node --skip-project scripts/backfill-all-flavortags.ts
 *   DRY_RUN=1 npx ts-node --skip-project scripts/backfill-all-flavortags.ts
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const DRY_RUN = process.env.DRY_RUN === "1"

// ── Preparaciones + ingredientes (sincronizado con categories.ts inferFlavorTags) ──
const PREPARATIONS: [RegExp, string][] = [
  [/\bpanko\b/,              'panko'],
  [/\btempura\b/,            'tempura'],
  [/\bfrit[ao]s?\b/,         'frito'],
  [/\bgrill(ado|ed)?\b/,     'grillado'],
  [/\bplancha\b/,            'a la plancha'],
  [/\bal\s+vapor\b/,         'al vapor'],
  [/\bhorneado\b/,           'horneado'],
  [/\bgratinado\b/,          'gratinado'],
  [/\bahumado\b/,            'ahumado'],
  [/\bcrudo\b/,              'crudo'],
  [/\bsalteado\b/,           'salteado'],
  [/\brebozado\b/,           'rebozado'],
  [/\bteriyaki\b/,           'teriyaki'],
  [/\bcurry\b/,              'curry'],
]

const INGREDIENTS: [RegExp, string][] = [
  [/\bpollo\b|\bpechuga\b|\bmuslo\b|\balitas?\b|\bwings?\b|\bnuggets?\b|\btenders?\b|\bbroaster\b|\bkaraage\b/, 'pollo'],
  [/\bcarne\b|\bvacuno\b|\bbistec\b|\bbife\b|\bcostill|\bplateada\b|\bmechada\b|\blomo\s+saltado\b|\basado\s+de\s+tira\b/, 'carne'],
  [/\bpescado\b|\bmerluza\b|\breineta\b|\bcongrio\b|\bcorvina\b|\btrucha\b|\bsalm[oó]n\b|\bat[uú]n\b|\blenguado\b|\bcojinova\b|\btilapia\b/, 'pescado'],
]

function inferFlavorTags(name: string, isDrink: boolean): string[] {
  if (isDrink) return []
  const text = name.toLowerCase()
  const tags: string[] = []
  for (const [re, tag] of PREPARATIONS) if (re.test(text)) tags.push(tag)
  for (const [re, tag] of INGREDIENTS) if (re.test(text)) tags.push(tag)
  return tags
}

async function main() {
  console.log(`Modo: ${DRY_RUN ? 'DRY RUN (sin guardar)' : 'REAL (guardando en BD)'}`)

  const dishes = await prisma.dish.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      flavorTags: true,
      category: { select: { dishType: true, name: true } },
    },
  })

  console.log(`Total platos: ${dishes.length}`)

  let updated = 0
  let unchanged = 0
  const byTag: Record<string, number> = {}

  for (const dish of dishes) {
    const isDrink = dish.category.dishType === 'drink' ||
      /caf[eé]|t[eé]\b|infusi[oó]n|bebida|bebestible|jugo|trago/i.test(dish.category.name)

    const newTags = inferFlavorTags(dish.name, isDrink)
    const currentTags = Array.isArray(dish.flavorTags) ? (dish.flavorTags as string[]) : []

    const hasChange = JSON.stringify([...newTags].sort()) !== JSON.stringify([...currentTags].sort())

    for (const t of newTags) byTag[t] = (byTag[t] ?? 0) + 1

    if (!hasChange) { unchanged++; continue }

    if (!DRY_RUN) {
      await prisma.dish.update({ where: { id: dish.id }, data: { flavorTags: newTags } })
    }
    updated++
  }

  console.log(`\nActualizados: ${updated} | Sin cambio: ${unchanged}`)
  console.log('\nTags por frecuencia:')
  Object.entries(byTag).sort((a, b) => b[1] - a[1]).forEach(([tag, count]) => {
    console.log(`  ${tag}: ${count}`)
  })
}

main().catch(console.error).finally(() => prisma.$disconnect())

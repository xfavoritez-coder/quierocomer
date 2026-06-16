/**
 * Detecta y setea cuisineTag en todas las categorías existentes.
 * Uso: npx ts-node --skip-project scripts/backfill-cuisine-tags.ts
 * DRY_RUN=1: solo muestra cambios sin guardar
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const DRY_RUN = process.env.DRY_RUN === "1"

const CUISINE_DETECT_PATTERNS: Array<{ pattern: RegExp; cuisine: string }> = [
  { pattern: /\bperuana?s?\b|\bperuano\b/i,        cuisine: 'Peruana' },
  { pattern: /\bchina?s?\b|\bchinos?\b/i,          cuisine: 'China' },
  { pattern: /\bthai\b|\btailand[eé]/i,            cuisine: 'Thai' },
  { pattern: /\bindias?\b|\bindio\b/i,              cuisine: 'India' },
  { pattern: /\bjaponesa?s?\b|\bjapon[eé]s\b/i,   cuisine: 'Japonesa' },
  { pattern: /\bitaliana?s?\b|\bitaliano\b/i,       cuisine: 'Italiana' },
  { pattern: /\bgriega?s?\b|\bgriego\b/i,          cuisine: 'Griega' },
]

function detectCuisineTag(catName: string): string | null {
  for (const { pattern, cuisine } of CUISINE_DETECT_PATTERNS) {
    if (pattern.test(catName)) return cuisine
  }
  return null
}

async function main() {
  const cats = await prisma.category.findMany({
    select: { id: true, name: true, cuisineTag: true, restaurant: { select: { name: true } } },
  })

  console.log(`${cats.length} categorías a revisar...\n`)

  let updated = 0
  for (const cat of cats) {
    const newTag = detectCuisineTag(cat.name)
    if (newTag === (cat.cuisineTag ?? null)) continue

    console.log(`  [${cat.restaurant.name}] "${cat.name}"`)
    console.log(`    cuisineTag: ${cat.cuisineTag ?? 'null'} → ${newTag}`)

    if (!DRY_RUN) {
      await prisma.category.update({
        where: { id: cat.id },
        data: { cuisineTag: newTag },
      })
      updated++
    }
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN]' : 'Actualizado'}: ${updated} categorías`)
}

main().catch(console.error).finally(() => prisma.$disconnect())

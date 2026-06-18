import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Restaurantes del feed
  const restaurants = await prisma.restaurant.findMany({
    where: { isActive: true, isDemo: false, lat: { not: null }, lng: { not: null },
      OR: [{ googleMapsUrl: { not: null }, googleRating: { not: null } }, { isShowcase: true }] },
    select: { id: true },
  })
  const ids = restaurants.map(r => r.id)

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: { in: ids }, isActive: true, deletedAt: null, photos: { isEmpty: false } },
    select: {
      id: true, name: true, txDishType: true, txCuisine: true, txMealSlot: true,
      txIngredient: true, dishDiet: true, txEstilo: true,
      restaurant: { select: { name: true, slug: true } },
    },
  })

  console.log(`\n═══ CALIDAD TAXONOMÍA — ${dishes.length} platos con foto en ${ids.length} restaurantes ═══\n`)

  // ── 1. Cobertura ──────────────────────────────────────────────
  const sinTipo    = dishes.filter(d => d.txDishType.length === 0)
  const sinCocina  = dishes.filter(d => d.txCuisine.length === 0)
  const sinSlot    = dishes.filter(d => d.txMealSlot.length === 0)
  const sinIngred  = dishes.filter(d => d.txIngredient.length === 0)
  const sinDiet    = dishes.filter(d => !d.dishDiet)

  console.log('── Cobertura ──')
  console.log(`  Sin dishType:      ${sinTipo.length.toString().padStart(5)} (${(sinTipo.length/dishes.length*100).toFixed(1)}%)`)
  console.log(`  Sin cuisine:       ${sinCocina.length.toString().padStart(5)} (${(sinCocina.length/dishes.length*100).toFixed(1)}%)  ← normal si no aplica`)
  console.log(`  Sin mealSlot:      ${sinSlot.length.toString().padStart(5)} (${(sinSlot.length/dishes.length*100).toFixed(1)}%)`)
  console.log(`  Sin ingredient:    ${sinIngred.length.toString().padStart(5)} (${(sinIngred.length/dishes.length*100).toFixed(1)}%)`)
  console.log(`  Sin diet:          ${sinDiet.length.toString().padStart(5)} (${(sinDiet.length/dishes.length*100).toFixed(1)}%)`)

  // ── 2. Distribución diet ──────────────────────────────────────
  const dietCount: Record<string, number> = {}
  for (const d of dishes) {
    const k = d.dishDiet ?? 'null'
    dietCount[k] = (dietCount[k] || 0) + 1
  }
  console.log('\n── Distribución diet ──')
  for (const [k, v] of Object.entries(dietCount).sort((a,b) => b[1]-a[1]))
    console.log(`  ${k.padEnd(14)} ${v.toString().padStart(5)}  (${(v/dishes.length*100).toFixed(1)}%)`)

  // ── 3. Top dishTypes ─────────────────────────────────────────
  const typeCount: Record<string, number> = {}
  for (const d of dishes) for (const t of d.txDishType) typeCount[t] = (typeCount[t]||0)+1
  console.log('\n── Top 25 dishTypes ──')
  Object.entries(typeCount).sort((a,b)=>b[1]-a[1]).slice(0,25)
    .forEach(([k,v]) => console.log(`  ${k.padEnd(22)} ${v.toString().padStart(5)}`))

  // ── 4. Anomalías VEGAN sospechosas ───────────────────────────
  const carneKeywords = /\b(carne|pollo|vacuno|cerdo|costill|chorizo|lomito|churrasco|mechada|vienesa|jamon|jamón|longaniza|tocino|bacon|salmon|salmón|atun|atún|camar|pulpo|mariscos|pescado|reineta|congrio|jaiba|ostion|ostión|mejillon)\b/i
  const veganSospechosos = dishes.filter(d =>
    d.dishDiet === 'VEGAN' && carneKeywords.test(d.name)
  )
  console.log(`\n── VEGAN sospechosos (nombre contiene carne/pescado): ${veganSospechosos.length} ──`)
  veganSospechosos.slice(0,20).forEach(d =>
    console.log(`  [${d.restaurant.name}] ${d.name}`)
  )

  // ── 5. Anomalías OMNIVORE con nombre vegano ───────────────────
  const veganNombre = /\b(vegano|vegan|vegana|plant.based|sin carne|sin animal)\b/i
  const omniVeganNombre = dishes.filter(d =>
    d.dishDiet === 'OMNIVORE' && veganNombre.test(d.name)
  )
  console.log(`\n── OMNIVORE con "vegano" en el nombre: ${omniVeganNombre.length} ──`)
  omniVeganNombre.slice(0,15).forEach(d =>
    console.log(`  [${d.restaurant.name}] ${d.name}`)
  )

  // ── 6. "extra" posiblemente mal clasificados ──────────────────
  const extraSospechosos = dishes.filter(d =>
    d.txDishType.includes('extra') &&
    !/^(salsa|extra de|adicional|porción de|porcion de|dip|ají|ajo extra|jengibre|soya|tamarindo|chimichurri|guacamole|mayo|ketchup|mostaza|golf)/i.test(d.name)
  )
  console.log(`\n── "extra" posiblemente mal clasificados: ${extraSospechosos.length} ──`)
  extraSospechosos.slice(0,20).forEach(d =>
    console.log(`  [${d.restaurant.name}] ${d.name} | ing: ${d.txIngredient.join(',')||'-'}`)
  )

  // ── 7. Platos sin tipo con nombre reconocible ─────────────────
  const recognizable = /\b(hamburguesa|pizza|sushi|empanada|taco|wrap|ensalada|pasta|arroz|pollo|sándwich|sandwich|waffle|pancake|helado|torta|café|latte|jugo|cerveza|vino)\b/i
  const sinTipoRecon = sinTipo.filter(d => recognizable.test(d.name))
  console.log(`\n── Sin tipo pero nombre reconocible (muestra de 20): ${sinTipoRecon.length} total ──`)
  sinTipoRecon.slice(0,20).forEach(d =>
    console.log(`  [${d.restaurant.name}] ${d.name}`)
  )
}

main().catch(console.error).finally(() => prisma.$disconnect())

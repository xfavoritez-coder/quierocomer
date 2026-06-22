/**
 * 1. Oculta del feed todos los platos de Socios de la Pizza excepto la lista aprobada
 * 2. Añade "calzone" como txDishType en todos los calzones de la BD
 */
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
config({ path: '.env.local' })

const prisma = new PrismaClient()

// IDs extraídos del check previo
const RESTAURANT_ID = 'cmqdyf5tp00glenvscnk526gu'
const POSTRES_CAT_ID = 'cmqdyg1ct00kienvsk94yykgs'   // Dulces y postres (dishType=dessert)

// Nombres EXACTOS de los platos que deben quedar visibles
const KEEP_VISIBLE_NAMES = [
  'Pizza Margarita',
  'Pizza Chilena',
  'Pizza Pepperoni',
  'Pizza Tocino & Salsa BBQ',
  'Pizza Fugazzetta',
  'Pizza El Socio',
  'Calzone Margarita Individual',
  'Calzone Camarones al Ajillo Individual',
  'Palitos de Mantequilla al Ajo',
]

async function main() {
  // ── 1. Obtener todos los platos del restaurante (sin deleted) ──────────────
  const dishes = await prisma.dish.findMany({
    where: { restaurantId: RESTAURANT_ID, deletedAt: null },
    select: { id: true, name: true, categoryId: true, hiddenFromFeed: true },
  })

  // ── 2. Clasificar: visibles vs a ocultar ──────────────────────────────────
  const toShow: string[] = []   // IDs que DEBEN quedar visibles
  const toHide: string[] = []   // IDs que se ocultarán

  for (const d of dishes) {
    const isPostres = d.categoryId === POSTRES_CAT_ID
    const isInList = KEEP_VISIBLE_NAMES.some(n => n.toLowerCase() === d.name.toLowerCase())

    if (isPostres || isInList) {
      toShow.push(d.id)
    } else {
      toHide.push(d.id)
    }
  }

  console.log(`\nSOCIOS DE LA PIZZA — plan de cambios:`)
  console.log(`  Quedarán visibles: ${toShow.length} platos`)
  console.log(`  Se ocultarán:      ${toHide.length} platos`)

  // Preview de qué se va a ocultar
  const hideNames = dishes.filter(d => toHide.includes(d.id)).map(d => d.name)
  console.log('\n  Ocultar:')
  hideNames.forEach(n => console.log('    -', n))

  const showNames = dishes.filter(d => toShow.includes(d.id)).map(d => d.name)
  console.log('\n  Mantener visibles:')
  showNames.forEach(n => console.log('    +', n))

  // ── 3. Aplicar ────────────────────────────────────────────────────────────
  const hideResult = await prisma.dish.updateMany({
    where: { id: { in: toHide } },
    data: { hiddenFromFeed: true },
  })
  const showResult = await prisma.dish.updateMany({
    where: { id: { in: toShow } },
    data: { hiddenFromFeed: false },
  })
  console.log(`\n✓ Ocultados: ${hideResult.count} | Visibles: ${showResult.count}`)

  // ── 4. Calzone en toda la BD ───────────────────────────────────────────────
  // Buscar todos los platos con "calzon" en el nombre que no tengan ya "calzone" en txDishType
  const calzoneDishes = await prisma.dish.findMany({
    where: {
      deletedAt: null,
      name: { contains: 'calzon', mode: 'insensitive' },
    },
    select: { id: true, name: true, txDishType: true, restaurantId: true },
  })

  console.log(`\nCALZONES EN TODA LA BD: ${calzoneDishes.length} platos encontrados`)

  let calzoneUpdated = 0
  for (const d of calzoneDishes) {
    const current = d.txDishType ?? []
    if (!current.includes('calzone')) {
      // Insertar "calzone" al inicio, manteniendo el resto
      const newTypes = ['calzone', ...current.filter(t => t !== 'pizza')]
      await prisma.dish.update({
        where: { id: d.id },
        data: { txDishType: newTypes },
      })
      console.log(`  ✓ ${d.name} → [${newTypes.join(', ')}]`)
      calzoneUpdated++
    } else {
      console.log(`  · ${d.name} → ya tiene calzone`)
    }
  }
  console.log(`\n✓ Calzones actualizados: ${calzoneUpdated}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Tipos que son bebida pura y NO deben salir en el feed de platos
const DRINK_TYPES = new Set(['bebida', 'drink', 'extra', 'té', 'jugo', 'agua', 'cerveza', 'vino', 'licor', 'cocktail', 'smoothie'])

async function main() {
  const r = await prisma.restaurant.findFirst({ where: { slug: 'intburger' }, select: { id: true, name: true } })
  if (!r) { console.log('No encontrado'); return }

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: r.id, isActive: true, deletedAt: null },
    select: { id: true, name: true, txDishType: true }
  })

  // Buscar todos los platos donde txDishType son TODOS de tipo bebida/drink
  const toFix = dishes.filter(d => {
    const types = (d.txDishType ?? []) as string[]
    return types.length > 0 && types.every(t => DRINK_TYPES.has(t))
  })

  console.log(`Platos a corregir (solo bebidas): ${toFix.length}`)
  for (const d of toFix) {
    console.log(` - ${d.name} [${d.txDishType}]`)
  }

  // Actualizar todos a ["bebida"]
  if (toFix.length > 0) {
    for (const d of toFix) {
      // Si ya son solo bebida, asegurar que contengan "bebida"
      const types = d.txDishType as string[]
      if (!types.includes('bebida')) {
        await prisma.dish.update({
          where: { id: d.id },
          data: { txDishType: ['bebida'] }
        })
        console.log(`  ✓ ${d.name}: ${JSON.stringify(types)} → ["bebida"]`)
      } else {
        console.log(`  ✓ ${d.name}: ya tiene "bebida"`)
      }
    }
  }

  // También buscar platos sin txDishType que por nombre son claramente bebidas
  const sinTipo = dishes.filter(d => (d.txDishType as string[]).length === 0)
  console.log(`\nSin txDishType: ${sinTipo.length}`)
  for (const d of sinTipo) {
    console.log(` - ${d.name}`)
  }
}

main().finally(() => prisma.$disconnect())

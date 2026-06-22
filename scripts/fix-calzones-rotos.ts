import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
  const dishes = await prisma.dish.findMany({
    where: { deletedAt: null, name: { contains: 'calzon', mode: 'insensitive' } },
    select: { id: true, name: true, txDishType: true },
  })

  console.log('Platos con "calzon" en el nombre:')
  for (const d of dishes) {
    console.log(' ', d.name, '->', d.txDishType)
  }

  // Calzones rotos = postre chileno, no calzone italiano — quitar tipo 'calzone'
  const rotos = dishes.filter(d => /calzon(es)?\s+rot/i.test(d.name))
  console.log(`\nCalzones rotos a corregir: ${rotos.length}`)
  for (const d of rotos) {
    const newTypes = (d.txDishType ?? []).filter(t => t !== 'calzone')
    await prisma.dish.update({ where: { id: d.id }, data: { txDishType: newTypes } })
    console.log(`  ✓ ${d.name}: [${d.txDishType?.join(', ')}] → [${newTypes.join(', ')}]`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())

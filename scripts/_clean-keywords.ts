import { PrismaClient } from '@prisma/client'
import { extractKeywords } from '../src/app/a/lib/keywords'

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL })

// Words that should never be in keywordScores
const JUNK = new Set([
  'salsa', 'salsas', 'blanco', 'blanca', 'negro', 'negra', 'rojo', 'roja', 'verde',
  'amarillo', 'amarilla', 'dorado', 'dorada',
  'base', 'envuelto', 'envuelta', 'cubierto', 'cubierta', 'relleno', 'rellena',
  'pan', 'masa', 'harina', 'aceite', 'sal',
  'arroz', 'papas', 'papa', 'queso', 'crema', 'leche', 'huevo', 'huevos',
  'carne', 'pollo', 'pescado', 'verduras', 'lechuga', 'tomate', 'cebolla',
  'casa', 'toque', 'punto', 'opcion',
  'coronado', 'coronada', 'especial', 'original', 'clasico', 'clasica',
])

async function main() {
  const users = await prisma.feedUser.findMany({
    select: { id: true, keywordScores: true },
  })

  let cleaned = 0
  for (const user of users) {
    const scores = (user.keywordScores as Record<string, number>) ?? {}
    const newScores: Record<string, number> = {}
    let changed = false

    for (const [kw, score] of Object.entries(scores)) {
      if (JUNK.has(kw)) {
        changed = true
        console.log(`  Removing "${kw}" from user ${user.id}`)
      } else {
        newScores[kw] = score
      }
    }

    if (changed) {
      await prisma.feedUser.update({
        where: { id: user.id },
        data: { keywordScores: newScores },
      })
      cleaned++
    }
  }

  console.log(`Cleaned ${cleaned} users`)
  await prisma.$disconnect()
}
main()

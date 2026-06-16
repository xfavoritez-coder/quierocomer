import { config } from 'dotenv'
config({ path: '.env.local' })
import { prisma } from '../src/lib/prisma'

async function main() {
  const r = await prisma.mapaProspecto.findFirst({ select: { id: true, dismissed: true } })
  console.log('Campo dismissed:', r)
  await prisma.$disconnect()
}
main()

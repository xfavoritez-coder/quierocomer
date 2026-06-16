import { config } from 'dotenv'
config({ path: '.env.local' })
import { prisma } from '../src/lib/prisma'

async function main() {
  const p = await prisma.mapaProspecto.findFirst({
    where: { name: { contains: 'Shaka' } },
    select: { id: true, name: true, importedSlug: true }
  })
  console.log('Prospecto actual:', JSON.stringify(p))

  if (p && !p.importedSlug) {
    await prisma.mapaProspecto.update({
      where: { id: p.id },
      data: { importedSlug: 'shaka-burger' }
    })
    console.log('✓ importedSlug seteado a shaka-burger')
  } else {
    console.log('Ya tiene importedSlug:', p?.importedSlug)
  }

  await prisma.$disconnect()
}

main()

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import bcrypt from 'bcryptjs'
config({ path: '.env.local' })

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash('alleriaitalia', 10)
  const updated = await prisma.restaurantOwner.update({
    where: { email: 'gomezlowry@gmail.com' },
    data: { passwordHash: hash },
    select: { email: true, name: true }
  })
  console.log('Contraseña actualizada para:', updated.email, '/', updated.name)
}

main().catch(console.error).finally(() => prisma.$disconnect())

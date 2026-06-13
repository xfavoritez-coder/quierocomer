import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL })

async function main() {
  const total = await prisma.dish.count({ where: { isActive: true, deletedAt: null } })
  const withEmbedding = await prisma.dish.count({ where: { isActive: true, deletedAt: null, embeddingHash: { not: null } } })
  const withPhoto = await prisma.dish.count({ where: { isActive: true, deletedAt: null, photos: { isEmpty: false }, embeddingHash: { not: null } } })
  console.log(`Total: ${total} | Con embedding: ${withEmbedding} | Con embedding + foto: ${withPhoto}`)
  await prisma.$disconnect()
}
main()

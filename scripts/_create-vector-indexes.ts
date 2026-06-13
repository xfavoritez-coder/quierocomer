import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL })

async function main() {
  // HNSW index for text embeddings (cosine distance)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_dish_embedding_hnsw
    ON "Dish" USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
  `)
  console.log('✓ HNSW index for text embeddings created')

  // HNSW index for image embeddings (cosine distance)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_dish_image_embedding_hnsw
    ON "Dish" USING hnsw ("imageEmbedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
  `)
  console.log('✓ HNSW index for image embeddings created')

  // HNSW index for user gusto vector
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_feeduser_gusto_hnsw
    ON "FeedUser" USING hnsw ("gustoVector" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
  `)
  console.log('✓ HNSW index for user gusto vector created')

  await prisma.$disconnect()
}
main()

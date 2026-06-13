/**
 * Generate text embeddings for all dishes using OpenAI text-embedding-3-small.
 * Idempotent: only processes dishes where embeddingHash differs from current text.
 *
 * Usage: OPENAI_API_KEY=sk-... npx tsx scripts/generate-embeddings.ts
 */

import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL })

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const EMBEDDING_MODEL = 'text-embedding-3-small'
const BATCH_SIZE = 50 // OpenAI supports up to 2048 inputs per request
const DIMENSIONS = 1536

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY environment variable')
  process.exit(1)
}

function hash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)
}

function buildEmbeddingText(dish: any): string {
  const parts: string[] = []
  if (dish.name) parts.push(dish.name)
  if (dish.description) parts.push(dish.description)
  if (dish.category?.name) parts.push(dish.category.name)
  if (dish.restaurant?.name) parts.push(dish.restaurant.name)
  if (dish.restaurant?.address) {
    // Extract commune from address
    const commune = dish.restaurant.address.split(',').slice(-2, -1)[0]?.trim()
    if (commune) parts.push(commune)
  }
  if (dish.dishDiet !== 'OMNIVORE') parts.push(dish.dishDiet.toLowerCase())
  if (dish.isSpicy) parts.push('picante')
  if (dish.flavorTags?.length > 0) parts.push(dish.flavorTags.join(', '))
  return parts.join('. ')
}

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: DIMENSIONS,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.data.map((d: any) => d.embedding)
}

async function main() {
  // Get all active dishes with photos
  const dishes = await prisma.dish.findMany({
    where: { isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      dishDiet: true,
      isSpicy: true,
      flavorTags: true,
      photos: true,
      category: { select: { name: true } },
      restaurant: { select: { name: true, address: true } },
    },
  })

  console.log(`Total dishes: ${dishes.length}`)

  // Build texts and check which need processing
  const toProcess: { id: string; text: string; textHash: string }[] = []

  for (const dish of dishes) {
    const text = buildEmbeddingText(dish)
    const textHash = hash(text)

    // Check if already processed with same hash
    const existing = await prisma.dish.findUnique({
      where: { id: dish.id },
      select: { embeddingHash: true },
    })

    if (existing?.embeddingHash !== textHash) {
      toProcess.push({ id: dish.id, text, textHash })
    }
  }

  console.log(`Need embedding: ${toProcess.length} (${dishes.length - toProcess.length} already up to date)`)

  if (toProcess.length === 0) {
    console.log('Nothing to do!')
    await prisma.$disconnect()
    return
  }

  // Process in batches
  let processed = 0
  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE)
    const texts = batch.map(b => b.text)

    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} dishes...`)

    const embeddings = await getEmbeddings(texts)

    // Save each embedding
    for (let j = 0; j < batch.length; j++) {
      const { id, text, textHash } = batch[j]
      const embeddingStr = `[${embeddings[j].join(',')}]`

      await prisma.$executeRawUnsafe(
        `UPDATE "Dish" SET embedding = $1::vector, "embeddingText" = $2, "embeddingHash" = $3 WHERE id = $4`,
        embeddingStr,
        text,
        textHash,
        id,
      )
      processed++
    }

    console.log(`  ✓ ${processed}/${toProcess.length} done`)

    // Rate limit: max 3000 RPM for embeddings
    if (i + BATCH_SIZE < toProcess.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  console.log(`\nDone! ${processed} dishes embedded.`)
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

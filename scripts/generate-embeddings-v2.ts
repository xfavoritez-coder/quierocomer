/**
 * Generate text embeddings for all dishes using OpenAI text-embedding-3-small.
 * Optimized: fetches all dishes + hashes in ONE query, then batches to OpenAI.
 *
 * Usage: npx tsx scripts/generate-embeddings-v2.ts
 * Requires OPENAI_API_KEY in .env.local
 */

import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL })
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const BATCH_SIZE = 100

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY')
  process.exit(1)
}

function hash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)
}

function buildText(dish: any): string {
  const parts: string[] = []
  if (dish.name) parts.push(dish.name)
  if (dish.description) parts.push(dish.description)
  if (dish.category?.name) parts.push(dish.category.name)
  if (dish.restaurant?.name) parts.push(dish.restaurant.name)
  if (dish.restaurant?.address) {
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
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: texts, dimensions: 1536 }),
  })
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.data.map((d: any) => d.embedding)
}

async function main() {
  // ONE query to get all dishes with their current hash
  const dishes = await prisma.dish.findMany({
    where: { isActive: true, deletedAt: null },
    select: {
      id: true, name: true, description: true, dishDiet: true,
      isSpicy: true, flavorTags: true, embeddingHash: true,
      category: { select: { name: true } },
      restaurant: { select: { name: true, address: true } },
    },
  })

  console.log(`Total dishes: ${dishes.length}`)

  // Filter to only those needing (re)processing
  const toProcess: { id: string; text: string; textHash: string }[] = []
  for (const dish of dishes) {
    const text = buildText(dish)
    const textHash = hash(text)
    if (dish.embeddingHash !== textHash) {
      toProcess.push({ id: dish.id, text, textHash })
    }
  }

  console.log(`Need embedding: ${toProcess.length} (${dishes.length - toProcess.length} up to date)`)

  if (toProcess.length === 0) {
    console.log('Nothing to do!')
    await prisma.$disconnect()
    return
  }

  let processed = 0
  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE)
    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(toProcess.length / BATCH_SIZE)}: ${batch.length} dishes...`)

    try {
      const embeddings = await getEmbeddings(batch.map(b => b.text))

      // Reconnect before writing to avoid stale connections
      await prisma.$disconnect()
      await prisma.$connect()

      for (let j = 0; j < batch.length; j++) {
        const { id, text, textHash } = batch[j]
        const embStr = `[${embeddings[j].join(',')}]`
        await prisma.$executeRawUnsafe(
          `UPDATE "Dish" SET embedding = $1::vector, "embeddingText" = $2, "embeddingHash" = $3 WHERE id = $4`,
          embStr, text, textHash, id,
        )
        processed++
      }
      console.log(`  ✓ ${processed}/${toProcess.length}`)
    } catch (e: any) {
      console.error(`  ✗ Batch error: ${e.message}. Reconnecting...`)
      try { await prisma.$disconnect() } catch {}
      await new Promise(r => setTimeout(r, 3000))
      await prisma.$connect()
      i -= BATCH_SIZE // retry this batch
      continue
    }

    if (i + BATCH_SIZE < toProcess.length) await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\nDone! ${processed} dishes embedded.`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

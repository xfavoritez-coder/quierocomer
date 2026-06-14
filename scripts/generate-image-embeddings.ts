/**
 * Generate image embeddings for dish photos using CLIP (via Hugging Face API).
 * Idempotent: only processes dishes where imageEmbeddingHash differs.
 *
 * Usage: HF_API_KEY=hf_... npx tsx scripts/generate-image-embeddings.ts
 * Alternative: OPENAI_API_KEY=sk-... npx tsx scripts/generate-image-embeddings.ts --openai
 *
 * Note: Hugging Face free tier is rate-limited. For production, use OpenAI CLIP or run locally.
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL })

const HF_API_KEY = process.env.HF_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const useOpenAI = process.argv.includes('--openai')

if (!HF_API_KEY && !OPENAI_API_KEY) {
  console.error('Missing HF_API_KEY or OPENAI_API_KEY environment variable')
  process.exit(1)
}

function hash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)
}

async function getImageEmbeddingHF(imageUrl: string): Promise<number[] | null> {
  try {
    // Download image
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) return null
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

    // Send to HF CLIP model
    const res = await fetch(
      'https://api-inference.huggingface.co/pipeline/feature-extraction/openai/clip-vit-base-patch32',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_API_KEY}`,
          'Content-Type': 'application/octet-stream',
        },
        body: imgBuffer,
      },
    )

    if (!res.ok) {
      console.warn(`  HF API error ${res.status}: ${await res.text()}`)
      return null
    }

    const data = await res.json()
    // CLIP ViT-B/32 outputs 512-dim vector
    return Array.isArray(data) ? data : data[0]
  } catch (e) {
    console.warn(`  Error: ${(e as Error).message}`)
    return null
  }
}

async function getImageEmbeddingOpenAI(imageUrl: string): Promise<number[] | null> {
  // OpenAI doesn't have a direct image embedding API for CLIP,
  // but we can use the vision model to describe the image and embed the description.
  // For production, use a dedicated CLIP service.
  // This is a fallback that creates a text embedding from a vision description.
  try {
    // Get description from vision model
    const descRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this dish photo in 2 sentences focusing on: ingredients visible, cooking style, presentation, colors, and what type of food it is. Be specific. Spanish.' },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
          ],
        }],
        max_tokens: 100,
      }),
    })

    if (!descRes.ok) return null
    const descData = await descRes.json()
    const description = descData.choices[0]?.message?.content || ''

    // Embed the description
    const embRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: description,
        dimensions: 512,
      }),
    })

    if (!embRes.ok) return null
    const embData = await embRes.json()
    return embData.data[0].embedding
  } catch (e) {
    console.warn(`  Error: ${(e as Error).message}`)
    return null
  }
}

async function main() {
  const dishes = await prisma.dish.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      photos: { isEmpty: false },
    },
    select: { id: true, name: true, photos: true, imageEmbeddingHash: true },
  })

  console.log(`Total dishes with photos: ${dishes.length}`)

  // Check which need processing (single query, no N+1)
  const toProcess: { id: string; name: string; photoUrl: string; photoHash: string }[] = []

  for (const dish of dishes) {
    const photoUrl = dish.photos[0]
    if (!photoUrl) continue
    const photoHash = hash(photoUrl)

    if (dish.imageEmbeddingHash !== photoHash) {
      toProcess.push({ id: dish.id, name: dish.name, photoUrl, photoHash })
    }
  }

  console.log(`Need image embedding: ${toProcess.length}`)
  if (toProcess.length === 0) {
    console.log('Nothing to do!')
    await prisma.$disconnect()
    return
  }

  const getEmbedding = useOpenAI ? getImageEmbeddingOpenAI : getImageEmbeddingHF
  const provider = useOpenAI ? 'OpenAI (vision+embed)' : 'HuggingFace CLIP'
  console.log(`Using: ${provider}\n`)

  let processed = 0
  let failed = 0

  for (const { id, name, photoUrl, photoHash } of toProcess) {
    console.log(`${processed + failed + 1}/${toProcess.length} ${name}`)

    const embedding = await getEmbedding(photoUrl)

    if (embedding) {
      const embeddingStr = `[${embedding.join(',')}]`
      await prisma.$executeRawUnsafe(
        `UPDATE "Dish" SET "imageEmbedding" = $1::vector, "imageEmbeddingHash" = $2 WHERE id = $3`,
        embeddingStr,
        photoHash,
        id,
      )
      processed++
      console.log(`  ✓ ${embedding.length}-dim vector`)
    } else {
      failed++
      console.log(`  ✗ Failed`)
    }

    // Rate limit
    await new Promise(r => setTimeout(r, useOpenAI ? 300 : 1000))
  }

  console.log(`\nDone! ${processed} embedded, ${failed} failed.`)
  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

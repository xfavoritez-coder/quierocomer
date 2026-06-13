/**
 * Vector similarity queries using pgvector.
 * Uses raw SQL because Prisma doesn't support vector type natively.
 */

import { prisma } from '@/lib/prisma'

type SimilarDish = {
  id: string
  name: string
  similarity: number
}

/**
 * Find dishes most similar to a given embedding vector.
 * Uses cosine distance (<=> operator) via pgvector HNSW index.
 */
export async function findSimilarDishes(
  embedding: number[],
  limit = 20,
  excludeIds: string[] = [],
): Promise<SimilarDish[]> {
  const embStr = `[${embedding.join(',')}]`
  const excludeClause = excludeIds.length > 0
    ? `AND d.id NOT IN (${excludeIds.map(id => `'${id}'`).join(',')})`
    : ''

  const results = await prisma.$queryRawUnsafe<SimilarDish[]>(`
    SELECT d.id, d.name, 1 - (d.embedding <=> $1::vector) as similarity
    FROM "Dish" d
    WHERE d.embedding IS NOT NULL
      AND d."isActive" = true
      AND d."deletedAt" IS NULL
      ${excludeClause}
    ORDER BY d.embedding <=> $1::vector
    LIMIT $2
  `, embStr, limit)

  return results
}

/**
 * Find dishes visually similar to a given image embedding.
 */
export async function findVisuallySimilarDishes(
  imageEmbedding: number[],
  limit = 20,
  excludeIds: string[] = [],
): Promise<SimilarDish[]> {
  const embStr = `[${imageEmbedding.join(',')}]`
  const excludeClause = excludeIds.length > 0
    ? `AND d.id NOT IN (${excludeIds.map(id => `'${id}'`).join(',')})`
    : ''

  const results = await prisma.$queryRawUnsafe<SimilarDish[]>(`
    SELECT d.id, d.name, 1 - (d."imageEmbedding" <=> $1::vector) as similarity
    FROM "Dish" d
    WHERE d."imageEmbedding" IS NOT NULL
      AND d."isActive" = true
      AND d."deletedAt" IS NULL
      ${excludeClause}
    ORDER BY d."imageEmbedding" <=> $1::vector
    LIMIT $2
  `, embStr, limit)

  return results
}

/**
 * Get the embedding of a specific dish.
 */
export async function getDishEmbedding(dishId: string): Promise<number[] | null> {
  const results = await prisma.$queryRawUnsafe<{ embedding: string }[]>(`
    SELECT embedding::text FROM "Dish" WHERE id = $1 AND embedding IS NOT NULL
  `, dishId)

  if (results.length === 0) return null
  // Parse "[0.1,0.2,...]" string to number array
  return JSON.parse(results[0].embedding)
}

/**
 * Get dishes most similar to a user's taste vector.
 * This is the main feed query for Phase 2.
 */
export async function getFeedByTaste(
  gustoVector: number[],
  limit = 50,
  excludeIds: string[] = [],
  dietFilter?: { isVegan?: boolean; isVegetarian?: boolean; isGlutenFree?: boolean; isLactoseFree?: boolean },
): Promise<(SimilarDish & { price: number; photos: string[]; restaurantId: string })[]> {
  const embStr = `[${gustoVector.join(',')}]`

  let dietClause = ''
  if (dietFilter?.isVegan) dietClause += ` AND d."dishDiet" = 'VEGAN'`
  else if (dietFilter?.isVegetarian) dietClause += ` AND d."dishDiet" IN ('VEGAN', 'VEGETARIAN')`
  if (dietFilter?.isGlutenFree) dietClause += ` AND d."isGlutenFree" = true`
  if (dietFilter?.isLactoseFree) dietClause += ` AND d."isLactoseFree" = true`

  const excludeClause = excludeIds.length > 0
    ? `AND d.id NOT IN (${excludeIds.map(id => `'${id}'`).join(',')})`
    : ''

  const results = await prisma.$queryRawUnsafe<any[]>(`
    SELECT d.id, d.name, d.price, d.photos, d."restaurantId",
           1 - (d.embedding <=> $1::vector) as similarity
    FROM "Dish" d
    JOIN "Restaurant" r ON r.id = d."restaurantId"
    WHERE d.embedding IS NOT NULL
      AND d."isActive" = true
      AND d."deletedAt" IS NULL
      AND r."isActive" = true
      AND r."isDemo" = false
      AND d.photos != '{}'
      ${dietClause}
      ${excludeClause}
    ORDER BY d.embedding <=> $1::vector
    LIMIT $2
  `, embStr, limit)

  return results
}

/**
 * Compute average of multiple embedding vectors.
 */
export function averageEmbeddings(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return []
  const dim = embeddings[0].length
  const avg = new Array(dim).fill(0)
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) avg[i] += emb[i]
  }
  for (let i = 0; i < dim; i++) avg[i] /= embeddings.length
  return avg
}

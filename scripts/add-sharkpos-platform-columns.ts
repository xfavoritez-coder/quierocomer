/**
 * Agrega (aditivo, seguro) las columnas de MODO PLATAFORMA SharkPOS a Restaurant.
 * Correr: npx tsx scripts/add-sharkpos-platform-columns.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config() // .env como respaldo
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } } })

const COLS = [
  'sharkposTenantId',
  'sharkposApiKey',
  'sharkposTenantEnv',
  'sharkposTenantRut',
  'sharkposTenantName',
] as const

async function main() {
  const before = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Restaurant'
      AND column_name = ANY(${[...COLS]}::text[])`
  console.log('Ya existen:', before.map(r => r.column_name))

  await prisma.$executeRawUnsafe(`SET statement_timeout = 0`)
  await prisma.$executeRawUnsafe(`SET lock_timeout = 0`)
  for (const col of COLS) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "${col}" TEXT`)
    console.log(`✓ Restaurant.${col}`)
  }

  const after = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Restaurant'
      AND column_name = ANY(${[...COLS]}::text[])`
  console.log('Estado final:', after.map(r => r.column_name))
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())

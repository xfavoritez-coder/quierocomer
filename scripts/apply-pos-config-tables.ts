/**
 * Crea las tablas de config del POS server-authoritative:
 *   "PosTable" / "PosSector" / "PosStaff"  (ver src/lib/pos/sql/003_pos_config_tables.sql)
 * ADITIVO, IDEMPOTENTE y SEGURO (CREATE TABLE/INDEX IF NOT EXISTS). NO usa db push.
 * Son tablas Prisma (acceso server-side vía prisma.*): sin RLS/grants/realtime.
 *
 * Correr contra prod ANTES de desplegar el código nuevo:
 *   npx tsx scripts/apply-pos-config-tables.ts
 */
import { config } from 'dotenv'; config({ path: '.env.local' }); config()
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } } })

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "PosTable" (
     "id" TEXT NOT NULL,
     "restaurantId" TEXT NOT NULL,
     "number" INTEGER NOT NULL,
     "label" TEXT,
     "sectorId" TEXT,
     "x" INTEGER NOT NULL DEFAULT 0,
     "y" INTEGER NOT NULL DEFAULT 0,
     "active" BOOLEAN NOT NULL DEFAULT true,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "PosTable_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE INDEX IF NOT EXISTS "PosTable_restaurantId_active_idx" ON "PosTable" ("restaurantId", "active")`,
  `CREATE TABLE IF NOT EXISTS "PosSector" (
     "id" TEXT NOT NULL,
     "restaurantId" TEXT NOT NULL,
     "name" TEXT NOT NULL,
     "position" INTEGER NOT NULL DEFAULT 0,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "PosSector_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE INDEX IF NOT EXISTS "PosSector_restaurantId_idx" ON "PosSector" ("restaurantId")`,
  `CREATE TABLE IF NOT EXISTS "PosStaff" (
     "id" TEXT NOT NULL,
     "restaurantId" TEXT NOT NULL,
     "name" TEXT NOT NULL,
     "pinHash" TEXT NOT NULL DEFAULT '',
     "role" TEXT NOT NULL DEFAULT 'garzon',
     "active" BOOLEAN NOT NULL DEFAULT true,
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "PosStaff_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE INDEX IF NOT EXISTS "PosStaff_restaurantId_active_idx" ON "PosStaff" ("restaurantId", "active")`,
]

async function main() {
  await prisma.$executeRawUnsafe(`SET statement_timeout = 0`)
  await prisma.$executeRawUnsafe(`SET lock_timeout = 0`)
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql)
    console.log('✓', sql.trim().split('\n')[0])
  }
  const check = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_name = ANY($1::text[])`,
    ['PosTable', 'PosSector', 'PosStaff'],
  )
  console.log('Tablas presentes:', check.map(r => r.table_name).sort())
  if (check.length !== 3) { console.error('✗ Faltan tablas'); process.exit(1) }
  console.log('OK — listas para desplegar el código.')
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())

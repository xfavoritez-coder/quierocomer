/**
 * Columnas para FACTURA (33) y NOTA DE CRÉDITO (61). Aditivo y seguro.
 * Correr: npx tsx scripts/add-factura-nc-columns.ts
 */
import { config } from 'dotenv'; config({ path: '.env.local' }); config()
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } } })

// [tabla, columna, tipo SQL]
const COLS: [string, string, string][] = [
  ['Restaurant', 'facturaEnabled', 'BOOLEAN NOT NULL DEFAULT false'],
  ['PosOrder', 'fiscalDocType', 'INTEGER'],
  ['PosOrder', 'notaCreditoDteId', 'TEXT'],
  ['PosOrder', 'notaCreditoFolio', 'INTEGER'],
  ['PosOrder', 'notaCreditoStatus', 'TEXT'],
  ['PosOrder', 'notaCreditoPdfUrl', 'TEXT'],
  ['PosOrder', 'notaCreditoEmittedAt', 'TIMESTAMP(3)'],
  ['PosOrder', 'anuladaAt', 'TIMESTAMP(3)'],
]

async function main() {
  await prisma.$executeRawUnsafe(`SET statement_timeout = 0`)
  await prisma.$executeRawUnsafe(`SET lock_timeout = 0`)
  for (const [t, c, type] of COLS) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "${c}" ${type}`)
    console.log(`✓ ${t}.${c}`)
  }
  const check = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string }[]>(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema='public' AND column_name = ANY($1::text[])`,
    COLS.map(c => c[1])
  )
  console.log('Presentes:', check.map(r => `${r.table_name}.${r.column_name}`).sort())
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())

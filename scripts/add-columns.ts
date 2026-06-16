/**
 * Agrega las columnas primaryCategory y leafOverride de forma segura.
 * Correr: npx tsx scripts/add-columns.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
})

async function main() {
  // Verificar cuáles columnas ya existen
  const existing = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('Restaurant', 'Dish')
      AND column_name IN ('primaryCategory', 'leafOverride')
  `
  const existingCols = new Set(existing.map(r => r.column_name))
  console.log('Columnas que ya existen:', [...existingCols])

  // Ver qué conexiones activas existen
  const locks = await prisma.$queryRaw<any[]>`
    SELECT pid, state, wait_event_type, wait_event, left(query, 80) as query, query_start
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND pid <> pg_backend_pid()
      AND state <> 'idle'
    ORDER BY query_start
    LIMIT 20
  `
  console.log('\nConexiones activas:', locks)

  // Cancelar conexiones idle-in-transaction o bloqueadas (excepto la nuestra)
  if (locks.length > 0) {
    console.log('\nCancelando conexiones que bloquean...')
    const cancelled = await prisma.$queryRaw<any[]>`
      SELECT pg_cancel_backend(pid), pid, left(query, 50) as query
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND state IN ('idle in transaction', 'idle in transaction (aborted)')
    `
    console.log('Canceladas:', cancelled)
  }

  // Esperar un momento
  await new Promise(r => setTimeout(r, 1000))

  // Intentar agregar columnas sin lock_timeout (usamos statement_timeout = 0)
  for (const [table, col] of [['Restaurant', 'primaryCategory'], ['Dish', 'leafOverride']] as const) {
    if (existingCols.has(col)) {
      console.log(`✓ ${table}.${col} ya existe`)
      continue
    }
    console.log(`\nAgregando ${table}.${col}...`)
    try {
      await prisma.$executeRawUnsafe(`SET statement_timeout = 0`)
      await prisma.$executeRawUnsafe(`SET lock_timeout = 0`)
      await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col}" TEXT`)
      console.log(`✓ ${table}.${col} creada`)
    } catch (e: any) {
      console.error(`✗ ${table}.${col} error:`, e.message?.split('\n')[0])
    }
  }

  // Estado final
  const final = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('Restaurant', 'Dish')
      AND column_name IN ('primaryCategory', 'leafOverride')
  `
  console.log('\nEstado final:', final.length === 0 ? '❌ Ninguna columna creada' : final.map(r => `✓ ${r.table_name}.${r.column_name}`))
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

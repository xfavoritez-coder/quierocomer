import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL })

async function main() {
  // Kill all idle connections
  const result = await prisma.$queryRawUnsafe<any[]>(`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE state = 'idle'
      AND pid <> pg_backend_pid()
      AND datname = current_database()
  `)
  console.log(`Killed ${result.length} idle connections`)

  const active = await prisma.$queryRawUnsafe<any[]>(`
    SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()
  `)
  console.log(`Active connections now: ${active[0]?.count}`)

  await prisma.$disconnect()
}
main()

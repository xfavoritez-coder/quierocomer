import { Client } from 'pg'
import { config } from 'dotenv'
config({ path: '.env.local' })
const db = new Client({ connectionString: process.env.DIRECT_URL })

async function main() {
  await db.connect()
  const { rows } = await db.query(
    `SELECT "communeSlug", commune, COUNT(*) as total
     FROM "Restaurant" WHERE "communeSlug" IS NOT NULL
     GROUP BY "communeSlug", commune ORDER BY total DESC LIMIT 20`
  )
  console.log('\nTop comunas:')
  for (const r of rows) console.log(`  ${r.commune} (${r.communeSlug}) — ${r.total} locales`)
  await db.end()
}
main().catch(console.error)

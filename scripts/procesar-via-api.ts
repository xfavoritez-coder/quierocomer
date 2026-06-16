/**
 * Procesa leads pendientes con URLs fáciles via la API route del dev server
 * Requiere: npm run dev corriendo en localhost:3000
 *
 * Uso: npx ts-node --skip-project scripts/procesar-via-api.ts
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE = 'http://localhost:3000'

const EASY_DOMAINS = [
  'ola.click', 'fu.do', 'fudo.com', 'menu.fu.do',
  'heyzine.com', 'micartaqr.cl', 'carta.avocaty.io',
  'queresto.com', 'drive.google.com',
]

function isEasy(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    return EASY_DOMAINS.some(d => hostname.includes(d))
  } catch { return false }
}

async function main() {
  const leads = await prisma.lead.findMany({
    where: { cartaStatus: 'PENDING', cartaUrl: { not: null } },
    select: { id: true, localName: true, cartaUrl: true },
    orderBy: { createdAt: 'desc' },
  })

  const easy = leads.filter(l => l.cartaUrl && isEasy(l.cartaUrl))
  console.log(`\n📋 ${leads.length} leads pendientes, ${easy.length} fáciles\n`)

  let ok = 0, fail = 0

  for (const lead of easy) {
    console.log(`🔄 ${lead.localName}`)
    console.log(`   ${lead.cartaUrl}`)

    try {
      const res = await fetch(`${BASE}/api/subircarta/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id }),
        signal: AbortSignal.timeout(480000), // 8 min timeout (matches pipeline)
      })

      const json = await res.json() as any
      if (json.ok) {
        console.log(`   ✅ ${json.url}\n`)
        ok++
      } else {
        console.log(`   ❌ ${json.error}\n`)
        fail++
      }
    } catch (e: any) {
      console.log(`   ❌ ${e.message}\n`)
      fail++
    }
  }

  console.log(`\n📊 Resultado: ${ok} extraídos, ${fail} fallidos`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

/**
 * Procesa leads pendientes que tienen URLs fácilmente extraíbles
 * (OlaClick, Fudo, Heyzine, MiCartaQR, Avocaty, Google Drive)
 *
 * Uso: npx ts-node --skip-project scripts/procesar-leads-extraibles.ts
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const EASY_DOMAINS = [
  'ola.click',
  'fu.do', 'fudo.com', 'menu.fu.do',
  'heyzine.com',
  'micartaqr.cl',
  'carta.avocaty.io',
  'queresto.com',
  'drive.google.com',
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
    select: { id: true, localName: true, cartaUrl: true, generatedSlug: true },
    orderBy: { createdAt: 'desc' },
  })

  const easy = leads.filter(l => l.cartaUrl && isEasy(l.cartaUrl))
  console.log(`\n📋 ${leads.length} leads pendientes total, ${easy.length} con proveedores fáciles\n`)

  if (easy.length === 0) {
    console.log('No hay leads fáciles para procesar.')
    await prisma.$disconnect()
    return
  }

  for (const lead of easy) {
    console.log(`🔄 Procesando: ${lead.localName}`)
    console.log(`   URL: ${lead.cartaUrl}`)

    try {
      const { processLead } = await import('../src/lib/extractors/pipeline')
      const result = await processLead(lead.id)
      console.log(`   ✅ Listo → ${result.url}\n`)
    } catch (e: any) {
      console.error(`   ❌ Error: ${e.message}\n`)
    }
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

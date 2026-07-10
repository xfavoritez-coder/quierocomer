/**
 * Extrae cartas de un proveedor específico desde locales-feed.json.
 * Actualiza JSON con estado. Activa restaurantes exitosos.
 *
 * Uso: npx ts-node --skip-project scripts/extraer-provider.ts queresto
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

import fs from 'fs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE = 'http://localhost:3000'
const provider = process.argv[2]

if (!provider) { console.error('Uso: npx ts-node --skip-project scripts/extraer-provider.ts <provider>'); process.exit(1) }

type Local = {
  name: string; address: string; lat: number; lng: number;
  website: string; provider: string; rating: number; reviews: number;
  comuna: string; extracted?: 'ok' | 'fail' | null;
}

function slugify(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

async function main() {
  const locales: Local[] = JSON.parse(fs.readFileSync('public/locales-feed.json', 'utf-8'))
  const targets = locales.filter(l => l.provider.toLowerCase() === provider.toLowerCase() && l.extracted !== 'ok')
  console.log(`\n🍽 Extrayendo ${targets.length} cartas de ${provider}...\n`)

  let ok = 0, fail = 0

  for (let i = 0; i < targets.length; i++) {
    const local = targets[i]
    const slug = slugify(local.name)
    console.log(`${i + 1}/${targets.length} ${local.name}`)
    console.log(`   ${local.website}`)

    let rest = await prisma.restaurant.findFirst({ where: { OR: [{ slug }, { name: local.name }] } })
    if (!rest) {
      rest = await prisma.restaurant.create({
        data: {
          name: local.name, slug, address: local.address || '', lat: local.lat || null, lng: local.lng || null,
          website: local.website, isActive: false, isDemo: true, plan: 'FREE',
        },
      })
    } else {
      await prisma.restaurant.update({ where: { id: rest.id }, data: { isDemo: true } })
    }

    let lead = await prisma.lead.findFirst({ where: { cartaUrl: local.website } })
    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          localName: local.name, ownerName: `${provider} Import`, email: 'import@quierocomer.com',
          cartaType: 'LINK', cartaUrl: local.website, cartaStatus: 'PENDING', generatedSlug: slug,
        },
      })
    } else if (lead.cartaStatus !== 'PENDING') {
      await prisma.lead.update({ where: { id: lead.id }, data: { cartaStatus: 'PENDING', errorLog: null } })
    }

    try {
      const res = await fetch(`${BASE}/api/subircarta/process`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id }), signal: AbortSignal.timeout(480000),
      })
      const json = await res.json() as any
      if (json.ok) {
        await prisma.restaurant.updateMany({
          where: { slug: json.slug },
          data: { isDemo: false, isActive: true, address: local.address || undefined, lat: local.lat || undefined, lng: local.lng || undefined },
        })
        local.extracted = 'ok'
        ok++
        console.log(`   ✅ ${json.url}\n`)
      } else {
        local.extracted = 'fail'
        fail++
        console.log(`   ❌ ${json.error}\n`)
      }
    } catch (e: any) {
      local.extracted = 'fail'
      fail++
      console.log(`   ❌ ${e.message}\n`)
    }

    fs.writeFileSync('public/locales-feed.json', JSON.stringify(locales, null, 2))
  }

  console.log(`\n📊 ${provider}: ${ok} extraídos, ${fail} fallidos`)
  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

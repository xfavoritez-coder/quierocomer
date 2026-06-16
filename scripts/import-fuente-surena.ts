import { config } from 'dotenv'
config({ path: '.env.local' })
import { importFromProspecto } from '../src/lib/extractors/pipeline'
import { prisma } from '../src/lib/prisma'
import { randomUUID } from 'crypto'

async function main() {
  let prospecto = await prisma.mapaProspecto.findFirst({ where: { name: { contains: 'Sure' } } })
  if (!prospecto) {
    prospecto = await prisma.mapaProspecto.create({
      data: {
        id: randomUUID(),
        name: 'Fuente Sureña',
        address: 'Santiago, Región Metropolitana',
        lat: -33.4318721,
        lng: -70.6926666,
        mapsUrl: 'https://maps.app.goo.gl/uLknUYRZ8eCmYThf8',
        cartaUrl: 'https://www.ubereats.com/cl/store/fuente-surena-santiago/ao8OKlMaWwWKsBOTtCISwg',
        provider: 'UberEats',
      }
    })
  }

  console.log('Importando Fuente Sureña...')
  const result = await importFromProspecto({
    prospectoId: prospecto.id,
    name: 'Fuente Sureña',
    address: 'Santiago, Región Metropolitana',
    lat: -33.4318721,
    lng: -70.6926666,
    mapsUrl: 'https://maps.app.goo.gl/uLknUYRZ8eCmYThf8',
    cartaUrl: 'https://www.ubereats.com/cl/store/fuente-surena-santiago/ao8OKlMaWwWKsBOTtCISwg',
    providerName: 'UberEats',
  })

  console.log('✓ Importado:', JSON.stringify(result))
  await prisma.$disconnect()
}

main().catch(async e => {
  console.error('✗ ERROR:', e.message)
  await prisma.$disconnect()
  process.exit(1)
})

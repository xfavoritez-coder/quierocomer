import { config } from 'dotenv'
config({ path: '.env.local' })
import { importFromProspecto } from '../src/lib/extractors/pipeline'
import { prisma } from '../src/lib/prisma'
import { randomUUID } from 'crypto'

async function main() {
  let prospecto = await prisma.mapaProspecto.findFirst({ where: { name: { contains: 'Wang' } } })
  if (!prospecto) {
    prospecto = await prisma.mapaProspecto.create({
      data: {
        id: randomUUID(),
        name: 'Restaurant Wang Jiao',
        address: 'Santiago, Región Metropolitana',
        lat: -33.5622444,
        lng: -70.5994782,
        mapsUrl: 'https://maps.app.goo.gl/SZMidqtnWo7vgZJA6',
        cartaUrl: 'https://www.ubereats.com/cl/store/restaurante-wang-jiao-santiago/H-_CTTYYTfmKivqrs2Q9dQ',
        provider: 'UberEats',
      }
    })
    console.log('Prospecto creado:', prospecto.id)
  }

  console.log('Importando...')
  const result = await importFromProspecto({
    prospectoId: prospecto.id,
    name: 'Restaurant Wang Jiao',
    address: 'Santiago, Región Metropolitana',
    lat: -33.5622444,
    lng: -70.5994782,
    mapsUrl: 'https://maps.app.goo.gl/SZMidqtnWo7vgZJA6',
    cartaUrl: 'https://www.ubereats.com/cl/store/restaurante-wang-jiao-santiago/H-_CTTYYTfmKivqrs2Q9dQ',
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

import { config } from 'dotenv'
config({ path: '.env.local' })
import { importFromProspecto } from '../src/lib/extractors/pipeline'
import { prisma } from '../src/lib/prisma'
import { randomUUID } from 'crypto'

async function main() {
  let prospecto = await prisma.mapaProspecto.findFirst({ where: { name: { contains: 'Xing' } } })
  if (!prospecto) {
    prospecto = await prisma.mapaProspecto.create({
      data: {
        id: randomUUID(),
        name: 'Restaurant Xing Xing',
        address: 'Santiago, Región Metropolitana',
        lat: null,
        lng: null,
        mapsUrl: 'https://www.google.com/maps/place/Restaurant+Xing+Xing/data=!4m2!3m1!1s0x0:0xf154dfb4fd689eec',
        cartaUrl: 'https://www.ubereats.com/cl/store/xing-xing/ioqy1pRJSTWYj_x-nx5F5w',
        provider: 'UberEats',
      }
    })
    console.log('Prospecto creado:', prospecto.id)
  }

  console.log('Importando...')
  const result = await importFromProspecto({
    prospectoId: prospecto.id,
    name: 'Restaurant Xing Xing',
    address: 'Santiago, Región Metropolitana',
    lat: null,
    lng: null,
    mapsUrl: 'https://www.google.com/maps/place/Restaurant+Xing+Xing/data=!4m2!3m1!1s0x0:0xf154dfb4fd689eec',
    cartaUrl: 'https://www.ubereats.com/cl/store/xing-xing/ioqy1pRJSTWYj_x-nx5F5w',
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

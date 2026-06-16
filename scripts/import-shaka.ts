import 'dotenv/config'
import { config } from 'dotenv'
config({ path: '.env.local' })

import { importFromProspecto } from '../src/lib/extractors/pipeline'
import { prisma } from '../src/lib/prisma'
import { randomUUID } from 'crypto'

async function main() {
  let prospecto = await prisma.mapaProspecto.findFirst({ where: { name: { contains: 'Shaka' } } })
  if (!prospecto) {
    prospecto = await prisma.mapaProspecto.create({
      data: {
        id: randomUUID(),
        name: 'Shaka Burger',
        address: 'Avenida Algarrobo 2301, Algarrobo',
        lat: -33.363,
        lng: -71.664,
        mapsUrl: 'https://www.google.com/maps/place/Shaka+Burger+%26+Shaka+Bowl/data=!4m2!3m1!1s0x9662118f9bfc0213:0xb12777339c8ee899',
        cartaUrl: 'https://toteat.app/r/cl/Shaka-Burger/7386/checkin/menu',
        provider: 'Toteat',
      }
    })
    console.log('Prospecto creado:', prospecto.id)
  } else {
    console.log('Prospecto existente:', prospecto.id)
  }

  console.log('Importando...')
  const result = await importFromProspecto({
    prospectoId: prospecto.id,
    name: 'Shaka Burger',
    address: 'Avenida Algarrobo 2301, Algarrobo',
    lat: -33.363,
    lng: -71.664,
    mapsUrl: 'https://www.google.com/maps/place/Shaka+Burger+%26+Shaka+Bowl/data=!4m2!3m1!1s0x9662118f9bfc0213:0xb12777339c8ee899',
    cartaUrl: 'https://toteat.app/r/cl/Shaka-Burger/7386/checkin/menu',
    providerName: 'Toteat',
  })

  console.log('✓ Importado:', JSON.stringify(result))
  await prisma.$disconnect()
}

main().catch(async e => {
  console.error('✗ ERROR:', e.message)
  await prisma.$disconnect()
  process.exit(1)
})

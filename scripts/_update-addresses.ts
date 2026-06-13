import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL })

const ADDRESSES: Record<string, string> = {
  // Encontrados
  'alleria-pizza': 'Av. Italia 1350, Providencia, Santiago',
  'barrakuda': 'Santa Isabel 0506, Providencia, Santiago',
  'chilmex': 'Suárez Mujica 1916, Ñuñoa, Santiago',
  'dinos-roll': 'Av. México 4285, Puente Alto, Santiago',
  'don-matu': 'Pedro Montt 2464, Valparaíso',
  'el-parron-de-pomaire': 'Arturo Prat 210, Pomaire, Melipilla',
  'elements': 'Monseñor Edwards 1636, La Reina, Santiago',
  'heladeria-italia-1609-cafe-crepe': 'Av. Italia 1609, Ñuñoa, Santiago',
  'krua-thai': 'Girardi 1349, Providencia, Santiago',
  'kunstmann': 'Constitución 57, Bellavista, Santiago',
  'la-foresta': 'Dr. Carlos Charlín 1480, Providencia, Santiago',
  'nascosto-pizzeria': 'Av. Italia 1693, Ñuñoa, Santiago',
  'sushi-rolls-liam': 'Monseñor Müller 24, Providencia, Santiago',
  'taranta-chicureo': 'Teresa Spikula esquina Los Fundos, Chicureo, Colina',
  'tres-toques': 'Av. Francisco Bilbao 4531, La Reina, Santiago',
  'gaman-combi': 'Av. Santa Isabel 0306, Providencia, Santiago',

  // NOT FOUND — dirección genérica Santiago
  'amila-cafeteria': 'Santiago, Chile',
  'andybar': 'Santiago, Chile',
  'calypso-sushi': 'Santiago, Chile',
  'central-inca': 'Santiago, Chile',
  'ceviche-a-lo-tigre': 'Santiago, Chile',
  'dubliness-cafe': 'Santiago, Chile',
  'extasis-culinario': 'Santiago, Chile',
  'food-king-facundo': 'Santiago, Chile',
  'forty-four': 'Santiago, Chile',
  'immortal': 'Santiago, Chile',
  'jeie': 'Santiago, Chile',
  'kamiisushii-victoria': 'Santiago, Chile',
  'la-picada-del-pa-vito': 'Santiago, Chile',
  'lufin-selected-dishes': 'Santiago, Chile',
  'mechas-con-tutti': 'Santiago, Chile',
  'oasis-restaurante': 'Santiago, Chile',
  'pakary': 'Santiago, Chile',
  'pollizonte': 'Santiago, Chile',
  'terraqueo': 'Santiago, Chile',
  'wena-pizza': 'Santiago, Chile',
  'yume-sushi-cevicheria': 'Santiago, Chile',
  'zetas-pizzeria': 'Santiago, Chile',
  'el-menu-de-la-esquina': 'Santiago, Chile',
  'alejandrs-caracasburguer': 'Santiago, Chile',
}

async function main() {
  let updated = 0
  for (const [slug, address] of Object.entries(ADDRESSES)) {
    try {
      const result = await prisma.restaurant.updateMany({
        where: { slug, address: null },
        data: { address },
      })
      if (result.count > 0) {
        console.log(`✓ ${slug} → ${address}`)
        updated++
      } else {
        // Try updating even if address exists but is empty
        const r2 = await prisma.restaurant.updateMany({
          where: { slug, OR: [{ address: null }, { address: '' }] },
          data: { address },
        })
        if (r2.count > 0) {
          console.log(`✓ ${slug} → ${address}`)
          updated++
        } else {
          console.log(`- ${slug} (ya tenía dirección o no existe)`)
        }
      }
    } catch (e: any) {
      console.log(`✗ ${slug} — error: ${e.message}`)
    }
  }
  console.log(`\nActualizados: ${updated}`)
  await prisma.$disconnect()
}
main()

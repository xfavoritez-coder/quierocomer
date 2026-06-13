import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL })

// Asignar direcciones ficticias en distintas comunas de Santiago
const ADDRESSES: Record<string, string> = {
  'amila-cafeteria': 'Av. Irarrázaval 2401, Ñuñoa, Santiago',
  'andybar': 'Av. Providencia 1208, Providencia, Santiago',
  'calypso-sushi': 'Av. Apoquindo 4500, Las Condes, Santiago',
  'central-inca': 'Av. Libertador Bernardo O\'Higgins 1570, Santiago Centro',
  'ceviche-a-lo-tigre': 'Av. Manuel Montt 1980, Providencia, Santiago',
  'dubliness-cafe': 'Av. Suecia 0155, Providencia, Santiago',
  'extasis-culinario': 'Av. Vitacura 6800, Vitacura, Santiago',
  'food-king-facundo': 'Av. Concha y Toro 2530, Puente Alto, Santiago',
  'forty-four': 'Av. Nueva Costanera 4000, Vitacura, Santiago',
  'immortal': 'Av. Vicuña Mackenna 6100, La Florida, Santiago',
  'jeie': 'Av. Pedro de Valdivia 291, Providencia, Santiago',
  'kamiisushii-victoria': 'Arturo Prat 445, Victoria, Araucanía',
  'la-picada-del-pa-vito': 'Av. Departamental 0610, San Joaquín, Santiago',
  'lufin-selected-dishes': 'Av. Las Condes 12500, Lo Barnechea, Santiago',
  'mechas-con-tutti': 'Av. Grecia 3450, Ñuñoa, Santiago',
  'oasis-restaurante': 'Av. Recoleta 3150, Recoleta, Santiago',
  'pakary': 'Av. La Florida 9800, La Florida, Santiago',
  'pollizonte': 'Av. Independencia 2800, Independencia, Santiago',
  'terraqueo': 'Av. Irarrázaval 3500, Ñuñoa, Santiago',
  'wena-pizza': 'Av. Maipú 2090, Maipú, Santiago',
  'yume-sushi-cevicheria': 'Av. Pajaritos 4000, Maipú, Santiago',
  'zetas-pizzeria': 'Av. Tobalaba 1060, Providencia, Santiago',
  'el-menu-de-la-esquina': 'Av. Matta 1540, Santiago Centro',
  'alejandrs-caracasburguer': 'Av. Vicuña Mackenna 3600, San Joaquín, Santiago',
}

async function main() {
  let updated = 0
  for (const [slug, address] of Object.entries(ADDRESSES)) {
    const result = await prisma.restaurant.updateMany({
      where: { slug },
      data: { address },
    })
    if (result.count > 0) {
      console.log(`✓ ${slug} → ${address}`)
      updated++
    }
  }
  console.log(`\nActualizados: ${updated}`)
  await prisma.$disconnect()
}
main()

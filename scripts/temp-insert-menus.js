require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const EXCLUDED = new Set(['Extras', 'Topping', 'CERVEZAS', 'Bebidas', 'Bebestibles', 'Ramo de flores', 'Dia de la Madre', 'mocktails', 'Adicional', 'Te'])

async function insertMenu(slug, items) {
  const rest = await prisma.restaurant.findFirst({ where: { slug } })
  if (!rest) { console.log('NOT FOUND: ' + slug); return }

  let created = 0, skipped = 0
  for (const item of items) {
    if (EXCLUDED.has(item.category)) { skipped++; continue }
    if (!item.name || item.price <= 0) { skipped++; continue }
    if (item.name.toLowerCase().includes('adicional') || item.name.toLowerCase().includes('agregado') || item.name.toLowerCase().includes('extra ')) { skipped++; continue }

    let cat = await prisma.category.findFirst({
      where: { name: item.category, restaurantId: rest.id }
    })
    if (!cat) {
      const dishType = ['Postres', 'Pastelería', 'Wafles', 'Fondue', 'Heladería', 'Croissant'].includes(item.category) ? 'dessert'
        : ['Cafe', 'Chocolates Calientes', 'Milkshake'].includes(item.category) ? 'drink'
        : 'food'
      const maxPos = await prisma.category.aggregate({ where: { restaurantId: rest.id }, _max: { position: true } })
      cat = await prisma.category.create({
        data: { name: item.category, restaurantId: rest.id, dishType, position: (maxPos._max.position ?? 0) + 1 }
      })
    }

    const existing = await prisma.dish.findFirst({
      where: { name: item.name, restaurantId: rest.id }
    })
    if (existing) { skipped++; continue }

    const maxDishPos = await prisma.dish.aggregate({ where: { categoryId: cat.id }, _max: { position: true } })
    await prisma.dish.create({
      data: {
        name: item.name,
        description: item.description || null,
        price: item.price,
        restaurantId: rest.id,
        categoryId: cat.id,
        isActive: true,
        position: (maxDishPos._max.position ?? 0) + 1,
      }
    })
    created++
  }
  console.log(rest.name + ': ' + created + ' creados, ' + skipped + ' omitidos')
}

async function main() {
  const zokai = [
    {name:"Edamames",price:5990,description:"150 gr de edamames fritos",category:"Entradas"},
    {name:"Niguiris de salmon",price:8990,description:"3 unidades de niguiris de la casa, flambeados",category:"Entradas"},
    {name:"Coctel de camarones",price:8990,description:"6 camarones en salsa acevichada spicy",category:"Entradas"},
    {name:"Coquitos de Salmon",price:10990,description:"Coquitos de salmón crispy, rellenos de palta y queso crema",category:"Entradas"},
    {name:"Festival de langostinos",price:11990,description:"Seis crujientes langostinos con 2 salsas",category:"Entradas"},
    {name:"Gyosas",price:6990,description:"5 gyosas fritas de pollo, camarón, cerdo o veggie",category:"Entradas"},
    {name:"Trilogia zokai",price:14990,description:"Ceviche de camarón, ceviche mixto y ceviche de curvina",category:"Ceviches"},
    {name:"Ceviche de Reineta",price:12990,description:"Reineta, cebolla morada, pimentón y cilantro en leche de tigre",category:"Ceviches"},
    {name:"Ceviche de Salmón",price:12990,description:"Cortes de salmón, cebolla morada, pimentón y cilantro",category:"Ceviches"},
    {name:"Ceviche de camarones",price:12990,description:"Camarones, cebolla morada, pimentón y cilantro",category:"Ceviches"},
    {name:"Ceviche ZOKAI",price:13990,description:"Salmón, pulpo, camarón y curvina en leche de tigre",category:"Ceviches"},
    {name:"Ceviche de Atún",price:12990,description:"Cortes de atún, palta y cebollin en salsa ponzu",category:"Ceviches"},
    {name:"Sashimi de salmón",price:9990,description:"6 cortes de salmón",category:"Sashimi"},
    {name:"Sashimi de atún",price:8990,description:"6 cortes de atún",category:"Sashimi"},
    {name:"Sashimi Zokai",price:11990,description:"3 cortes de salmón, 3 de atún, 3 de pulpo",category:"Sashimi"},
    {name:"Poke Zanzibar",price:10990,description:"Arroz, salmón con salsa cancún, betarraga, zanahoria, palta",category:"Poke Bowls"},
    {name:"Poke Santorini",price:10990,description:"Arroz, camarones apanados, cebollin frito, zanahoria",category:"Poke Bowls"},
    {name:"Poke Miami",price:11990,description:"Arroz con quinoa, salmón con salsa miami, camarones apanados",category:"Poke Bowls"},
    {name:"Alaska especial",price:12990,description:"Salmón, queso crema y palta, envuelto en salmón ahumado",category:"Rolls"},
    {name:"Banana hot",price:11990,description:"Salmón y camarón apanado, palta, envuelto en plátano maduro",category:"Rolls"},
    {name:"Glory",price:11990,description:"Camarón apanado, palta, salsa zokai, envuelto en salmón ahumado",category:"Rolls"},
    {name:"Ibiza",price:10990,description:"Camarón apanado, queso crema con top de salmón y limón",category:"Rolls"},
    {name:"Miami",price:12990,description:"Salmón apanado, kani, queso crema, envuelto en salmón y atún",category:"Rolls"},
    {name:"Oasis",price:11990,description:"Camarón apanado, queso crema, envuelto en mitad salmón mitad atún",category:"Rolls"},
    {name:"Rainbow",price:9990,description:"Salmón, atún y kani con lonjas de salmón ahumado",category:"Rolls"},
    {name:"Volcano",price:11990,description:"Camarones, kani, plátano frito, queso crema, palta",category:"Rolls"},
    {name:"Hollywood",price:11990,description:"Salmon, palta, envuelto en plátano con tartar de salmón",category:"Rolls"},
    {name:"Verano en Italia",price:11990,description:"Camarón apanado, palta, top de salmón y jaiba flambeado",category:"Rolls"},
    {name:"Barcelona",price:12990,description:"Roll flambeado, salmón, queso crema, envuelto en palta con pulpo",category:"Rolls"},
    {name:"Fuji furay",price:11990,description:"Salmón, cebollín con topping de camarones en salsa fuji",category:"Rolls Calientes"},
    {name:"Neptuno",price:11990,description:"Camarón, queso crema con topping de salmón, atún y wakame",category:"Rolls Calientes"},
    {name:"Tentacion",price:10990,description:"Camarón apanado, queso crema, coronado con tartar de atún",category:"Rolls Calientes"},
    {name:"Tasty bocado",price:11990,description:"Queso crema, palta, con topping de tartar de salmón",category:"Rolls Calientes"},
    {name:"Boho",price:11990,description:"Camarón, queso crema, palta, champiñón, envuelto en salmón furay",category:"Rolls sin arroz"},
    {name:"Proteina Roll",price:12990,description:"Atún, salmón, camarón y ciboulette envuelto en palta",category:"Rolls sin arroz"},
    {name:"Green roll",price:7990,description:"Tajada de plátano empanizada, palta y palmito",category:"Veggie"},
    {name:"Veggie roll",price:7990,description:"Palmito, palta, espárrago y aceitunas negras",category:"Veggie"},
    {name:"Quesillo",price:5990,description:"Postre de textura suave bañado en caramelo dorado con ron",category:"Postres"},
  ]

  const latte = [
    {name:"Torta Reina Corazón",price:4990,description:"Masa choux rellena con salsa de frambuesa, crema y crema pastelera",category:"Pastelería"},
    {name:"Torta Brownie manjar",price:6290,description:"Capas de brownie con manjar y fudge de chocolate",category:"Pastelería"},
    {name:"Torta Red velvet",price:6290,description:"Red velvet con frosting de queso crema y manjar",category:"Pastelería"},
    {name:"Torta Carrot cake",price:5990,description:"Torta de zanahoria con nueces y frosting de queso crema",category:"Pastelería"},
    {name:"Torta chocolate dark",price:6290,description:null,category:"Pastelería"},
    {name:"Cheesecake Maracuyá",price:5290,description:"Cheesecake horneado con base de galleta y mermelada de maracuyá",category:"Pastelería"},
    {name:"Cheesecake Berries",price:4490,description:null,category:"Pastelería"},
    {name:"Pie de Limón",price:4290,description:"Base de masa quebrada",category:"Pastelería"},
    {name:"Brownie Americano con Helado",price:5290,description:null,category:"Pastelería"},
    {name:"Volcán de chocolate con helado",price:7590,description:null,category:"Pastelería"},
    {name:"Torta pompadour",price:6590,description:null,category:"Pastelería"},
    {name:"Panqueque manjar nuez frambuesa",price:6590,description:null,category:"Pastelería"},
    {name:"Fondue chocolate para 2",price:15290,description:"Brownie, chocolate, frutillas, marshmallow, plátano, waffles",category:"Fondue"},
    {name:"Fondue chocolate individual",price:9990,description:"Elige 3: brownie, frutillas, marshmallow, plátano, waffles",category:"Fondue"},
    {name:"Waffle Oreo",price:7990,description:"Salsa chocolate, galleta Oreo, frutillas, crema, helado chocolate",category:"Wafles"},
    {name:"Waffle Lotus",price:7990,description:"Manjar, plátano, frutilla, galleta Lotus, crema, helado vainilla",category:"Wafles"},
    {name:"Waffle Corazón",price:7990,description:"Nutella, frutillas, helado frutilla, crema, salsa frambuesa",category:"Wafles"},
    {name:"Croissant Corazón",price:4990,description:"Crema, frutillas, azúcar flor, salsa frambuesa",category:"Croissant"},
    {name:"Croissant Nutella",price:5290,description:"Nutella, plátano, maní, salsa chocolate",category:"Croissant"},
    {name:"Milkshake Corazón",price:5990,description:"Helado frutilla, leche, frutillas frescas, crema",category:"Milkshake"},
    {name:"Milkshake Brownie",price:5990,description:"Helado chocolate, leche, brownie, crema",category:"Milkshake"},
    {name:"Milkshake Oreo",price:5990,description:"Helado vainilla, leche, Oreo, crema",category:"Milkshake"},
    {name:"Bagel Salmón Ahumado",price:7990,description:null,category:"Sandwich"},
    {name:"Ciabatta Mechada Queso",price:6490,description:null,category:"Sandwich"},
    {name:"Ciabatta Mechada Italiana",price:7490,description:null,category:"Sandwich"},
    {name:"Tostadas de palta con semillas",price:4990,description:null,category:"Sandwich"},
    {name:"Croissant Caprese",price:7290,description:null,category:"Sandwich"},
    {name:"Croissant Barros Jarpa",price:4990,description:"Queso y jamón",category:"Sandwich"},
    {name:"Croissant Vegetariano",price:5790,description:"Lechuga, queso, tomate cherry, mayo y toque de aceituna",category:"Sandwich"},
    {name:"Banana Split",price:7990,description:"Sabores: vainilla, chocolate, frutilla, tres leches",category:"Heladería"},
    {name:"Chocolate Italiano deluxe",price:4290,description:"Chocolate caliente italiano 35% cacao con marshmallows",category:"Chocolates Calientes"},
    {name:"Espresso",price:2100,description:null,category:"Cafe"},
    {name:"Americano",price:2590,description:null,category:"Cafe"},
    {name:"Capucchino",price:3590,description:null,category:"Cafe"},
    {name:"Latte",price:2900,description:null,category:"Cafe"},
    {name:"Latte Sabores",price:3990,description:"Vainilla, caramelo, coco, amaretto",category:"Cafe"},
    {name:"Mocaccino",price:3790,description:null,category:"Cafe"},
    {name:"Café Helado",price:5990,description:null,category:"Cafe"},
    {name:"Affogato",price:4200,description:"Helado de vainilla con espresso",category:"Cafe"},
    {name:"Frappuccino chocolate",price:5990,description:null,category:"Cafe"},
    {name:"Latte Chai",price:3990,description:null,category:"Cafe"},
    {name:"Matcha Latte",price:3990,description:null,category:"Cafe"},
  ]

  await insertMenu('zokai-sushi', zokai)
  await insertMenu('latte-corazon', latte)

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

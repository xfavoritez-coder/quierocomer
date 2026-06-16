require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const SKIP_NAMES = new Set(['promocion', 'menu llevar', 'LLEVAR', 'porcion de arroz', 'porcion de yuca', 'papas chica', 'proteina', 'porcion pollo', 'pezcao', 'menu bebida', 'menu madre', 'menu sabado', 'mostrito', 'menu xl', 'papas grande', 'Porción de tortillas', '4 tortillas', '6 tortillas'])

async function insertMenu(slug, items) {
  const rest = await prisma.restaurant.findFirst({ where: { slug } })
  if (!rest) { console.log('NOT FOUND: ' + slug); return }
  let created = 0, skipped = 0
  for (const item of items) {
    if (!item.name || item.price <= 0) { skipped++; continue }
    if (SKIP_NAMES.has(item.name)) { skipped++; continue }
    // Normalize price: if < 100, multiply by 1000 (Lancelot uses 10.99 format)
    let price = item.price
    if (price < 100) price = Math.round(price * 1000)
    // Fix decimal prices like 10.990 → 10990
    if (price > 100 && price < 200) price = Math.round(price * 1000)
    if (price < 500) { skipped++; continue } // skip tiny prices

    let cat = await prisma.category.findFirst({ where: { name: item.category, restaurantId: rest.id } })
    if (!cat) {
      const dishType = ['Postres', 'HELADERIA', 'TORTAS'].includes(item.category) ? 'dessert'
        : ['SHAKE BAR', 'MILKSHAKE'].includes(item.category) ? 'drink' : 'food'
      const maxPos = await prisma.category.aggregate({ where: { restaurantId: rest.id }, _max: { position: true } })
      cat = await prisma.category.create({ data: { name: item.category, restaurantId: rest.id, dishType, position: (maxPos._max.position ?? 0) + 1 } })
    }
    const existing = await prisma.dish.findFirst({ where: { name: item.name, restaurantId: rest.id } })
    if (existing) { skipped++; continue }
    const maxDishPos = await prisma.dish.aggregate({ where: { categoryId: cat.id }, _max: { position: true } })
    await prisma.dish.create({ data: { name: item.name, description: item.description || null, price, restaurantId: rest.id, categoryId: cat.id, isActive: true, position: (maxDishPos._max.position ?? 0) + 1 } })
    created++
  }
  console.log(rest.name + ': ' + created + ' creados, ' + skipped + ' omitidos')
}

async function main() {
  const lancelot = [
    {name:"Dragon Wings",price:9990,description:"10 alitas pollo en salsa bbq, ensalada coleslaw",category:"Para Empezar"},
    {name:"Ribs Stick + Coleslaw",price:9990,description:"Costillitas cerdo salsa BBQ (350-400 gr)",category:"Para Empezar"},
    {name:"La Trilogia",price:8990,description:"Aros cebolla, nuggets y papas fritas con salsa BBQ",category:"Para Empezar"},
    {name:"Empanadas",price:7990,description:"4 unidades camarón o queso mechada",category:"Para Empezar"},
    {name:"Huevos de Dragón",price:7990,description:"Crujientes quesos gouda fundido, salsa cheddar y tocino",category:"Para Empezar"},
    {name:"Brownie con Helado",price:4990,description:"Brownie de chocolate con helado, salsa caramelo y chocolate",category:"Postres"},
    {name:"Boda Roja",price:4990,description:"Cheesecake frambuesa bañado en mermelada y frutos rojos",category:"Postres"},
    {name:"Torta Matilda",price:5490,description:"Torta húmeda chocolate con ganache",category:"Postres"},
    {name:"Hojarasca Amor",price:5490,description:"Milhojas frambuesa y manjar con crema",category:"Postres"},
    {name:"Tentación de Zanahoria",price:5490,description:"Carrot cake esponjoso canela y nuez",category:"Postres"},
    {name:"Papas Americanas",price:9990,description:"Papas rústicas tocino, salsa queso cheddar",category:"Papas Topping"},
    {name:"Papas Funji",price:9990,description:"Papas rústicas champiñones salteados, queso gouda",category:"Papas Topping"},
    {name:"Papas Lucos",price:9990,description:"Papas fritas churrasco, queso gouda",category:"Papas Topping"},
    {name:"Papas Tridente",price:9990,description:"Papas rústicas camarones salteados, queso gouda",category:"Papas Topping"},
    {name:"Lancelot Baby Ribs",price:15990,description:"Costilla cerdo salsa BBQ, papas rústicas y ensalada césar",category:"Platos"},
    {name:"La Parmesana",price:11990,description:"Milanesa pollo a la parmesana, ensalada césar y papas",category:"Platos"},
    {name:"Ensalada César",price:10990,description:"Lechugas, crutones, parmesano, tocino con pollo o camarones",category:"Platos"},
    {name:"Quesadilla",price:10990,description:"Tortillas trigo con queso gouda y pollo, churrasco o camarones",category:"Platos"},
    {name:"Sir Lancelot + Papas",price:10990,description:"Doble hamburguesa vacuno, brioche, tocino, gouda, cheddar",category:"Hamburguesas"},
    {name:"Sir Pickles + Papas",price:10990,description:"Doble hamburguesa, cheddar, tocino, pepinillos",category:"Hamburguesas"},
    {name:"Sir Williams + Papas",price:10990,description:"Doble hamburguesa, cheddar con champiñones y tocino",category:"Hamburguesas"},
    {name:"Sir Daniels + Papas",price:10990,description:"Hamburguesa vacuno, doble queso fresco, tocino y huevo frito",category:"Hamburguesas"},
    {name:"Sir Perceval + Papas",price:10990,description:"Doble hamburguesa, queso azul, mermelada peras y rúcula",category:"Hamburguesas"},
    {name:"Sir Galahad + Papas",price:13990,description:"Lomo liso, camarones langostinos al ajillo, gouda",category:"Hamburguesas"},
    {name:"Elena + Papas",price:9990,description:"Croqueta arveja y zapallo, gouda, lechuga, tomate grillados",category:"Hamburguesas"},
    {name:"Burger Brave + Papas",price:8990,description:"Carne vacuno, cheddar, tocino, papas TIKA, salsa smoke bbq",category:"Hamburguesas"},
    {name:"Chicken Brave + Papas",price:8990,description:"Filet pollo, cheddar, tocino, papas TIKA",category:"Hamburguesas"},
    {name:"Not Burger Brave + Papas",price:8990,description:"NotBurger vegana con cheddar, papas TIKA",category:"Hamburguesas"},
    {name:"Lancelot Sandwich + Papas",price:10990,description:"Churrasco o pollo con camarón ajillo, cheddar",category:"Sandwiches"},
    {name:"Sandwich Barros Luco + Papas",price:10990,description:"Churrasco o pollo, queso gouda y tocino",category:"Sandwiches"},
    {name:"Sandwich Italiano + Papas",price:10990,description:"Churrasco o pollo, gouda, palta, tomate, aceitunas",category:"Sandwiches"},
    {name:"Sandwich Chacarero + Papas",price:10990,description:"Churrasco o pollo, queso fresco, porotos verdes, ají",category:"Sandwiches"},
  ]

  const pezcao = [
    {name:"Camarón al panko",price:10990,description:"Camarón frito al panko, reducción de maracuyá y mousse de palta",category:"Entradas"},
    {name:"Empanada de lomo saltado",price:5990,description:"Masa de sopaipilla rellena de lomo saltado con salsa huancaína",category:"Entradas"},
    {name:"Empanada de picante de marisco",price:6990,description:"Masa de sopaipilla rellena con salsa huancaína",category:"Entradas"},
    {name:"Ceviche clásico",price:11990,description:"Pesca del día con leche de tigre natural, cancha, choclo, camote",category:"Ceviches"},
    {name:"Ceviche carretillero",price:12990,description:"Estilo peruano con chicharrón de jibia y leche de tigre",category:"Ceviches"},
    {name:"Ceviche mixto a los 3 ajíes",price:13990,description:"Pesca del día, mixtura de marisco con leche de tigre a los 3 ajíes",category:"Ceviches"},
    {name:"Ceviche a la brasa",price:12990,description:"Pesca del día con leche de tigre a las brasas y ahumadas",category:"Ceviches"},
    {name:"Ceviche apaltado",price:12990,description:"Pesca del día con trozos de palta y leche de tigre apaltada",category:"Ceviches"},
    {name:"Ceviche nikkei",price:12990,description:"Pesca del día con leche de tigre nikkei y aceite de sésamo",category:"Ceviches"},
    {name:"Pulpo al olivo",price:14990,description:"Láminas de pulpo en salsa de aceitunas, mousse de palta",category:"Ceviches"},
    {name:"Ceviche salmón",price:14990,description:null,category:"Ceviches"},
    {name:"Leche de tigre",price:11990,description:null,category:"Ceviches"},
    {name:"Causa tigre",price:8990,description:null,category:"Ceviches"},
    {name:"Lomo saltado",price:14990,description:"Carne salteada con cebolla, tomate, arroz y papas fritas",category:"Platos Calientes"},
    {name:"Arroz con marisco",price:14990,description:"Arroz cremoso con marisco, salsa madre y queso parmesano",category:"Platos Calientes"},
    {name:"Chaufa de marisco",price:13990,description:"Marisco con arroz salteado en salsa pachikay",category:"Platos Calientes"},
    {name:"Tallarín saltado",price:13990,description:"La versión con fideos del lomo saltado",category:"Platos Calientes"},
    {name:"Tallarín a la huancaína",price:14990,description:"Fideos en salsa huancaína con lomo saltado",category:"Platos Calientes"},
    {name:"Chicharrón mixto",price:15990,description:"Pescado, calamar, camarón y pulpo con yuca frita",category:"Platos Calientes"},
    {name:"Sudado de pescado",price:13990,description:"Filete de pesca sellado en pasta de ají amarillo",category:"Platos Calientes"},
    {name:"Pulpo anticuchero",price:15990,description:"Pulpo a la parrilla en salsa anticuchera con papas rústicas",category:"Platos Calientes"},
    {name:"Corvina frita",price:15990,description:null,category:"Platos Calientes"},
    {name:"Merluza frita",price:10990,description:null,category:"Platos Calientes"},
    {name:"Chupe de marisco",price:13990,description:null,category:"Platos Calientes"},
    {name:"Ají de gallina",price:12990,description:null,category:"Platos Calientes"},
    {name:"Pollo saltado",price:11990,description:null,category:"Platos Calientes"},
  ]

  const aylupita = [
    {name:"Flautas con Guacamole",price:8990,description:"4 flautas rellenas con queso fundido",category:"Entradas"},
    {name:"Nachos con Guacamole",price:6990,description:"Nachos con guacamole de la casa",category:"Entradas"},
    {name:"Chilly Fries",price:8990,description:"Papas fritas, chili, cheddar, lechuga, pico de gallo",category:"Entradas"},
    {name:"Nachos Chilli",price:8990,description:null,category:"Entradas"},
    {name:"Guacamole Grande",price:6990,description:"Guacamole estilo mexicano",category:"Entradas"},
    {name:"Caldo Birria",price:7990,description:"Carne de res cocida lentamente con especias mexicanas",category:"Entradas"},
    {name:"Ay Lupita al Plato",price:12990,description:"Birria, flautas de queso, quesadillas y guacamole",category:"Platos"},
    {name:"Chilaquiles Pollo",price:12990,description:"Totopos en salsa especial con pechuga desmechada",category:"Platos"},
    {name:"Chimichanga",price:12990,description:"Enrollado en tortilla con chili, queso gratinado y salsa",category:"Platos"},
    {name:"Enchilada",price:12990,description:"Tortillas en salsa picante con carne, queso y verdura",category:"Platos"},
    {name:"Plancha Lomo",price:16990,description:"500g de carne de res con guacamole y salsas",category:"Platos"},
    {name:"Plancha Mixta",price:15990,description:"400g pollo, lomo y chorizo con salsas y tortillas",category:"Platos"},
    {name:"Plancha Pollo",price:14990,description:"400g de pollo con pimientos, cebollas y salsas",category:"Platos"},
    {name:"Plancha Vegetales",price:13990,description:"Cebolla, pimentones, choclo, espinaca y champiñones",category:"Platos"},
    {name:"Tacos al Pastor",price:14990,description:"3 tacos de cerdo marinado en adobo con piña asada",category:"Tacos"},
    {name:"Tacos de Cochinita",price:14990,description:"3 tortillas con pico de gallo, piña, cilantro y ají",category:"Tacos"},
    {name:"Tacos de Pollo",price:14990,description:"3 tortillas con poroto negro, guacamole y cilantro",category:"Tacos"},
    {name:"Tacos de Res",price:14990,description:"3 tortillas con lechuga, queso, cilantro y ají",category:"Tacos"},
    {name:"Tacos de Steak",price:14990,description:"3 tortillas en birria con beef steak y guacamole",category:"Tacos"},
    {name:"Tacos a la birria",price:18990,description:"3 tortillas en consomé con carne de res y queso fundido",category:"Tacos"},
    {name:"Taco de Pescado",price:14990,description:"3 tacos con filetes de pescado frito y verduras",category:"Tacos"},
    {name:"Tacos Camarón Endiablado",price:15990,description:"3 camarones en fusión cremosa y picante de queso",category:"Tacos"},
    {name:"Burrito de Cochinita",price:11990,description:"Cochinita pibil con crema de porotos y guacamole",category:"Burritos"},
    {name:"Burrito de Pollo",price:11990,description:"Pollo sazonado con porotos, guacamole y queso",category:"Burritos"},
    {name:"Burrito de Res",price:11990,description:"Carne mechada con porotos, guacamole y ají",category:"Burritos"},
    {name:"Burrito de Steak",price:13990,description:"Beef steak con crema de porotos y guacamole",category:"Burritos"},
    {name:"Burrito de Vegetales",price:11990,description:"Alcachofas, guacamole, espinacas y champiñones",category:"Burritos"},
    {name:"Quesadilla a la birria",price:12990,description:"Tortilla en consomé con carne desmechada y queso",category:"Quesadillas"},
    {name:"Quesadilla de Pollo",price:11990,description:"Tortillas con pollo mechado y queso",category:"Quesadillas"},
    {name:"Quesadilla de Res",price:11990,description:"Tortillas con lomo mechado y queso",category:"Quesadillas"},
    {name:"Quesadilla de Steak",price:11990,description:"Tortilla con beef steak y queso fundido",category:"Quesadillas"},
    {name:"Quesadilla de Vegetales",price:11990,description:"Tortillas con verduras, champiñones y queso",category:"Quesadillas"},
    {name:"Tiramisu",price:4990,description:null,category:"Postres"},
    {name:"Panacota Frutos rojos",price:4990,description:null,category:"Postres"},
    {name:"Napoleón",price:4490,description:null,category:"Postres"},
  ]

  await insertMenu('lancelot', lancelot)
  await insertMenu('pezcao', pezcao)
  await insertMenu('ay-lupita', aylupita)
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })

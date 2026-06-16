require('dotenv').config({ path: '.env.local' })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function insertMenu(slug, items) {
  const rest = await prisma.restaurant.findFirst({ where: { slug } })
  if (!rest) { console.log('NOT FOUND: ' + slug); return }
  let created = 0, skipped = 0
  for (const item of items) {
    if (!item.name || !item.price || item.price <= 0) { skipped++; continue }
    if (item.name.length < 3) { skipped++; continue }
    const lower = item.name.toLowerCase()
    if (lower.includes('adicional') || lower.includes('agregado') || lower.includes('porción de papas')) { skipped++; continue }

    let cat = await prisma.category.findFirst({ where: { name: item.category, restaurantId: rest.id } })
    if (!cat) {
      const dishType = ['Pastelería','Dulces y Helados','Postres'].includes(item.category) ? 'dessert'
        : ['Cafe','Cafetería'].includes(item.category) ? 'drink' : 'food'
      const maxPos = await prisma.category.aggregate({ where: { restaurantId: rest.id }, _max: { position: true } })
      cat = await prisma.category.create({ data: { name: item.category, restaurantId: rest.id, dishType, position: (maxPos._max.position ?? 0) + 1 } })
    }
    const existing = await prisma.dish.findFirst({ where: { name: item.name, restaurantId: rest.id } })
    if (existing) { skipped++; continue }
    const maxDishPos = await prisma.dish.aggregate({ where: { categoryId: cat.id }, _max: { position: true } })
    await prisma.dish.create({ data: { name: item.name, description: item.description || null, price: item.price, restaurantId: rest.id, categoryId: cat.id, isActive: true, position: (maxDishPos._max.position ?? 0) + 1 } })
    created++
  }
  console.log(rest.name + ': ' + created + ' creados, ' + skipped + ' omitidos')
}

async function main() {
  // Café de la Candelaria
  await insertMenu('cafe-la-candelaria', [
    {name:"Gourmet de Res Candelaria",price:13900,description:"Carne mechada en reducción de cabernet sauvignon con cebolla caramelizada",category:"Sandwich"},
    {name:"Gourmet de Salmón",price:13900,description:"Salmón ahumado, queso crema pimentón, lechuga hidropónica y rúcula",category:"Sandwich"},
    {name:"Gourmet de Jamón Serrano",price:12900,description:"Jamón Serrano, queso cabra, tomate, lactonesa de aceitunas",category:"Sandwich"},
    {name:"Gourmet de Ave Candelaria",price:11900,description:"Ave mechada con palta, tomate y lactonesa de albahaca",category:"Sandwich"},
    {name:"Mechada Italiana",price:11900,description:"Carne mechada en reducción de Cabernet Sauvignon con palta, tomate y mayonesa",category:"Sandwich"},
    {name:"Hamburguesa Candelaria",price:12900,description:"Hamburguesa casera con tocino, queso cheddar, pepinillo, tomate, lechuga",category:"Sandwich"},
    {name:"Hamburguesa King",price:10900,description:"Hamburguesa casera con tocino, queso cheddar, salsa de merkén",category:"Sandwich"},
    {name:"Croissant Caprese",price:9900,description:"Croissant tostado con queso de cabra, tomate fresco y pesto casero",category:"Sandwich"},
    {name:"Huevos Benedictinos",price:10500,description:"Huevos sobre palta cubiertos de salsa holandesa en tostadas rústicas",category:"Brunch"},
    {name:"Crostini Candelaria Palta",price:7300,description:"Pan rústico integral con semillas, palta, confitura de tomate cherry",category:"Brunch"},
    {name:"Brunch para 2",price:29900,description:"Vitaminas, fruta, yogurt, pan, queque, huevos revueltos, café o té",category:"Brunch"},
    {name:"Brunch para 1",price:15900,description:"Vitamina, fruta, yogurt, pan, queque, huevos revueltos, café o té",category:"Brunch"},
    {name:"Salmón con Risotto Verde",price:17900,description:"Salmón a la plancha con sésamo, risotto de espinaca y parmesano",category:"Platos"},
    {name:"Salmón a lo Pobre",price:16900,description:"Salmón a la plancha con papas fritas, cebolla caramelizada y huevo frito",category:"Platos"},
    {name:"Mechada con Risotto Verde",price:16900,description:"Carne mechada en reducción de Cabernet con risotto de espinaca",category:"Platos"},
    {name:"Mechada a lo Pobre",price:15900,description:"Carne mechada con papas fritas, cebolla caramelizada y huevo frito",category:"Platos"},
    {name:"Chorrillana Mechada",price:18900,description:"Papas fritas con carne mechada, cebolla caramelizada y huevos fritos",category:"Platos"},
    {name:"Ensalada Cesar con Salmón",price:14900,description:"Lechuga con salmón ahumado, crutones, tocino, parmesano",category:"Ensaladas"},
    {name:"Ensalada Mediterránea",price:13900,description:"Mix de lechugas con Jamón Serrano, queso de cabra, tomates cherry",category:"Ensaladas"},
    {name:"Ensalada Cesar con Pollo",price:12900,description:"Lechuga con pechuga a la plancha, crutones, tocino, parmesano",category:"Ensaladas"},
    {name:"Torta La Candelaria",price:5400,description:"Hojarasca, bizcocho vainilla, merengue frambuesa, manjar, crema chantilly",category:"Pastelería"},
    {name:"Torta Pompadour Almendra",price:5400,description:"Hojarasca rellena de crema de almendras, manjar y crema pastelera",category:"Pastelería"},
    {name:"Torta Tres Leches",price:5400,description:"Bizcocho de vainilla remojado en tres leches, cubierto de merengue",category:"Pastelería"},
    {name:"Torta de Zanahoria",price:5400,description:"Bizcocho húmedo de zanahoria, nueces, manjar, frosting de queso crema",category:"Pastelería"},
    {name:"Tiramisú",price:4900,description:"Capas de mascarpone, galletas de champagne remojadas en café y cacao",category:"Pastelería"},
    {name:"Cheesecake Frambuesa",price:4900,description:null,category:"Pastelería"},
    {name:"Pie de Limón",price:4900,description:"Base sablée artesanal con crema cítrica y merengue",category:"Pastelería"},
    {name:"Crêpes con Nutella y Fruta",price:5900,description:"Crêpes con nutella, frutilla y plátano, salsa de chocolate",category:"Dulces y Helados"},
    {name:"Brownie de Chocolate con Helado",price:5900,description:"Brownie de cacao al 70% con nueces, helado de vainilla",category:"Dulces y Helados"},
    {name:"Tostadas Francesas con Nutella",price:6900,description:"Tostadas francesas con nutella y salsa de berries",category:"Dulces y Helados"},
    {name:"Rollito de Canela",price:3900,description:"Masa suave y esponjosa con azúcar morena, mantequilla y canela",category:"Dulces y Helados"},
    {name:"Once Candelaria",price:29900,description:"Pan, palta, mermelada, torta, huevos, profiteroles, café o té",category:"Once"},
  ])

  // Alto Japón - solo los principales
  await insertMenu('alto-japon', [
    {name:"Tiradito salmón",price:14900,description:"Salmón en finas láminas con salsa de ají amarillo y quinoa crocante",category:"Ceviches"},
    {name:"Tiradito atún",price:14900,description:"Atún en finas láminas con salsa de maracuyá y chips de camote",category:"Ceviches"},
    {name:"Alto japón Ceviche",price:14900,description:"Salmón, camarón, pulpo, cebolla morada, albahaca, apio",category:"Ceviches"},
    {name:"Inka Ceviche",price:13900,description:"Pescado blanco, limón, cebolla morada, cilantro, choclo",category:"Ceviches"},
    {name:"Thai Ceviche",price:13900,description:"Pescado blanco, cebolla morada, piña, apio, menta, leche coco",category:"Ceviches"},
    {name:"Tokio fusión",price:8700,description:"Camarón, queso crema, palta envuelto en palta con topping de pulpo",category:"Rolls Nikkei"},
    {name:"Sour nikkei",price:8700,description:"Camarón furay, palta con tartar acevichado y emulsión cilantro",category:"Rolls Nikkei"},
    {name:"Sake nikkei",price:8700,description:"Camarón furay, palta envuelto en salmón flameado con ají amarillo",category:"Rolls Nikkei"},
    {name:"Maguro maki",price:8700,description:"Camarón furay, palta, cubierto en atún flameado con chalaquita",category:"Rolls Nikkei"},
    {name:"Alto Nikkei",price:8200,description:"Camarón furay, palta cubierto en ceviche peruano de salmón",category:"Rolls Nikkei"},
    {name:"Shiringuito",price:7900,description:"Camarón, queso crema, albahaca cubierto de salmón",category:"Rolls Nikkei"},
    {name:"Ramen Miso",price:10900,description:"Pasta de miso, fideos trigo, verduras, huevo. Cerdo o vegetariano",category:"Platos Calientes"},
    {name:"Lomo Saltado",price:14900,description:"Lomo salteado en salsa soya con arroz y papas",category:"Platos Calientes"},
    {name:"Burger Godzilla",price:10000,description:"Apanada panko, cheddar, cebolla caramelizada, pepinillos",category:"Platos Calientes"},
    {name:"Wok alto",price:13900,description:"Fideos huevo salteado con carne, camarones, verduras",category:"Platos Calientes"},
    {name:"Yakimeshi especial",price:8900,description:"Arroz salteado con pollo, camarón y verduras",category:"Platos Calientes"},
    {name:"Rukawa",price:8700,description:"Camarón o salmón, champiñón, queso crema, palta envuelto salmón",category:"Rolls sin arroz"},
    {name:"Bigan",price:9100,description:"Palta, palmito, almendras, lechuga, champiñón envuelto en palta",category:"Rolls sin arroz"},
    {name:"Poke japón",price:8700,description:"Bowl arroz, palta, cebollín, salmón, camarón, sésamo",category:"Poke Bowls"},
    {name:"Poke tori",price:7600,description:"Bowl arroz, pollo teriyaki, palta, pepino, queso crema",category:"Poke Bowls"},
    {name:"Limeño",price:8700,description:"Bowl ceviche pulpo camarón, palta, chips plátano",category:"Poke Bowls"},
    {name:"Volcán de chocolate",price:7900,description:"Biscocho chocolate relleno fundido con helado vainilla",category:"Postres"},
    {name:"Mochi Japonés",price:3200,description:"Postre harina arroz relleno cheesecake, frambuesa u oreo",category:"Postres"},
  ])

  // Royal
  await insertMenu('royal', [
    {name:"Classic Royal",price:8990,description:"Doble burger, doble cheddar, tomate, lechuga, salsa tártara",category:"Hamburguesas"},
    {name:"Villarica Smoke",price:9990,description:"Doble Burger, doble queso mozzarella, salsa smoke",category:"Hamburguesas"},
    {name:"Futangue",price:9990,description:"Doble Burger, doble cheddar, cebolla caramelizada, tocino, berros",category:"Hamburguesas"},
    {name:"Pomerape",price:9990,description:"Doble Burger, doble cheddar, cebolla caramelizada, tocino, sriracha",category:"Hamburguesas"},
    {name:"Los Cuervos",price:8990,description:"Pollo frito bañado en miel de ajos, queso cheddar, pepinos encurtidos",category:"Hamburguesas"},
    {name:"Matanzas",price:8990,description:"Pollo frito, queso cheddar, guacamole, nachos",category:"Hamburguesas"},
    {name:"Sandwich Pupuya",price:11990,description:"Láminas de lomo liso con chimichurri, cebollas grilladas",category:"Sandwiches"},
    {name:"Sandwich Totoralillo",price:10990,description:"Pollo frito en salsa gochujang, queso cheddar, pepinos encurtidos",category:"Sandwiches"},
    {name:"Tártaro Rapa Nui",price:9990,description:"Cubos de atún con salsa coreana, mayonesa de ajo asado cítrica",category:"Piqueos Frios"},
    {name:"Tártaro Futaleufú",price:13990,description:"Tártaro de filete de res, cebolla, alcaparras, pepino encurtido",category:"Piqueos Frios"},
    {name:"Tártaro Puelo",price:11990,description:"Tártaro de salmón fresco con cebolla, pepino, polvo de nori",category:"Piqueos Frios"},
    {name:"Ceviche Atún Chiloe",price:11990,description:"Atún crudo, cebolla morada, rocoto, maíz cancha",category:"Piqueos Frios"},
    {name:"Ceviche Yelcho",price:11990,description:"Salmón fresco, cebolla morada, cilantro, choclo peruano",category:"Piqueos Frios"},
    {name:"Trilogia de Tartaros",price:18990,description:"Tártaro de vacuno, salmón y alcachofas con tostadas",category:"Piqueos Frios"},
    {name:"Tacos de Birria",price:11490,description:"Quesabirria de vacuno, salsa verde, mozzarella, caldo de birria",category:"Piqueos Calientes"},
    {name:"Tacos de Camarón",price:10990,description:"Camarones apanados, mousse de palta, cebolla morada",category:"Piqueos Calientes"},
    {name:"Tacos de Carne",price:12990,description:"Desmechado de vacuno, puré de palta, pico de gallo",category:"Piqueos Calientes"},
    {name:"Flat Iron",price:18990,description:"300 gr a la parrilla con mantequilla ranchera, papas fritas",category:"Fondos"},
    {name:"Entraña Aconcagua",price:24990,description:"Entraña a la parrilla con chimichurri y papas fritas",category:"Fondos"},
    {name:"Salmón Risotto",price:13990,description:"Salmón en almíbar de cerveza con risotto de cebollas",category:"Fondos"},
    {name:"Lomo Cazadero",price:15990,description:"Lomo liso a la parrilla con pastelera de choclo y ensalada chilena",category:"Fondos"},
    {name:"Fetuccini Torres del Paine",price:16990,description:"Milanesa gratinada con mozzarella sobre fetuccinis en salsa pesto",category:"Fondos"},
    {name:"Pie de Limón",price:7990,description:"Base galleta, relleno Key Lime, merengue, salsa de caramelo",category:"Postres"},
    {name:"Volcán de Chocolate",price:5490,description:"Volcán chocolate tibio, helado vainilla, arándanos, frutillas",category:"Postres"},
    {name:"Brownie con Helado",price:6990,description:"Brownie tibio de chocolate con fudge y helado de vainilla",category:"Postres"},
    {name:"Churros Conguillio",price:4990,description:"Churros con salsa de manjar, 10 unidades",category:"Postres"},
  ])

  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })

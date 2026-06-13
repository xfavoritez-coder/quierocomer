import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const slug = "rocoto-cusqueno";
  const passwordHash = await bcrypt.hash(`${slug}2026`, 10);

  let owner = await prisma.restaurantOwner.findFirst({ where: { email: "favoritez@gmail.com" } });
  if (!owner) {
    owner = await prisma.restaurantOwner.create({
      data: { name: "Admin QC", email: "favoritez@gmail.com", passwordHash, role: "OWNER" },
    });
  }

  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Rocoto Cusqueño", slug,
      description: "Primer restaurant de comida vegana peruana en Chile",
      cartaTheme: "PREMIUM", cartaColorMode: "DARK", defaultView: "lista",
      enabledLangs: ["es", "en", "pt"], isActive: true, isDemo: true,
      weeklyEmailEnabled: true, plan: "PREMIUM", subscriptionStatus: "NONE",
      waiterPanelActive: true, menuImported: true, multiMenuEnabled: true,
      dietType: "VEGAN", instagram: "rocotocusqueno",
      website: "https://linktr.ee/rocotocusqueno", ownerId: owner.id,
    },
  });
  console.log("Restaurant:", restaurant.id);

  // ROCOTO CUSQUEÑO
  const rc = {
    entradas: await prisma.category.create({ data: { restaurantId: restaurant.id, name: "Entradas", position: 0, dishType: "entry" } }),
    fondos: await prisma.category.create({ data: { restaurantId: restaurant.id, name: "Fondos", position: 1, dishType: "food" } }),
    acomp: await prisma.category.create({ data: { restaurantId: restaurant.id, name: "Acompañamientos", position: 2, dishType: "food" } }),
    salsas: await prisma.category.create({ data: { restaurantId: restaurant.id, name: "Salsas", position: 3, dishType: "extra" } }),
    postres: await prisma.category.create({ data: { restaurantId: restaurant.id, name: "Postres", position: 4, dishType: "dessert" } }),
  };

  // BORO
  const bo = {
    picoteos: await prisma.category.create({ data: { restaurantId: restaurant.id, name: "Picoteos", position: 5, dishType: "entry" } }),
    compartir: await prisma.category.create({ data: { restaurantId: restaurant.id, name: "Para Compartir", position: 6, dishType: "food" } }),
    chorrillanas: await prisma.category.create({ data: { restaurantId: restaurant.id, name: "Chorrillanas", position: 7, dishType: "food" } }),
    salsas: await prisma.category.create({ data: { restaurantId: restaurant.id, name: "Salsas", position: 8, dishType: "extra" } }),
  };

  // BEBESTIBLES
  const be = {
    bebidas: await prisma.category.create({ data: { restaurantId: restaurant.id, name: "Bebidas y Jugos", position: 9, dishType: "drink" } }),
    clasicos: await prisma.category.create({ data: { restaurantId: restaurant.id, name: "Cócteles Clásicos", position: 10, dishType: "drink" } }),
    destilados: await prisma.category.create({ data: { restaurantId: restaurant.id, name: "Destilados y Spritz", position: 11, dishType: "drink" } }),
    cerveza: await prisma.category.create({ data: { restaurantId: restaurant.id, name: "Cerveza", position: 12, dishType: "drink" } }),
    micheladas: await prisma.category.create({ data: { restaurantId: restaurant.id, name: "Micheladas", position: 13, dishType: "drink" } }),
    cockCerveza: await prisma.category.create({ data: { restaurantId: restaurant.id, name: "Cocktelería con Cerveza", position: 14, dishType: "drink" } }),
    vinos: await prisma.category.create({ data: { restaurantId: restaurant.id, name: "Vinos", position: 15, dishType: "drink" } }),
    autor: await prisma.category.create({ data: { restaurantId: restaurant.id, name: "Cocktelería de Autor", position: 16, dishType: "drink" } }),
  };

  const dishes: { cat: string; name: string; desc: string | null; price: number }[] = [
    // ROCOTO - Entradas
    { cat: rc.entradas.id, name: "Ceviche de Setas", desc: "Fresco ceviche a base de champiñón ostra con leche de tigre, camote, rocoto, cancha, maíz peruano, cebolla morada y lechuga.", price: 14200 },
    { cat: rc.entradas.id, name: "Picoteo Rocoto Cusqueño", desc: "Mixtura de crocantes con aros de cebolla, patacones, chicharrón de setas y salsas de la casa.", price: 19500 },
    { cat: rc.entradas.id, name: "Papa a la Huancaína", desc: "Clásicas papas cremosas con una fina capa crujiente bañadas en salsa a la huancaína a base de ají amarillo peruano.", price: 13800 },
    // ROCOTO - Fondos
    { cat: rc.fondos.id, name: "Arroz 3 Sabores con Salsa a la Huancaína", desc: "Arroz chifa a las especias orientales, salteados con salchicha vegetal, cebollín, zanahoria, pimentón, huevo vegano coronado con tofu.", price: 14600 },
    { cat: rc.fondos.id, name: "Fetuccinis Saltados", desc: "Fetuccinis con tofu flambeado y salteado en salsa de soya con cebolla, tomate, ají amarillo y especias.", price: 14200 },
    { cat: rc.fondos.id, name: "Tofu Saltado", desc: "Trozos de tofu, cebolla y tomates en gajos salteados en salsa de soya con ají amarillo peruano, jengibre y especias acompañado de papas rústicas y arroz.", price: 14400 },
    { cat: rc.fondos.id, name: "Fetuccinis a la Huancaína con Tofu Saltado", desc: "Cremosos fetuccinis en salsa a la huancaína acompañado de tofu flambeado y salteado en salsa de soya.", price: 14400 },
    { cat: rc.fondos.id, name: "Jalea Peruana", desc: "Chicharrón de setas bañados en leche de tigre, acompañado de yuca frita, sarza criolla, vinagreta y lechuga.", price: 15600 },
    { cat: rc.fondos.id, name: "Ají de Seitán", desc: "Seitán desmechado en crema de ají amarillo peruano coronado con maní tostado, con base de papas semicrocantes acompañado con arroz blanco.", price: 14600 },
    { cat: rc.fondos.id, name: "Chorrisaltada", desc: "Trozos de tofu, cebolla y tomates salteados en salsa de soya con ají amarillo, jengibre y especias acompañado de 600g papas fritas rústicas.", price: 19200 },
    // ROCOTO - Acompañamientos
    { cat: rc.acomp.id, name: "Yuca Frita con Salsa de la Casa", desc: null, price: 14200 },
    { cat: rc.acomp.id, name: "Papas Rústicas Fritas Pequeñas (240gr)", desc: "Crujientes papas fritas rústica con salsa a elección.", price: 3900 },
    { cat: rc.acomp.id, name: "Papas Rústicas Fritas Grandes (600gr)", desc: "Crujientes papas fritas rústica con salsa a elección.", price: 7500 },
    { cat: rc.acomp.id, name: "Aros de Cebolla con Salsa", desc: "Crocantes aros de cebolla con sabrosa salsa a elección.", price: 6400 },
    { cat: rc.acomp.id, name: "Porción de Arroz", desc: null, price: 3200 },
    // ROCOTO - Salsas
    { cat: rc.salsas.id, name: "BBQ", desc: null, price: 1800 },
    { cat: rc.salsas.id, name: "Ranch", desc: null, price: 1800 },
    { cat: rc.salsas.id, name: "Salsa de Rocoto", desc: null, price: 1800 },
    { cat: rc.salsas.id, name: "Vinagreta Peruana", desc: null, price: 1800 },
    { cat: rc.salsas.id, name: "Mayonesa de Olivo", desc: null, price: 1800 },
    { cat: rc.salsas.id, name: "Salsa Suprema", desc: null, price: 1800 },
    { cat: rc.salsas.id, name: "Salsa Buffalo", desc: null, price: 1800 },
    // ROCOTO - Postres
    { cat: rc.postres.id, name: "Besito Moza", desc: "Postre helado a base de galleta de vainilla con crema chantilly, maracuyá y manjar de soya, bañada en chocolate amargo, montada con nuez.", price: 6400 },
    { cat: rc.postres.id, name: "Suspiro Limeño", desc: "Postre tradicional peruano con base de manjar blanco, coronado con un suave merengue italiano de vino oporto.", price: 6700 },
    // BORO - Picoteos
    { cat: bo.picoteos.id, name: "Mozzarela Sticks con Salsa Ranch", desc: "3 crujientes y cremosas barritas de mozza derretido y empanizados, bañados en salsa a elección.", price: 7400 },
    { cat: bo.picoteos.id, name: "Aros de Cebolla con Salsa", desc: "Crocantes aros de cebolla con sabrosa salsa.", price: 6400 },
    { cat: bo.picoteos.id, name: "Tofu Crispy con Salsa Acevichada", desc: "Sabroso tofu crispy bañado en fresca salsa acevichada al estilo peruano.", price: 7300 },
    { cat: bo.picoteos.id, name: "Tofu Crispy con Salsa Suprema", desc: "Tofu sazonado y empanizado en panko con untuosa salsa suprema.", price: 7300 },
    { cat: bo.picoteos.id, name: "Salchipapa con Salsa", desc: "360 gramos de papas rústicas con salchichas veganas y salsa a elección.", price: 6800 },
    // BORO - Para Compartir
    { cat: bo.compartir.id, name: "La Pecadora de la Casa", desc: "Exquisita tabla con crujientes fingers de soya broaster, aros de cebolla, patacones y trilogía de salsas.", price: 20400 },
    { cat: bo.compartir.id, name: "La Peruvian", desc: "Crujientes champiñones apañados con salsas de huancaína, tofu con salsa acevichada y papas rústicas con salsa de olivo.", price: 19900 },
    { cat: bo.compartir.id, name: "La Parrillera", desc: "Jugoso seitán flambeado con chimichurri, champiñones apañados, con papas rústicas y salsa ranch.", price: 19900 },
    // BORO - Chorrillanas
    { cat: bo.chorrillanas.id, name: "La Chesse", desc: "600g de papas rústicas crujientes bañadas en cheddar, salsa ácida y cebollín.", price: 19900 },
    { cat: bo.chorrillanas.id, name: "La Rústica", desc: "600g de papas rústicas sazonadas con salsa ácida, cebolla caramelizada y champiñón apanado.", price: 19900 },
    { cat: bo.chorrillanas.id, name: "La Mechada", desc: "600g de papas rústicas con sabroso seitán mechado y queso mozza.", price: 19900 },
    // BORO - Salsas
    { cat: bo.salsas.id, name: "BBQ", desc: null, price: 1800 },
    { cat: bo.salsas.id, name: "Ranch", desc: null, price: 1800 },
    { cat: bo.salsas.id, name: "Salsa de Rocoto", desc: null, price: 1800 },
    { cat: bo.salsas.id, name: "Vinagreta Peruana", desc: null, price: 1800 },
    { cat: bo.salsas.id, name: "Mayonesa de Olivo", desc: null, price: 1800 },
    { cat: bo.salsas.id, name: "Salsa Suprema", desc: null, price: 1800 },
    { cat: bo.salsas.id, name: "Salsa Buffalo", desc: null, price: 1800 },
    // BEBESTIBLES - Bebidas y Jugos
    { cat: be.bebidas.id, name: "Limonada", desc: "Simple · Jengibre · Menta jengibre", price: 2990 },
    { cat: be.bebidas.id, name: "Jugo Natural", desc: "Mango · Frambuesa · Maracuyá", price: 3290 },
    { cat: be.bebidas.id, name: "Coca-Cola / Coca-Cola Zero", desc: null, price: 2300 },
    { cat: be.bebidas.id, name: "Inka Cola", desc: null, price: 2690 },
    { cat: be.bebidas.id, name: "Agua con/sin Gas", desc: null, price: 2100 },
    { cat: be.bebidas.id, name: "Chicha Morada", desc: null, price: 4350 },
    // Clásicos
    { cat: be.clasicos.id, name: "Pisco Sour de la Casa", desc: "Pisco Tabernero, jugo de limón sutil, cordial de ají y lima, aquafaba.", price: 5990 },
    { cat: be.clasicos.id, name: "Pisco Sour", desc: "Pisco, limón, syrup simple y aquafaba.", price: 4990 },
    { cat: be.clasicos.id, name: "Mojito Tradicional", desc: "Ron blanco, limón, menta, syrup simple y soda.", price: 5990 },
    { cat: be.clasicos.id, name: "Mojitos Sabores", desc: "Maracuyá · Frambuesa · Mango. Ron blanco, limón, menta, syrup simple y soda.", price: 6190 },
    { cat: be.clasicos.id, name: "Piña Colada", desc: "Ron blanco, crema de coco y jugo de piña.", price: 5690 },
    { cat: be.clasicos.id, name: "Daiquiri", desc: "Ron blanco, limón y syrup simple. Sabores: maracuyá, frambuesa o mango.", price: 5390 },
    { cat: be.clasicos.id, name: "Bloody Mary", desc: "Vodka, jugo de tomate, limón, salsa inglesa, tabasco, sal y pimienta.", price: 5990 },
    { cat: be.clasicos.id, name: "Bloody María", desc: "Tequila, jugo de tomate, limón, salsa inglesa, tabasco, sal y pimienta.", price: 6290 },
    { cat: be.clasicos.id, name: "Tequila Margarita", desc: "Tequila, triple sec y jugo de limón.", price: 5690 },
    { cat: be.clasicos.id, name: "Tropical Gin", desc: "Gin, maracuyá y RedBull amarilla.", price: 6990 },
    // Destilados
    { cat: be.destilados.id, name: "Johnnie Walker Red Label", desc: null, price: 5990 },
    { cat: be.destilados.id, name: "Johnnie Walker Black Label", desc: null, price: 7990 },
    { cat: be.destilados.id, name: "Tom Collins", desc: "Gin, limón, syrup simple y soda.", price: 6390 },
    { cat: be.destilados.id, name: "Moscow Mule", desc: "Vodka, limón y ginger beer.", price: 6590 },
    { cat: be.destilados.id, name: "London Mule", desc: "Gin, limón y ginger beer.", price: 6990 },
    { cat: be.destilados.id, name: "Aperol Spritz", desc: "Aperol, espumante y soda.", price: 5990 },
    { cat: be.destilados.id, name: "Ramazzotti Spritz", desc: "Ramazzotti Rosato, espumante y soda.", price: 5990 },
    { cat: be.destilados.id, name: "Ruso Blanco", desc: "Vodka, licor de café y crema.", price: 6490 },
    { cat: be.destilados.id, name: "Espresso Martini", desc: "Vodka, licor de café, syrup simple y espresso.", price: 6290 },
    { cat: be.destilados.id, name: "Espumante", desc: "Copa de espumante Valdivieso brut 12°.", price: 4500 },
    { cat: be.destilados.id, name: "Negroni", desc: "Gin, Campari y vermouth rosso.", price: 6190 },
    { cat: be.destilados.id, name: "Gin Tonic", desc: "Gin, agua tónica y garnish cítrico.", price: 5690 },
    { cat: be.destilados.id, name: "Sangría", desc: "Vino, pisco, frutas de estación y toque cítrico.", price: 5500 },
    { cat: be.destilados.id, name: "Shot Jäger", desc: "Jägermeister helado.", price: 3990 },
    { cat: be.destilados.id, name: "Shot Tequila", desc: "Tequila con limón y sal.", price: 3990 },
    { cat: be.destilados.id, name: "Chardonnay Sour", desc: "Chardonnay, limón y syrup.", price: 5890 },
    { cat: be.destilados.id, name: "Amaretto Sour", desc: "Gin, Campari y vermouth rosso.", price: 5690 },
    { cat: be.destilados.id, name: "El Padrino", desc: "Whisky y Amaretto.", price: 6980 },
    { cat: be.destilados.id, name: "Campari Tonic", desc: "Campari y agua tónica.", price: 6500 },
    { cat: be.destilados.id, name: "Campari Spritz", desc: "Campari, espumante y agua con gas.", price: 6980 },
    { cat: be.destilados.id, name: "Vodka Tonic", desc: "Vodka y agua tónica.", price: 6290 },
    { cat: be.destilados.id, name: "Piscola", desc: "Pisco y Coca cola.", price: 4990 },
    // Cerveza
    { cat: be.cerveza.id, name: "Shop Artesanal", desc: "Amber Ale · Robust Potter · Blond Ale", price: 5990 },
    { cat: be.cerveza.id, name: "Shop Royal", desc: null, price: 3990 },
    { cat: be.cerveza.id, name: "Heineken 0°", desc: null, price: 4290 },
    // Micheladas (sin costo adicional a la cerveza)
    { cat: be.micheladas.id, name: "Dirty Michelada", desc: "Aceitunas verdes rellenas de pimentón, salsa inglesa, jugo de aceitunas, limón y tabasco.", price: 0 },
    { cat: be.micheladas.id, name: "Michelada de Leche de Tigre", desc: "Leche de tigre al estilo peruano, tabasco y limón.", price: 0 },
    { cat: be.micheladas.id, name: "Pepichelada", desc: "Pepinillos encurtidos, salsa inglesa, tabasco y limón.", price: 0 },
    { cat: be.micheladas.id, name: "La Mexicana", desc: "Jugo de tomate, limón, salsa inglesa y tabasco.", price: 0 },
    { cat: be.micheladas.id, name: "Michelada Clásica", desc: "Limón, salsa inglesa y tabasco.", price: 0 },
    { cat: be.micheladas.id, name: "Chelada", desc: "Limón con borde de sal y/o merkén.", price: 0 },
    // Cocktelería con Cerveza
    { cat: be.cockCerveza.id, name: "Robust Martini", desc: "Vodka, espresso, syrup de anís y cerveza Robust Porter.", price: 6990 },
    { cat: be.cockCerveza.id, name: "Amber Gin Ale", desc: "Gin, limón, cordial de ají, maracuyá y cerveza Amber Ale.", price: 6990 },
    { cat: be.cockCerveza.id, name: "Blond Whisky", desc: "Whisky escocés, jugo de naranja, limón, jengibre y cerveza Blond Ale.", price: 7590 },
    // Vinos
    { cat: be.vinos.id, name: "Copa de Vino Tinto o Blanco", desc: "Oveja Negra Carmenere · Santa Ema Merlot · Calitera Cabernet Sauvignon · Errázuriz Chardonnay.", price: 4890 },
    { cat: be.vinos.id, name: "Botella de Vino Tinto o Blanco", desc: "Oveja Negra Carmenere · Oveja Negra Merlot · Calitera Cabernet Sauvignon · Santa Ema Chardonnay.", price: 17890 },
    // Cocktelería de Autor
    { cat: be.autor.id, name: "Noche Estrellada", desc: "Mistral Nobel, Fireball y espresso con notas anisadas y aroma cítrico de naranja.", price: 7590 },
    { cat: be.autor.id, name: "Pe Marina", desc: "Tequila, mango y limón con cordial de ají amarillo peruano, borde de sal de sésamo y merkén.", price: 6990 },
    { cat: be.autor.id, name: "Amelie", desc: "Gin y Ramazzotti con pomelo fresco, limón y syrup de romero. Herbal, cítrico y aromático.", price: 6990 },
    { cat: be.autor.id, name: "Bunny Vodka", desc: "Vodka infusionado en jengibre con jugos de zanahoria y naranja, limón, agave y menta fresca.", price: 6990 },
    { cat: be.autor.id, name: "Velvet Coco", desc: "Coco cremoso, frambuesas y ron blanco con un toque cítrico.", price: 7590 },
    { cat: be.autor.id, name: "Patricia", desc: "Mango, crema de coco y crema con ron blanco y notas almendradas del Amaretto.", price: 7290 },
  ];

  let pos = 0;
  for (const d of dishes) {
    await prisma.dish.create({
      data: {
        restaurantId: restaurant.id, categoryId: d.cat,
        name: d.name, description: d.desc, price: d.price,
        photos: [], position: pos++, dishDiet: "VEGAN", isActive: true,
      },
    });
  }
  console.log(`Created ${dishes.length} dishes`);

  // Menu Groups
  const mgRocoto = await prisma.menuGroup.create({ data: { restaurantId: restaurant.id, name: "Rocoto Cusqueño", slug: "rocoto-cusqueno", description: "Comida vegana peruana", position: 0 } });
  const mgBoro = await prisma.menuGroup.create({ data: { restaurantId: restaurant.id, name: "Boro Restaurant", slug: "boro", description: "Picoteos, tablas y chorrillanas", position: 1 } });
  const mgBeb = await prisma.menuGroup.create({ data: { restaurantId: restaurant.id, name: "Bebestibles", slug: "bebestibles", description: "Cócteles, cervezas y vinos", position: 2 } });

  await prisma.category.updateMany({ where: { id: { in: [rc.entradas.id, rc.fondos.id, rc.acomp.id, rc.salsas.id, rc.postres.id] } }, data: { menuGroupId: mgRocoto.id } });
  await prisma.category.updateMany({ where: { id: { in: [bo.picoteos.id, bo.compartir.id, bo.chorrillanas.id, bo.salsas.id] } }, data: { menuGroupId: mgBoro.id } });
  await prisma.category.updateMany({ where: { id: { in: [be.bebidas.id, be.clasicos.id, be.destilados.id, be.cerveza.id, be.micheladas.id, be.cockCerveza.id, be.vinos.id, be.autor.id] } }, data: { menuGroupId: mgBeb.id } });

  console.log("Done! URL: https://quierocomer.cl/qr/" + slug);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });

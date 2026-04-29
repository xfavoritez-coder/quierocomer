import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const updates: Record<string, string> = {
  "Manglar": "Exquisito tiradito con 8 Finas láminas de salmón vegano al estilo sashimi, bañadas en una vibrante salsa acevichada de cilantro",
  "HFC": "Champiñones rehidratados servidos en una sabrosa salsa HFC, inspirada en sabores peruanos, sobre una cama de vegetales frescos marinados",
  "Champi furai": "Exquisitos champiñones seleccionados, rellenos de queso crema vegano acevichado con toques de ciboulette, envueltos en panko crujiente",
  "Tofu Finger": "8 unidades de crujientes palitos de tofu empanizados y cubiertos con una cremosa salsa huancaína y especias",
  "Olivo Trufado": "Roll relleno de crujiente champiñón furai, suave tofu y cremoso queso crema vegano, coronado con tartar trufado al olivo",
  "11:11": "Relleno con queso crema vegano, suave palta, cebollín fresco y champiñones, coronado con puré cremoso de camote",
  "Tartar Sake": "Relleno de champiñón furai y palta, cubierto con tartar de salmón vegano, coronado con caviar de tapioca",
  "Osiris": "Relleno de champiñones furai con palta fresca, cebollín, coronado con tartar de coliflor a la huancaína",
  "Batayaki": "Relleno de camote furai, palta, cebollín y champiñón furai, coronado con delicado tartar de palmito",
  "Palta Parrillera": "Champiñón tempura, queso crema, cebollín envuelto en palta, cubierto y gratinado con salsa parrilera flameada",
  "Pharaon": "Crujiente tofu furai, cremosa palta y suave camote, coronados con salsa huancaína del chef y criolla de cebolla morada",
  "Anubis": "Sin arroz. Relleno de seitán, queso crema vegano, palta, camote furai, cebolla tempura, champiñón furai envuelto en nori tempurizado",
  "Seth Roll": "Delicado champiñón furai envuelto en nori tempurizado, realzado con tartar de tofu, cremosa palta y cebollín fresco",
  "Amon-ra": "Suave camote furai y cremosa palta, envueltos en nori crocante frito en tempura, coronados con topping de shichimi",
  "Muelle": "Plato dividido en dos mitades: una con quinoa, kimchi fermentado, tomates cherry y wakame; otra con queso fundido y gratinado",
  "Bosque mágico": "Arroz aromatizado al cilantro con seitán a la parrilla y marinada anticuchera, verduras cocidas al vacío",
  "Arrecife": "Delicados fideos frios de camote con trufas, infusionados con esencia de algas marinas, acompañados de caviar de tapioca",
  "Galaxy": "Touil de gyozas rellenas de hummus sobre colchón fresco de mix de hojas con salsa acevichada",
  "Desierto": "Coliflor a la parrilla sobre hummus de legumbres maceradas, servida con brotes, tomates cherry",
  "Miso Ramen": "Ramen con base de miso vegana, fideos de trigo, tofu macerado y flambeado, champiñones en panko",
  "Seitán Ramen": "Ramen de miso vegano con ají amarillo, seitán anticuchero, gyozas de verduras, espinaca",
  "Brisa tropical": "Mocktail que mezcla mango y maracuyá con cilantro fresco y ginger beer de maracuyá",
  "Atardecer Andino": "Mezcla que fusiona syrup de chicha morada, arándanos, mandarina, menta y kombucha de naranja",
  "Elixir de Isis": "Jugo de zanahoria y naranja realzado con cordial de pomelo, ginger beer, borde de sal de naranja",
  "Jugo Natural": "Jugos naturales en frambuesa, maracuyá, piña, mango o chirimoya, 500cc",
  "Limonada Artesanal": "Tradicional o en variantes de menta-jengibre, frutilla, maracuyá o mango, 500cc",
  "Kombucha": "Kombuchas Bruggas con sabores naturales únicos, exóticos y vibrantes",
  "Tiramisú Vegano": "Delicado bizcocho de vainilla humectado con café y whisky, relleno con crema de mascarpone vegana",
  "Brownie con helado": "Brownie con chocolate belga 55%, harina de trigo, semillas de chía y nueces, con helado artesanal",
  "Dulce estelar": "Cheesecake con base de avena y maní, relleno de castañas de cajú, coronado con mermelada de frutos rojos",
};

async function main() {
  const restaurant = await p.restaurant.findFirst({ where: { slug: "horusvegan" }, select: { id: true } });
  if (!restaurant) { console.log("No encontrado"); return; }

  let updated = 0;
  for (const [name, description] of Object.entries(updates)) {
    // Try exact match first, then case-insensitive with trim
    const dish = await p.dish.findFirst({
      where: { restaurantId: restaurant.id, name: { contains: name, mode: "insensitive" }, isActive: true, deletedAt: null },
      select: { id: true, name: true, description: true },
    });
    if (!dish) {
      console.log(`❌ No encontrado: ${name}`);
      continue;
    }
    if (dish.description === description) {
      console.log(`✓ Ya está bien: ${dish.name}`);
      continue;
    }
    await p.dish.update({ where: { id: dish.id }, data: { description } });
    console.log(`✅ Actualizado: ${dish.name}`);
    updated++;
  }

  console.log(`\nTotal actualizados: ${updated}`);
  await p.$disconnect();
}
main();

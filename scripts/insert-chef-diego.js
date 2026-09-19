const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();
const RESTAURANT_ID = 'cmu8i8rsv0000jq04w1w97v9r';

const newCategories = [
  {
    name: 'Entradas Calientes', position: 3,
    dishes: [
      { name: 'Brochetas al Grill', price: 12900, description: 'Vacuno y camarón marinados con salsa anticuchera, acompañados con yuca y salsa criolla.' },
      { name: 'Ostiones a la Parmesana', price: 16900, description: 'Exquisitos ostiones flameados con vino blanco y gratinados con queso parmesano y mozarela.' },
      { name: 'Camarón al Ajillo', price: 11900, description: 'Camarones y pulpo salteados con aceite de oliva, flameados en coñac con salsas de ají amarillo.' },
      { name: 'Alcachofa Trujillo', price: 11900, description: 'Fondos de alcachofas rellenos con camarones y champiñones gratinados y bañados en salsa bechamel.' },
      { name: 'Tequeños', price: 12900, description: 'Rellenos de queso y camarón.' },
    ]
  },
  {
    name: 'Chicharrones', position: 4,
    dishes: [
      { name: 'Chicharrón de Camarón', price: 13900, description: 'Apanado con harina fritos, acompañado de yuca dorada o papa frita.' },
      { name: 'Chicharrón de Calamar', price: 11900, description: 'Apanado con harina fritos, acompañado de yuca dorada o papa frita.' },
      { name: 'Chicharrón Mixto', price: 13900, description: 'Apanado con harina fritos, acompañado de yuca dorada o papa frita.' },
      { name: 'Chicharrón de Pescado', price: 11900, description: 'Apanado con harina fritos, acompañado de yuca dorada o papa frita.' },
      { name: 'Chicharrón de Pulpo', price: 13900, description: 'Apanado con harina fritos, acompañado de yuca dorada o papa frita.' },
      { name: 'Chicharrón de Pollo', price: 11500, description: 'Apanado con harina fritos, acompañado de yuca dorada o papa frita.' },
    ]
  },
  {
    name: 'Ceviches', position: 5,
    dishes: [
      { name: 'Ceviche Chef Diego', price: 13900, description: 'Trozos de atún y salmón con pulpo y camarón marinado con leche de tigre, bañados con una pasta de rocoto acompañado con choclos, yuca, cancha peruana y cebolla morada.' },
      { name: 'Ceviche de la Casa', price: 12900, description: 'Calamar, camarón, machas y pescado del día cortado en dados, marinado con limón de pica y pasta cevichera de ají amarillo, acompañado con choclo, yuca, cancha peruana y cebolla morada.' },
      { name: 'Ceviche Mixto', price: 12900, description: 'Pescado cortado en dados con surtido de mariscos, marinado con limón de pica acompañados con choclo, yuca cancha peruana y cebolla morada.' },
      { name: 'Ceviche Atún', price: 13500, description: 'Atún rojo cortado en dados marinado con limón de pica y un toque de ají, acompañados con choclo, yuca cancha peruana y cebolla morada.' },
      { name: 'Ceviche Salmón Nikke', price: 13900, description: 'Salmón cortado en dados con camarones y champiñones, marinados con limón de pica y salsa oriental, acompañado con palta, choclos, yuca, cancha peruana y cebolla morada.' },
      { name: 'Ceviche de Pescado', price: 11900, description: 'Pescado cortado en dados, marinado con limón de pica y un toque de ají, acompañado con yuca, cancha peruana y cebolla morada.' },
      { name: 'Ceviche Carretillero', price: 11900, description: 'Pescado cortado en dados, marinado con limón de pica acompañados con choclo, yuca cancha peruana y cebolla morada, junto a unos suaves y crujientes aros de calamar fritos.' },
    ]
  },
  {
    name: 'Tradiciones del Perú', position: 6,
    dishes: [
      { name: 'Lomo Saltado', price: 16400, description: 'Trozos de filete salteados al wok con salsa de soya, cebolla, tomate, servido con arroz y papas fritas.' },
      { name: 'Ají de Gallina', price: 13400, description: 'Pollo deshilachado con cremosa salsa de ají amarillo y clásica receta peruana.' },
      { name: 'Tacu Tacu', price: 16400, description: 'Trozos de filete al jugo, servido sobre una combinación de arroz y porotos al wok.' },
      { name: 'Seco de Asado de Tira a lo Norteño', price: 17900, description: 'Costillar de vacuno macerado con cerveza negra, chicha de jora, reducción de salsa de cilantro y finos aliños, servidos con arroz y cremosos porotos o tacu tacu.' },
      { name: 'Arroz con Mariscos', price: 15900, description: 'Deliciosa preparación que combina el sabor y textura del arroz con una variedad de mariscos.' },
    ]
  },
  {
    name: 'Chaufa', position: 7,
    dishes: [
      { name: 'Chaufa Tres Sabores', price: 15900, description: 'Sabor peruano-chino, trozos de vacuno, ave, camarón con arroz graneado y salteados en wok, aderezados con salsa de soya, sésamo y ostras.' },
      { name: 'Chaufa de Pollo', price: 12900, description: 'Arroz graneado con pollo salteado en wok, aderezado con salsa de soya, sésamo y ostras.' },
      { name: 'Chaufa de Carne', price: 15900, description: 'Arroz graneado con carne salteada en wok, aderezado con salsa de soya, sésamo y ostras.' },
      { name: 'Chaufa de Camarón', price: 16400, description: 'Arroz graneado con camarones salteados en wok, aderezado con salsa de soya, sésamo y ostras.' },
      { name: 'Chaufa de Mariscos', price: 16400, description: 'Arroz graneado con mariscos salteados en wok, aderezado con salsa de soya, sésamo y ostras.' },
    ]
  },
  {
    name: 'Pescados y Mariscos', position: 8,
    dishes: [
      { name: 'Atún del Chef', price: 16400, description: 'Atún rojo, apanado en costra de quinoa, bañado en salsa de huacatay con camarones, acompañados con un exquisito risotto tradicional.' },
      { name: 'Atún Chimichurri', price: 16400, description: 'Trozos de atún a la plancha, con pinceladas de chimichurri de la casa, acompañado con un exquisito risotto de champiñones al vino tinto.' },
      { name: 'Arequipeña', price: 15900, description: 'Trozos de pescado a la plancha bañado en salsa de rocoto con camarones ecuatorianos, flameado al whisky servido con risotto de espinaca.' },
      { name: 'Salmón Oriental', price: 15400, description: 'Salmón a la plancha, con camarones y calamar, bañado en una salsa oriental, salsa de soya y salsa de ostras con verduras.' },
      { name: 'Pescado a lo Macho', price: 16400, description: 'Pescado a la plancha, bañado con surtido de mariscos y salsa de ají especial.' },
      { name: 'Pescado del Mar', price: 16400, description: 'Pescado al vapor con salsa americana, surtidos de mariscos y queso gratinado.' },
      { name: 'Mar y Río', price: 15900, description: 'Pescado a la plancha con camarones ecuatorianos, bañado con una cremosa salsa de mostaza clásica y antigua.' },
      { name: 'Pescado Mi Tierra', price: 15900, description: 'Pescado a la plancha, champiñones y calamar flameadas al pisco peruano, bañado con salsa de alcachofa.' },
      { name: 'Pulpo a la Parrilla', price: 16900, description: 'Pulpo marinado con salsa anticuchera y hierbas aromáticas, servido con risotto al olivo.' },
    ]
  },
  {
    name: 'Filete y Pollo', position: 9,
    dishes: [
      { name: 'Filete Misty', price: 16400, description: 'Filete a la plancha sellado en pulpo y queso gratinado, con salsa de ají amarillo, acompañado con risotto de espinaca.' },
      { name: 'Filete Macho', price: 16400, description: 'Filete a la plancha bañado en salsa de mariscos acompañados con un exquisito risotto al olivo.' },
      { name: 'Filete Rocotto', price: 16400, description: 'Filete a la plancha blindado con tocino y camarones, bañado en salsa de rocoto y morrón, flameado con pisco peruano. Acompañamiento a elección.' },
      { name: 'Filete Surf', price: 16400, description: 'Salteado de mariscos con trozos de vacuno flameados en salsa de soya y vegetales al jugo, acompañados de papa frita y arroz.' },
      { name: 'Filete Huacatay', price: 16400, description: 'Filete a la plancha y camarones ecuatorianos, con salsa de huacatay acompañado de risotto tradicional.' },
      { name: 'Filete Huancaina', price: 15900, description: 'Filete al jugo servidos sobre fetuccini en salsa huancaina.' },
      { name: 'Filete Mignon', price: 15900, description: 'Filete a la plancha con salsa al vino tinto y champiñones. Acompañamiento a elección.' },
      { name: 'Pollo Casador', price: 14900, description: 'Pollo a la plancha con cremosa salsa bechamel y verduras, acompañado con risotto de choclo y aceitunas.' },
      { name: 'Pollo Gordon Blue', price: 15900, description: 'Pollo enrollado con jamón y queso, bañado en una salsa americana con camarones.' },
    ]
  },
  {
    name: 'Pastas', position: 10,
    dishes: [
      { name: 'Fetuccini Don Diego', price: 14900, description: 'Camarones y verduras, salteados con aceite de oliva.' },
      { name: 'Fetuccini Salteado de Carne', price: 15900, description: 'Trozos de filete, cebolla y tomate salteado al wok en salsa de soya.' },
      { name: 'Tallarín Chifa Peruano', price: 15900, description: 'Fideos chinos con trozos de vacuno, pollo, camarones y verduras frescas.' },
      { name: 'Picante de Camarones', price: 16900, description: 'Camarones ecuatorianos con salsa americana en punto de ají. Acompañamiento a elección.' },
      { name: 'Timbal de Camarones', price: 16400, description: 'Fetuccini al dente con camarones en salsa americana, gratinado con queso.' },
      { name: 'Risotto de Camarón', price: 15400, description: 'Risotto tradicional con camarones ecuatorianos gratinado con queso.' },
    ]
  },
  {
    name: 'Especial Niños', position: 11,
    dishes: [
      { name: 'Fetuccini Alfredo', price: 12400, description: 'Fideos al dente bañados con cremosa salsa blanca y jamón serrano.' },
      { name: 'Milanesa de Pollo', price: 12900, description: 'Pechuga de pollo apanada con sal a gusto. Agregado a elección.' },
      { name: 'Pollo a la Plancha', price: 11900, description: 'Pechuga de pollo con agregado a elección.' },
    ]
  },
  {
    name: 'Sopas', position: 12,
    dishes: [
      { name: 'Parihuela', price: 14900, description: 'Consomé de mariscos y pescado, flameado de vino blanco y finos aliños.' },
      { name: 'Sudado de Pescado', price: 13900, description: 'Pescado escabechado a base de tomate y cebolla flameados en vino tinto.' },
      { name: 'Chupe de Camarón', price: 14900, description: 'Consomé de pescado, hecho a base de ají amarillo y camarones ecuatorianos.' },
      { name: 'Dieta de Pollo', price: 11900, description: 'Consomé de pollo y verduras.' },
    ]
  },
  {
    name: 'Postres', position: 13,
    dishes: [
      { name: 'Suspiro Limeño', price: 3900, description: null },
      { name: 'Torta Tres Leche', price: 4900, description: null },
      { name: 'Tiramisú', price: 4900, description: null },
      { name: 'Cheesecake Maracuyá', price: 4900, description: null },
      { name: 'Crema Volteada', price: 4500, description: null },
    ]
  },
  {
    name: 'Agregados', position: 14,
    dishes: [
      { name: 'Arroz', price: 3900, description: null },
      { name: 'Papas Fritas', price: 4500, description: null },
      { name: 'Choclo Peruano', price: 4500, description: null },
      { name: 'Cancha Peruana', price: 4900, description: null },
      { name: 'Risotto', price: 5500, description: null },
      { name: 'Yuca Dorada', price: 5500, description: null },
      { name: 'Panaché de Verduras', price: 5500, description: null },
      { name: 'Ensalada Mixta', price: 4900, description: null },
      { name: 'Palta', price: 5500, description: null },
      { name: 'Tomate', price: 3900, description: null },
      { name: 'Lechuga', price: 3000, description: null },
    ]
  },
  {
    name: 'Aperitivos y Tragos', position: 15,
    dishes: [
      { name: 'Agua con Gas o Sin Gas Peregrini', price: 2900, description: null },
      { name: 'Jugos Naturales', price: 3900, description: null },
      { name: 'Inka Kola 600cc', price: 3200, description: null },
      { name: 'Limonada con Limón de Pica', price: 4500, description: null },
      { name: 'Chicha Morada', price: 4200, description: null },
      { name: 'Jugos Naturales Basílica', price: 6900, description: null },
      { name: 'Limonada Basílica', price: 6900, description: null },
      { name: 'Chicha Morada Basílica', price: 6900, description: null },
      { name: 'Chicha de Litro (para llevar)', price: 7500, description: null },
      { name: 'Chicha Morada Litro (para llevar)', price: 7500, description: null },
      { name: 'Limonada de Litro (para llevar)', price: 7500, description: null },
      { name: 'Corona', price: 4200, description: null },
      { name: 'Austral Calafate', price: 4200, description: null },
      { name: 'Austral Lager', price: 4200, description: null },
      { name: 'Kustman Torobayo', price: 4200, description: null },
      { name: 'Kustman Satori', price: 4200, description: null },
      { name: 'Kustman Miel', price: 4200, description: null },
      { name: 'Cuzqueña Rubia o Negra', price: 4200, description: null },
      { name: 'Michelada', price: 4700, description: null },
      { name: 'Copa Vino Blanco', price: 5500, description: null },
      { name: 'Copa Vino Tinto', price: 5500, description: null },
      { name: 'Copa Espumante', price: 5800, description: null },
      { name: 'Piscola Mistral 35', price: 5900, description: null },
      { name: 'Piscola Mistral 40', price: 6500, description: null },
      { name: 'Piscola Mistral Nobel', price: 7500, description: null },
      { name: 'Roncola Bacardi', price: 6500, description: null },
      { name: 'Roncola Havana Especial Añejo', price: 7500, description: null },
      { name: 'Wiscola Ballantines', price: 7500, description: null },
      { name: 'Wiscola Johnnie Walker Red Label', price: 7500, description: null },
      { name: 'Whisky Ballantines 12 Años', price: 7500, description: null },
      { name: 'Whisky Johnnie Walker Etiqueta Negra', price: 8900, description: null },
      { name: 'Whisky Chivas 12 Años', price: 8900, description: null },
      { name: 'Whisky Chivas 18 Años', price: 13900, description: null },
      { name: 'Whisky Jack Daniels', price: 8900, description: null },
      { name: 'Whisky Jack Daniels Honey', price: 7200, description: null },
      { name: 'Ruso Blanco', price: 6900, description: null },
      { name: 'Ruso Negro', price: 6900, description: null },
      { name: 'Daiquiri', price: 6500, description: null },
      { name: 'Piña Colada', price: 7200, description: null },
      { name: 'Caipirinha', price: 7200, description: null },
      { name: 'Laguna Azul', price: 7900, description: null },
      { name: 'Tequila Margarita', price: 8100, description: null },
      { name: 'Mojito', price: 6900, description: null },
      { name: 'Mojito de Frutas Maceradas', price: 6900, description: null },
    ]
  },
];

async function main() {
  for (const catData of newCategories) {
    const category = await prisma.category.create({
      data: { restaurantId: RESTAURANT_ID, name: catData.name, position: catData.position, isActive: true }
    });
    console.log('Cat:', category.name);
    for (let i = 0; i < catData.dishes.length; i++) {
      const d = catData.dishes[i];
      await prisma.dish.create({
        data: { restaurantId: RESTAURANT_ID, categoryId: category.id, name: d.name, price: d.price, description: d.description, position: i, isActive: true, txDishType: [], txCuisine: [], txMealSlot: [], txIngredient: [], txEstilo: [], photos: [] }
      });
      console.log('  +', d.name);
    }
  }
  const total = await prisma.dish.count({ where: { restaurantId: RESTAURANT_ID, deletedAt: null } });
  console.log('DONE. Total dishes:', total);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

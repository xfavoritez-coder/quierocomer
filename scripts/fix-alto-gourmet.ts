import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const MENU = [
  { cat: "Colaciones", dishes: [
    { name: "Chuleta de Cerdo Vetada Parrillera", price: 9900 },
    { name: "Carne Mongoliana", price: 9900 },
    { name: "Milanesa Asiento Angus Argentino", price: 9900 },
    { name: "Churrasco Apanado Estilo Argentino", price: 9900 },
    { name: "Spaghetti", price: 9900, desc: "Salsa alfredo, pesto o bolognesa" },
  ]},
  { cat: "Entradas", dishes: [
    { name: "Ceviche de Salmón", price: 16900 },
    { name: "Sashimi de Salmón", price: 14500 },
    { name: "Ceviche Salmón, Pulpo y Camarón", price: 22500 },
    { name: "Ensalada César", price: 9900 },
    { name: "Ensalada del Huerto", price: 9900 },
    { name: "Ensalada Huerto del Mar", price: 11900 },
  ]},
  { cat: "Pizzas", dishes: [
    { name: "Margherita", price: 7900 },
    { name: "Pepperoni", price: 8900 },
    { name: "Aceitunas", price: 8900 },
    { name: "Napolitana Chilena", price: 10900 },
    { name: "Prosciutto e Funghi", price: 14900 },
    { name: "Arcoíris", price: 8900 },
    { name: "Camarón", price: 12900 },
    { name: "Cuatro Quesos", price: 15900 },
    { name: "Rúcola", price: 9900 },
    { name: "Mechada Champiñón", price: 11900 },
    { name: "Salchipizza", price: 10900 },
    { name: "Jamón Niño", price: 9900 },
    { name: "Jamón Champiñones", price: 10900 },
    { name: "Pizza a lo Pobre", price: 12900 },
    { name: "Bajonera Cheddar", price: 11900 },
    { name: "La Donna e Mobile", price: 11900 },
    { name: "Hawaiian Upgrade", price: 9900 },
    { name: "Española", price: 11900 },
  ]},
  { cat: "Carnes a la Parrilla", dishes: [
    { name: "Lomo Vetado Angus Pampeana", price: 20900 },
    { name: "Lomo Liso Black Angus", price: 20900 },
    { name: "Flat Iron", price: 21900 },
    { name: "Punta Picana 350g", price: 18900 },
    { name: "Pechuga de Pollo", price: 9900 },
  ]},
  { cat: "Fondos", dishes: [
    { name: "Milanesa Napolitana", price: 9900 },
    { name: "Filete de Salmón", price: 14900 },
    { name: "Paila Marina", price: 10900 },
    { name: "Lomo Saltado", price: 12900 },
    { name: "Tallarín Saltado", price: 12900 },
    { name: "Lasaña Boloñesa", price: 9900 },
    { name: "Risotto a lo Saltado", price: 14900 },
    { name: "Risotto de Camarones", price: 11900 },
  ]},
  { cat: "Sándwiches", dishes: [
    { name: "Churrasco Asiento Angus Argentino", price: 8390 },
    { name: "Mechada", price: 5990 },
  ]},
  { cat: "Sushi", dishes: [
    { name: "Roll California Sésamo", price: 7900 },
    { name: "Roll Envuelto en Palta", price: 8900 },
    { name: "Hand Roll", price: 8900 },
    { name: "Roll Envuelto en Salmón", price: 12900 },
    { name: "Roll Envuelto en Queso Crema", price: 8900 },
    { name: "Gohan Mixto", price: 12900 },
    { name: "FutoMaki Pimentón", price: 8900 },
  ]},
  { cat: "Hamburguesas", dishes: [
    { name: "Hamburguesa de Niño", price: 5900 },
    { name: "Hamburguesa Clásica", price: 6900 },
    { name: "Hamburguesa Tocino", price: 8900 },
    { name: "Hamburguesa Doble Tocino y Queso", price: 14100 },
    { name: "Hamburguesa Champiñón", price: 8500 },
    { name: "Hamburguesa Italiana", price: 9200 },
    { name: "Hamburguesa Antivegana", price: 14900 },
    { name: "Hamburguesa Watafak", price: 15600 },
    { name: "Hamburguesa Big", price: 9900 },
    { name: "Crispy Burger", price: 9900 },
    { name: "Hamburguesa Hakuna Matata", price: 12900 },
  ]},
  { cat: "Para Compartir", dishes: [
    { name: "Parrillada para 2", price: 42900 },
    { name: "Pichanga Sureña 4 personas", price: 26000 },
    { name: "Tabla Caliente", price: 19900 },
    { name: "Chanchicheddar", price: 14900 },
    { name: "Papas del Maxi", price: 14900 },
    { name: "Chorrillanas Pollo con Champiñones", price: 12900 },
    { name: "Chorrillana", price: 12900 },
    { name: "Papas Tocino Salsa Cheddar", price: 12900 },
    { name: "Papas Carne Cheddar", price: 12900 },
    { name: "Papas Cheddar", price: 9900 },
    { name: "Salchipapas", price: 7900 },
    { name: "Palitos de Ajo 10u", price: 5900 },
    { name: "Porción de Papas Fritas", price: 5000 },
    { name: "Empanaditas de Queso", price: 5000 },
  ]},
  { cat: "Jugos Naturales", dishes: [
    { name: "Jugo de Mango", price: 3800 },
    { name: "Jugo de Piña", price: 3800 },
    { name: "Jugo de Frutilla", price: 3800 },
    { name: "Limonada Menta Jengibre", price: 3800 },
    { name: "Jugo de Frambuesa", price: 3800 },
    { name: "Jugo de Mora", price: 3800 },
  ]},
  { cat: "Postres", dishes: [
    { name: "Helado Artesanal Timaukel", price: 2490 },
    { name: "Alfajores", price: 1800 },
  ]},
  { cat: "Café e Infusiones", dishes: [
    { name: "Espresso Britt", price: 2500 },
    { name: "Americano Britt", price: 2500 },
    { name: "Capuccino Britt", price: 2800 },
    { name: "Latte Britt", price: 2800 },
    { name: "Té Ceilán", price: 2500 },
    { name: "Infusión", price: 2500 },
  ]},
  { cat: "Bebidas", dishes: [
    { name: "Agua Mineral", price: 2000 },
    { name: "Coca Cola", price: 2500 },
    { name: "Coca Cola Zero", price: 2500 },
    { name: "Fanta", price: 2500 },
    { name: "Sprite", price: 2500 },
    { name: "Kem Piña", price: 2200 },
    { name: "Limón Soda", price: 2200 },
    { name: "Bilz", price: 2200 },
  ]},
  { cat: "Cervezas", dishes: [
    { name: "Schop Quilmes 500ml", price: 3500 },
    { name: "Schop Stella Artois 500ml", price: 3800 },
    { name: "Schop Kunstmann 500ml", price: 5000 },
    { name: "Corona Extra", price: 3500 },
  ]},
  { cat: "Tragos", dishes: [
    { name: "Moscow Mule", price: 6900 },
    { name: "Mojito Bacardi 500ml", price: 6900 },
    { name: "Mojito de Coco", price: 8900 },
    { name: "Aperol Spritz", price: 5900 },
    { name: "Pisco Sour", price: 4600 },
    { name: "Gin Tonic", price: 5200 },
    { name: "Piña Colada", price: 6900 },
    { name: "Long Island Tea", price: 8900 },
    { name: "Negroni Sour", price: 4900 },
    { name: "Tequila Margarita", price: 4900 },
    { name: "Jack Daniel", price: 6400 },
    { name: "Whisky Johnnie Walker Black Label", price: 7200 },
  ]},
];

async function main() {
  const restId = "cmpydyj0c0001l404xxxviwy3";

  // Delete old dishes and categories
  const oldDishes = await p.dish.deleteMany({ where: { restaurantId: restId } });
  const oldCats = await p.category.deleteMany({ where: { restaurantId: restId } });
  console.log(`Deleted ${oldDishes.count} old dishes, ${oldCats.count} old categories`);

  let totalDishes = 0;
  for (let i = 0; i < MENU.length; i++) {
    const cat = await p.category.create({
      data: { restaurantId: restId, name: MENU[i].cat, position: i },
    });
    for (let j = 0; j < MENU[i].dishes.length; j++) {
      const d = MENU[i].dishes[j];
      await p.dish.create({
        data: {
          restaurantId: restId,
          categoryId: cat.id,
          name: d.name,
          description: (d as any).desc || "",
          price: d.price,
          position: j,
          photos: [],
        },
      });
      totalDishes++;
    }
  }

  console.log(`Created ${MENU.length} categories, ${totalDishes} dishes`);
  console.log("Done! Alto Gourmet carta replaced.");
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

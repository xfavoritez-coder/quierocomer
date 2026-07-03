import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const RESTAURANT_ID = "cmqlube5t0000jo04uk1pkoff";

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
}

interface CategoryDef { name: string; position: number; dishType?: string; description?: string }
interface DishDef { name: string; price: number; description: string | null; categoryName: string }

const CATEGORIES: CategoryDef[] = [
  { name: "Pizzas Clásicas",    position: 0 },
  { name: "Pizzas de Artista",  position: 1 },
  { name: "Pizzas de Estación", position: 2 },
  { name: "Fritos",             position: 3 },
  { name: "Ensaladas",          position: 4 },
  { name: "Postres",            position: 5, dishType: "dessert" },
  { name: "Bebestibles",        position: 6, dishType: "drink" },
  { name: "Momento Caliente",   position: 7, dishType: "drink" },
];

const DISHES: DishDef[] = [
  // ─── Pizzas Clásicas ────────────────────────────────────────────────
  { categoryName: "Pizzas Clásicas", name: "Margherita",
    price: 9500,
    description: "Pomodoro italiano, mozzarella fior di latte, aceite de oliva extra virgen y albahaca fresca." },
  { categoryName: "Pizzas Clásicas", name: "Margherita Speciale",
    price: 14000,
    description: "Mozzarella fior di latte fresca de alta calidad, pomodoro italiano, aceite de oliva extra virgen y albahaca fresca. El sabor del principio." },
  { categoryName: "Pizzas Clásicas", name: "Doppio Piccante",
    price: 9500,
    description: "Doble porción de pomodoro italiano, pasta de ají rojo para el picante, mozzarella fior di latte, albahaca fresca y aceite de oliva extra virgen." },
  { categoryName: "Pizzas Clásicas", name: "Simple Piccante",
    price: 13000,
    description: "Pomodoro italiano picante, mozzarella fior di latte, albahaca fresca y aceite de oliva extra virgen." },
  { categoryName: "Pizzas Clásicas", name: "Quattro Formaggi",
    price: 14200,
    description: "Mozzarella fior di latte, provola ahumada, grana padano y gorgonzola. Cuatro quesos italianos en perfecta armonía." },
  { categoryName: "Pizzas Clásicas", name: "Diana Classica",
    price: 14200,
    description: "Pomodoro italiano, mozzarella fior di latte, salame napoli, pimienta negra y albahaca." },

  // ─── Pizzas de Artista ──────────────────────────────────────────────
  { categoryName: "Pizzas de Artista", name: "Gamberetti",
    price: 14800,
    description: "Crema de Grana Padano, mozzarella fior di latte, camarones en aceite de ajo y peperoncino, cilantro fresco. 🌶️ Picante." },
  { categoryName: "Pizzas de Artista", name: "Pugliese 2.0",
    price: 13500,
    description: "Pomodoro italiano, rúcula aliñada, mix de tomate cherry, boconcini frescos, láminas de Grana Padano, aceite de oliva extra virgen y pimienta negra. 🌿 Vegetariano." },
  { categoryName: "Pizzas de Artista", name: "Tartufo e Funghi",
    price: 15990,
    description: "Crema trufada, mozzarella fior di latte, provola ahumada, champiñón salteado, stracciatella, carpaccio de portobello, avellana europea, cilantro fresco y aceite de oliva virgen extra. 🌿 Vegetariano." },
  { categoryName: "Pizzas de Artista", name: "Prosciutto e Stracciatella",
    price: 15990,
    description: "Pomodoro italiano, rúcula, prosciutto di parma, stracciatella, aceite de oliva y pimienta negra. 🌿 Vegetariano." },
  { categoryName: "Pizzas de Artista", name: "La Criolla",
    price: 14800,
    description: "Pomodoro italiano, mozzarella fior di latte, longaniza ahumada de Chillán, cebolla morada en pluma, ají verde, cilantro fresco y aceite de oliva virgen extra. 🌶️ Picante." },
  { categoryName: "Pizzas de Artista", name: "Salsiccia e Patate",
    price: 14990,
    description: "Base de provola ahumada, papa horneada con romero y ajo, chorizo italiano. Al salir del horno: mayonesa parrillera ahumada y hojas de albahaca fresca." },
  { categoryName: "Pizzas de Artista", name: "Sapore d'Italia",
    price: 14800,
    description: "Base de pomodoro italiano, mix de tomate cherry asado, stracciatella, pesto fresco de la casa, aceite de oliva extra virgen y albahaca. 🌿 Vegetariano." },
  { categoryName: "Pizzas de Artista", name: "Pompei",
    price: 15990,
    description: "Pomodoro italiano, mozzarella fior di latte, salame tipo napoli, ricota y bordes de la pizza rellenos de pesto fresco de la casa." },
  { categoryName: "Pizzas de Artista", name: "Vesubio",
    price: 16800,
    description: "Mozzarella fior di latte, mix de tomates cherry asados, stracciatella, albahaca, avellana europea triturada y bordes de la pizza rellenos de pasta de trufa. 🌿 Vegetariano." },
  { categoryName: "Pizzas de Artista", name: "Pizza della Nonna",
    price: 17800,
    description: "Pomodoro italiano, mozzarella fior di latte. Al salir del horno se termina con albóndigas cocinadas en su salsa, ricotta y albahaca fresca." },

  // ─── Pizzas de Estación ─────────────────────────────────────────────
  { categoryName: "Pizzas de Estación", name: "Genovese a la Napolitana",
    price: 16990,
    description: "Pizza doble cocción: primero la masa se fríe y después va al horno, rellena de salsa de carne y cebolla cocinada por 6 horas, provola ahumada, chips de cebolla, grana padano y albahaca." },
  { categoryName: "Pizzas de Estación", name: "Zucca e Pesce",
    price: 14000,
    description: "Crema de zapallo, mozzarella fior di latte, merluza cocinada al horno en aceite de ajo, aceitunas pequeñas italianas, grana padano y semillas de zapallo." },
  { categoryName: "Pizzas de Estación", name: "Carciofi e Panceta",
    price: 15990,
    description: "Base de crema de alcachofa, mozzarella fior di latte, alcachofa asada, panceta, pecorino D.O.P., hojas de albahaca fresca y pimienta negra." },

  // ─── Fritos ─────────────────────────────────────────────────────────
  { categoryName: "Fritos", name: "Frittatina alla Genovese",
    price: 3990,
    description: "Crocante de queso con bechamel cremoso y nuestra tradicional salsa genovese, cocida a fuego lento por 3 horas con laurel, ají rojo y cebolla caramelizada. Un bocado perfecto." },
  { categoryName: "Fritos", name: "Pizza Polpette",
    price: 10990,
    description: "Mix de 3 masas fritas y horneadas terminadas con 3 sabores clásicos de pizza frita." },
  { categoryName: "Fritos", name: "Pizza a la Polpette",
    price: 10990,
    description: "Pedazos de pizza frita con mozzarella fior di latte, gorgonzola y aceite de oliva virgen extra." },

  // ─── Ensaladas ──────────────────────────────────────────────────────
  { categoryName: "Ensaladas", name: "Carciofi e Grana",
    price: 8000,
    description: "Alcachofa asada, gorgonzola, mozzarella fresca italiana, alcachofa en aceite, alcaparras, láminas de Grana Padano y limón." },
  { categoryName: "Ensaladas", name: "Tonno e Capperi",
    price: 8000,
    description: "Base de rúcula silvestre y mix de tomates cherry, atún en aceite de oliva, alcaparras y aceite de oliva extra virgen." },
  { categoryName: "Ensaladas", name: "Mozzarella Caprese",
    price: 10990,
    description: "Base de stracciatella de la casa con tomate cherry asado, albahaca y aceite de oliva extra virgen." },

  // ─── Postres ────────────────────────────────────────────────────────
  { categoryName: "Postres", name: "Tiramisú",
    price: 7990,
    description: "Clásico postre italiano. Capas de bizcocho empapado en café y cacao con cremoso relleno de crema de mascarpone. Suave y delicado al paladar." },
  { categoryName: "Postres", name: "Cuore di Nutella",
    price: 5990,
    description: "Masa de pizza frita en forma de corazón con azúcar flor, nutella y pistacho para untar." },
  { categoryName: "Postres", name: "Giardini della Nonna",
    price: 3990,
    description: "3 trozos de masa cocinada al padelino (más esponjosa, alta digestibilidad). Base de mermelada natural de la nonna, ricota, avellanas, grana padano, azúcar flor y menta fresca." },

  // ─── Bebestibles ────────────────────────────────────────────────────
  // Jugos naturales
  { categoryName: "Bebestibles", name: "Sole d'Arancia",
    price: 4500,
    description: "Jugo natural de naranja y zanahoria." },
  { categoryName: "Bebestibles", name: "Basilico Tropicale",
    price: 4500,
    description: "Jugo natural de piña y albahaca." },
  // Limonadas naturales
  { categoryName: "Bebestibles", name: "Menta e Zenzero",
    price: 4000,
    description: "Limonada natural de limón, menta y jengibre." },
  { categoryName: "Bebestibles", name: "Giardino Rosa",
    price: 4000,
    description: "Limonada natural de limón, frutilla y pepino." },
  // Kombucha
  { categoryName: "Bebestibles", name: "Kombushot",
    price: 3500,
    description: "Kombucha de naranja, cúrcuma y jengibre." },
  { categoryName: "Bebestibles", name: "La Celeste",
    price: 3500,
    description: "Kombucha de maracuyá y jengibre." },
  { categoryName: "Bebestibles", name: "Lalavand",
    price: 3500,
    description: "Kombucha de lavanda y manzanilla." },
  // Bebidas
  { categoryName: "Bebestibles", name: "Coca Cola",
    price: 3000,
    description: null },
  { categoryName: "Bebestibles", name: "Coca Zero",
    price: 3000,
    description: null },
  { categoryName: "Bebestibles", name: "Agua Mineral Sin Gas",
    price: 3000,
    description: null },
  { categoryName: "Bebestibles", name: "Agua Mineral Con Gas",
    price: 3000,
    description: null },
  { categoryName: "Bebestibles", name: "San Pellegrino Sabores",
    price: 3500,
    description: "Bebida italiana carbonatada con sabores." },
  { categoryName: "Bebestibles", name: "Galvanina Sabores",
    price: 4500,
    description: "Bebida italiana con fruta biológica carbonatada." },

  // ─── Momento Caliente ───────────────────────────────────────────────
  { categoryName: "Momento Caliente", name: "Espresso",
    price: 1900,
    description: "Shot de café italiano Borbone." },
  { categoryName: "Momento Caliente", name: "Americano",
    price: 1900,
    description: "Espresso italiano suavizado con agua caliente, equilibrado y ligero." },
  { categoryName: "Momento Caliente", name: "Capuccino",
    price: 2900,
    description: "Espresso, leche vaporizada y espuma cremosa." },
  { categoryName: "Momento Caliente", name: "Latte",
    price: 2900,
    description: "Espresso italiano con abundante leche vaporizada y textura suave." },
  { categoryName: "Momento Caliente", name: "Té Sabores",
    price: 2500,
    description: "Selección de tés en distintos sabores." },
  { categoryName: "Momento Caliente", name: "Chocolate Caliente",
    price: 3500,
    description: "Chocolate caliente cremoso y reconfortante, ideal para acompañar un momento dulce." },
];

async function main() {
  console.log("=== Actualizando carta 400 Pizzería ===\n");

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: RESTAURANT_ID },
    select: { id: true, name: true },
  });
  if (!restaurant) { console.error("Restaurante no encontrado!"); return; }
  console.log(`Restaurante: ${restaurant.name}\n`);

  // ─── 1. Upsert categorías ────────────────────────────────────────────
  console.log("--- Categorías ---");
  const existingCats = await prisma.category.findMany({ where: { restaurantId: RESTAURANT_ID } });
  const categoryMap: Record<string, string> = {};

  for (const catDef of CATEGORIES) {
    const existing = existingCats.find(c => normalize(c.name) === normalize(catDef.name));
    if (existing) {
      await prisma.category.update({
        where: { id: existing.id },
        data: { name: catDef.name, position: catDef.position, isActive: true, dishType: catDef.dishType || "food" },
      });
      categoryMap[catDef.name] = existing.id;
      console.log(`  Actualizada: ${catDef.name}`);
    } else {
      const created = await prisma.category.create({
        data: { restaurantId: RESTAURANT_ID, name: catDef.name, position: catDef.position, isActive: true, dishType: catDef.dishType || "food" },
      });
      categoryMap[catDef.name] = created.id;
      console.log(`  Creada: ${catDef.name}`);
    }
  }

  // Desactivar categorías que ya no existen
  for (const cat of existingCats) {
    if (!CATEGORIES.some(c => normalize(c.name) === normalize(cat.name))) {
      await prisma.category.update({ where: { id: cat.id }, data: { isActive: false } });
      console.log(`  Desactivada: ${cat.name}`);
    }
  }

  // ─── 2. Upsert platos ────────────────────────────────────────────────
  console.log("\n--- Platos ---");
  const existingDishes = await prisma.dish.findMany({
    where: { restaurantId: RESTAURANT_ID },
  });

  let updated = 0, created = 0, softDeleted = 0;
  const processedIds = new Set<string>();

  for (let i = 0; i < DISHES.length; i++) {
    const d = DISHES[i];
    const categoryId = categoryMap[d.categoryName];
    if (!categoryId) { console.error(`  Categoría no encontrada: ${d.categoryName}`); continue; }

    const existing = existingDishes.find(e => normalize(e.name) === normalize(d.name));

    if (existing) {
      processedIds.add(existing.id);
      await prisma.dish.update({
        where: { id: existing.id },
        data: { name: d.name, price: d.price, description: d.description, categoryId, position: i, isActive: true, deletedAt: null },
      });
      updated++;
      console.log(`  Actualizado: ${d.name} | $${d.price}`);
    } else {
      await prisma.dish.create({
        data: { restaurantId: RESTAURANT_ID, categoryId, name: d.name, price: d.price, description: d.description, photos: [], position: i, isActive: true, txDishType: [], txCuisine: [], txMealSlot: [], txIngredient: [], txEstilo: [] },
      });
      created++;
      console.log(`  Creado: ${d.name} | $${d.price}`);
    }
  }

  // Soft-delete platos que ya no están en la carta
  for (const dish of existingDishes) {
    if (!processedIds.has(dish.id) && dish.isActive) {
      await prisma.dish.update({ where: { id: dish.id }, data: { isActive: false, deletedAt: new Date() } });
      softDeleted++;
      console.log(`  Eliminado: ${dish.name}`);
    }
  }

  console.log("\n=== RESUMEN ===");
  console.log(`  Actualizados: ${updated}`);
  console.log(`  Creados:      ${created}`);
  console.log(`  Eliminados:   ${softDeleted}`);
  console.log(`  Total carta:  ${DISHES.length} platos`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });

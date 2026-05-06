import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const RESTAURANT_SLUG = "alleria-pizza";
const DRY_RUN = process.env.DRY_RUN === "1";

interface NewDish {
  name: string;
  price: number;
  description: string;
  dishDiet?: "VEGAN" | "VEGETARIAN" | "OMNIVORE";
  containsNuts?: boolean;
  isSpicy?: boolean;
}

interface NewCategory {
  name: string;
  dishType: string;
  dishes: NewDish[];
}

const NEW_CATEGORIES: NewCategory[] = [
  {
    name: "Peri Bambini",
    dishType: "food",
    dishes: [
      { name: "Sorrentino", price: 16900, description: "Espaguetis en salsa pomodoro, fior di latte, grana padano. Incluye bebida + helado de vainilla o mini angioletti (2 unid).", dishDiet: "VEGETARIAN" },
      { name: "Diavoletta", price: 16900, description: "Salsa pomodoro, albahaca, grana padano D.O.P., mozzarella fior di latte y peperoni kids. Incluye bebida + helado de vainilla o mini angioletti (2 unid).", dishDiet: "VEGETARIAN" },
      { name: "Paperino", price: 16900, description: "Base de crema de leche, salchicha de campo, papas artesanales fritas, grana padano D.O.P., albahaca y mozzarella fior di latte. Incluye bebida + helado de vainilla o mini angioletti (2 unid).", dishDiet: "OMNIVORE" },
      { name: "Mimosa", price: 16900, description: "Base de crema de leche, jamón artesanal, maíz (choclo), grana padano D.O.P., albahaca y mozzarella fior di latte. Incluye bebida + helado de vainilla o mini angioletti (2 unid).", dishDiet: "OMNIVORE" },
    ],
  },
  {
    name: "Adicionales",
    dishType: "food",
    dishes: [
      { name: "Adicional de Verdura", price: 3000, description: "1 porción de: champiñón, pimentón salteado, berenjena, alcachofa, tomate cherry, tomate amarillo y tomate deshidratado.", dishDiet: "VEGAN" },
      { name: "Adicional de Embutido Italiano", price: 4700, description: "1 porción de embutidos italianos: salame picante, salame napoli, salame milano, jamón cotto, prosciutto crudo, coppa y mortadella di pistacho.", dishDiet: "OMNIVORE", containsNuts: true },
      { name: "Adicional de Queso Italiano", price: 4500, description: "1 porción de queso italiano: gorgonzola, provolone, fior di latte, grana padano laminado, búfala, ricotta y cesta de grana padano con ricotta.", dishDiet: "VEGETARIAN" },
      { name: "Adicional Burrata D.O.C", price: 9000, description: "1 porción de Burrata fresca italiana D.O.C.", dishDiet: "VEGETARIAN" },
      { name: "Adicional de Polpetta", price: 9000, description: "3 unidades de polpetta artesanales en salsa pomodoro.", dishDiet: "OMNIVORE" },
      { name: "Adicional Funghi Porcini Italiano", price: 4000, description: "1 porción de funghi porcini italiano salteado en aceite de oliva.", dishDiet: "VEGAN" },
      { name: "Adicional de Trufa y Pesto", price: 2000, description: "1 adicional de aceite de trufa blanca, crema de trufa negra o crema de pesto artesanal.", dishDiet: "VEGETARIAN" },
      { name: "Adicional de Anchoas Italianas", price: 2000, description: "1 porción de anchoas italianas del Mediterráneo.", dishDiet: "OMNIVORE" },
    ],
  },
  {
    name: "Bebidas",
    dishType: "drink",
    dishes: [
      { name: "Peroni Lager 0° Alcohol", price: 3500, description: "Cerveza italiana sin alcohol — botella 330cc.", dishDiet: "VEGAN" },
      { name: "Aranciata Rosa San Pellegrino", price: 4100, description: "Bebida italiana gasificada con sabor a naranja roja — 330ml.", dishDiet: "VEGAN" },
      { name: "Aranciata San Pellegrino", price: 4100, description: "Bebida italiana gasificada con sabor a naranja — 330ml.", dishDiet: "VEGAN" },
      { name: "Arancia & Fico de India San Pellegrino", price: 4100, description: "Bebida italiana gasificada con sabor a tuna y limón — 330ml.", dishDiet: "VEGAN" },
      { name: "Limonata San Pellegrino", price: 4100, description: "Bebida italiana gasificada con sabor a limón — 330ml.", dishDiet: "VEGAN" },
      { name: "Clementina San Pellegrino", price: 4100, description: "Bebida italiana gasificada con sabor a mandarina — 330ml.", dishDiet: "VEGAN" },
      { name: "Pompelmo San Pellegrino", price: 4100, description: "Bebida italiana gasificada con sabor a pomelo — 330ml.", dishDiet: "VEGAN" },
      { name: "Coca-Cola Original", price: 2600, description: "Lata 350ml.", dishDiet: "VEGAN" },
      { name: "Coca-Cola S/azúcar", price: 2600, description: "Lata 350ml.", dishDiet: "VEGAN" },
      { name: "Sprite", price: 2600, description: "Lata 350ml.", dishDiet: "VEGAN" },
      { name: "Sprite Zero", price: 2600, description: "Lata 350ml.", dishDiet: "VEGAN" },
      { name: "Fanta Original", price: 2600, description: "Lata 350ml.", dishDiet: "VEGAN" },
      { name: "Fanta Zero", price: 2600, description: "Lata 350ml.", dishDiet: "VEGAN" },
      { name: "Jugo de Mango", price: 5700, description: "Jugo de pulpa natural de mango.", dishDiet: "VEGAN" },
      { name: "Jugo de Frutilla", price: 5200, description: "Jugo natural de frutilla.", dishDiet: "VEGAN" },
      { name: "Jugo de Chirimoya", price: 5900, description: "Jugo natural de chirimoya.", dishDiet: "VEGAN" },
      { name: "Jugo de Piña", price: 5700, description: "Jugo natural de piña.", dishDiet: "VEGAN" },
      { name: "Agua C/gas chelada Benedictino", price: 2500, description: "Agua con gas estilo chelada.", dishDiet: "VEGAN" },
      { name: "Agua purificada con gas", price: 1500, description: "Agua premium purificada con gas — 500ml.", dishDiet: "VEGAN" },
      { name: "Agua purificada sin gas", price: 1500, description: "Agua premium purificada sin gas — 500ml.", dishDiet: "VEGAN" },
      { name: "Zumo de limón", price: 1000, description: "Zumo de limón 2oz recién exprimido.", dishDiet: "VEGAN" },
    ],
  },
];

const CAFETERIA_NEW: NewDish[] = [
  { name: "Infusión de menta", price: 2200, description: "Sobre de infusión menta pura, marca Twinings.", dishDiet: "VEGAN" },
  { name: "Infusión de manzanilla", price: 2200, description: "Sobre de infusión de manzanilla pura, marca Twinings.", dishDiet: "VEGAN" },
  { name: "Te negro canela y cardamomo", price: 2200, description: "Sobre de té negro sabor canela y cardamomo, marca Twinings.", dishDiet: "VEGAN" },
  { name: "Té negro frutos rojos", price: 2200, description: "Sobre de té negro sabor frutos rojos, marca Twinings.", dishDiet: "VEGAN" },
  { name: "Infusión limón y jengibre", price: 2200, description: "Sobre de infusión sabor limón y jengibre, marca Twinings.", dishDiet: "VEGAN" },
  { name: "Infusión de naranja, mango y canela", price: 2200, description: "Sobre de infusión sabor naranja, mango y canela, marca Twinings.", dishDiet: "VEGAN" },
  { name: "Infusión de frutos silvestres", price: 2200, description: "Sobre de infusión sabor frutos silvestres, marca Twinings.", dishDiet: "VEGAN" },
];

async function main() {
  const r = await prisma.restaurant.findFirst({ where: { slug: RESTAURANT_SLUG } });
  if (!r) throw new Error("Alleria no encontrada");

  const log: string[] = [];
  const note = (s: string) => { log.push(s); console.log(s); };

  note(`\n=== ${DRY_RUN ? "DRY RUN " : ""}Sync Alleria desde fu.do ===\n`);

  // ======= 1. UN-DELETE Mini Margherita =======
  note("--- 1. Recuperar Mini Margherita (estaba soft-deleted) ---");
  const minimarghe = await prisma.dish.findFirst({ where: { restaurantId: r.id, name: { equals: "Mini Margherita", mode: "insensitive" } } });
  if (minimarghe) {
    if (minimarghe.deletedAt || !minimarghe.isActive) {
      note(`✓ Restaurando Mini Margherita (id ${minimarghe.id})`);
      if (!DRY_RUN) await prisma.dish.update({ where: { id: minimarghe.id }, data: { deletedAt: null, isActive: true } });
    } else {
      note(`= Mini Margherita ya activa`);
    }
  } else {
    note(`⚠️  No encontré Mini Margherita`);
  }

  // ======= 2. REVERT precios =======
  note("\n--- 2. Revertir precios (fu.do manda) ---");
  const priceReverts = [
    { name: "Margherita", newPrice: 11800 },
    { name: "TheTop Pizza", newPrice: 11800 },
    { name: "Arlecchino", newPrice: 23160 },
  ];
  for (const f of priceReverts) {
    const d = await prisma.dish.findFirst({ where: { restaurantId: r.id, name: { equals: f.name, mode: "insensitive" }, deletedAt: null } });
    if (!d) { note(`⚠️  No encontré: ${f.name}`); continue; }
    if (d.price === f.newPrice) { note(`= ${d.name} ya $${d.price.toLocaleString("es-CL")}`); continue; }
    note(`✓ ${d.name}: $${d.price.toLocaleString("es-CL")} → $${f.newPrice.toLocaleString("es-CL")}`);
    if (!DRY_RUN) await prisma.dish.update({ where: { id: d.id }, data: { price: f.newPrice } });
  }

  // ======= 3. ELIMINAR (no están en fu.do) =======
  note("\n--- 3. Eliminar (no están en fu.do) ---");
  const toDelete = [
    "Bruschetta Fiorentina",
    "Ensalada lady diana",
    "Rosticería 2 personas",
    "Gnocchi alla Pesto",
    "Pasta Carbonara",
    "Gelato di pistachio",
    "Paperino", // el que está en Pizzas Speciali — el de Peri Bambini se crea distinto
  ];
  for (const name of toDelete) {
    const ds = await prisma.dish.findMany({ where: { restaurantId: r.id, name: { equals: name, mode: "insensitive" }, deletedAt: null } });
    if (ds.length === 0) { note(`⚠️  No encontré: ${name}`); continue; }
    for (const d of ds) {
      // Solo eliminar el de Pizzas Speciali si es Paperino
      if (name === "Paperino") {
        const cat = await prisma.category.findUnique({ where: { id: d.categoryId } });
        if (cat?.name !== "Pizzas Speciali") { note(`= Skip Paperino en ${cat?.name}`); continue; }
      }
      note(`🗑️  Eliminando: ${d.name} ($${d.price.toLocaleString("es-CL")})`);
      if (!DRY_RUN) await prisma.dish.update({ where: { id: d.id }, data: { deletedAt: new Date(), isActive: false } });
    }
  }

  // ======= 4. RENOMBRAR para coincidir con fu.do =======
  note("\n--- 4. Renombrar a nombres fu.do ---");
  const renames = [
    { from: "Gelato fior di latte", to: "Gelato de Fior di Latte" },
    { from: "Gelato amaretto", to: "Gelato de Amaretto" },
  ];
  for (const ren of renames) {
    const d = await prisma.dish.findFirst({ where: { restaurantId: r.id, name: { equals: ren.from, mode: "insensitive" }, deletedAt: null } });
    if (!d) { note(`⚠️  No encontré: "${ren.from}"`); continue; }
    if (d.name === ren.to) { note(`= "${ren.to}" ya está bien`); continue; }
    note(`✓ "${d.name}" → "${ren.to}"`);
    if (!DRY_RUN) await prisma.dish.update({ where: { id: d.id }, data: { name: ren.to } });
  }

  // ======= 5. CREAR CATEGORÍAS Y PLATOS NUEVOS =======
  note("\n--- 5. Crear categorías + platos nuevos ---");
  for (const newCat of NEW_CATEGORIES) {
    let cat = await prisma.category.findFirst({ where: { restaurantId: r.id, name: { equals: newCat.name, mode: "insensitive" } } });
    if (!cat) {
      const maxPos = await prisma.category.findFirst({ where: { restaurantId: r.id }, orderBy: { position: "desc" }, select: { position: true } });
      note(`📁 Crear categoría [${newCat.dishType}] ${newCat.name}`);
      if (!DRY_RUN) {
        cat = await prisma.category.create({
          data: {
            restaurantId: r.id,
            name: newCat.name,
            dishType: newCat.dishType,
            position: (maxPos?.position ?? -1) + 1,
            isActive: true,
          },
        });
      } else {
        cat = { id: "DRY-" + newCat.name, name: newCat.name, restaurantId: r.id, position: 0, isActive: true } as any;
      }
    }
    for (const nd of newCat.dishes) {
      const exists = await prisma.dish.findFirst({ where: { restaurantId: r.id, categoryId: cat!.id, name: { equals: nd.name, mode: "insensitive" }, deletedAt: null } });
      if (exists) { note(`= ya existe en ${cat!.name}: ${nd.name}`); continue; }
      note(`➕ [${cat!.name}] ${nd.name} — $${nd.price.toLocaleString("es-CL")}`);
      if (!DRY_RUN) {
        const maxPos = await prisma.dish.findFirst({ where: { categoryId: cat!.id, deletedAt: null }, orderBy: { position: "desc" }, select: { position: true } });
        await prisma.dish.create({
          data: {
            restaurantId: r.id,
            categoryId: cat!.id,
            name: nd.name,
            description: nd.description,
            price: nd.price,
            position: (maxPos?.position ?? -1) + 1,
            dishDiet: nd.dishDiet || "OMNIVORE",
            containsNuts: nd.containsNuts || false,
            isSpicy: nd.isSpicy || false,
            photos: [],
            tags: [],
            isActive: true,
          },
        });
      }
    }
  }

  // ======= 6. CAFETERIA: agregar las 7 infusiones que faltan =======
  note("\n--- 6. Cafetería: agregar 7 infusiones que faltan ---");
  const cafeCat = await prisma.category.findFirst({ where: { restaurantId: r.id, name: "Cafetería" } });
  if (!cafeCat) { note(`⚠️  Categoría Cafetería no encontrada`); }
  else {
    for (const inf of CAFETERIA_NEW) {
      const exists = await prisma.dish.findFirst({ where: { restaurantId: r.id, categoryId: cafeCat.id, name: { equals: inf.name, mode: "insensitive" }, deletedAt: null } });
      if (exists) { note(`= ya existe: ${inf.name}`); continue; }
      note(`➕ [Cafetería] ${inf.name} — $${inf.price.toLocaleString("es-CL")}`);
      if (!DRY_RUN) {
        const maxPos = await prisma.dish.findFirst({ where: { categoryId: cafeCat.id, deletedAt: null }, orderBy: { position: "desc" }, select: { position: true } });
        await prisma.dish.create({
          data: {
            restaurantId: r.id,
            categoryId: cafeCat.id,
            name: inf.name,
            description: inf.description,
            price: inf.price,
            position: (maxPos?.position ?? -1) + 1,
            dishDiet: inf.dishDiet || "VEGAN",
            photos: [],
            tags: [],
            isActive: true,
          },
        });
      }
    }
  }

  // ======= 7. Marcar 🥜 en gelatos con frutos secos =======
  note("\n--- 7. Marcar 🥜 frutos secos ---");
  const nutMarks = [
    "Gelato Caramello Salato", // pralines de nueces
    "Gelato de Amaretto", // pralines de frutos secos
  ];
  for (const name of nutMarks) {
    const d = await prisma.dish.findFirst({ where: { restaurantId: r.id, name: { equals: name, mode: "insensitive" }, deletedAt: null } });
    if (!d) { note(`⚠️  No encontré para 🥜: ${name}`); continue; }
    if (d.containsNuts) { note(`= ya 🥜: ${d.name}`); continue; }
    note(`🥜 Marcar: ${d.name}`);
    if (!DRY_RUN) await prisma.dish.update({ where: { id: d.id }, data: { containsNuts: true } });
  }

  note(`\n=== ${DRY_RUN ? "DRY RUN — sin cambios" : "Sync completo"} ===`);
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });

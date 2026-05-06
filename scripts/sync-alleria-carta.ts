import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const RESTAURANT_SLUG = "alleria-pizza";
const DRY_RUN = process.env.DRY_RUN === "1";

async function main() {
  const r = await prisma.restaurant.findFirst({ where: { slug: RESTAURANT_SLUG } });
  if (!r) throw new Error("Restaurant Alleria no encontrado");

  const cats = await prisma.category.findMany({ where: { restaurantId: r.id } });
  const catByName = (name: string) => cats.find(c => c.name.toLowerCase().trim() === name.toLowerCase().trim());
  const catByContains = (frag: string) => cats.find(c => c.name.toLowerCase().includes(frag.toLowerCase()));

  const dishes = await prisma.dish.findMany({ where: { restaurantId: r.id, deletedAt: null } });
  const findDish = (name: string) => {
    const lower = name.toLowerCase().trim();
    return dishes.find(d => d.name.toLowerCase().trim() === lower);
  };

  const log: string[] = [];
  const note = (s: string) => { log.push(s); console.log(s); };

  note(`\n=== ${DRY_RUN ? "DRY RUN " : ""}Sincronización Alleria ===\n`);

  // 1. PRECIOS
  note("--- 1. Precios ---");
  const priceFixes = [
    { name: "Margherita", newPrice: 11600 },
    { name: "TheTop Pizza", newPrice: 11300 },
    { name: "Arlecchino", newPrice: 23190 },
  ];
  for (const f of priceFixes) {
    const d = findDish(f.name);
    if (!d) { note(`⚠️  No encontré: ${f.name}`); continue; }
    if (d.price === f.newPrice) { note(`= ${d.name} ya tiene precio $${d.price.toLocaleString("es-CL")}`); continue; }
    note(`✓ ${d.name}: $${d.price.toLocaleString("es-CL")} → $${f.newPrice.toLocaleString("es-CL")}`);
    if (!DRY_RUN) await prisma.dish.update({ where: { id: d.id }, data: { price: f.newPrice } });
  }

  // 2. NOMBRES
  note("\n--- 2. Nombres / typos ---");
  const renames = [
    { from: "Arancinis.", to: "Arancini di riso" },
    { from: "Gnocchi quatro formaggi", to: "Gnocchi quattro formaggi" },
    { from: "Tiramisu Alleria", to: "Tiramisú Alleria" },
  ];
  for (const ren of renames) {
    const d = findDish(ren.from);
    if (!d) { note(`⚠️  No encontré: "${ren.from}"`); continue; }
    note(`✓ "${ren.from}" → "${ren.to}"`);
    if (!DRY_RUN) await prisma.dish.update({ where: { id: d.id }, data: { name: ren.to } });
  }

  // 3. ELIMINAR
  note("\n--- 3. Eliminar (no están en el doc) ---");
  const toDelete = ["Mini Margherita", "Helado de Vainilla Francesa", "coca cola"];
  for (const name of toDelete) {
    const d = findDish(name);
    if (!d) { note(`⚠️  No encontré para eliminar: ${name}`); continue; }
    note(`🗑️  Eliminando: ${d.name} ($${d.price.toLocaleString("es-CL")})`);
    if (!DRY_RUN) await prisma.dish.update({ where: { id: d.id }, data: { deletedAt: new Date(), isActive: false } });
  }

  // 4. CREAR
  note("\n--- 4. Crear nuevos ---");
  const newDishes = [
    {
      name: "Rosticería 2 personas",
      categoryName: "Antipasti",
      price: 12700,
      description: "2 croquet (papa apanada con grana padano y relleno de fior di latte) y 2 arancini (albóndigas de risotto con carne y apanadas, en ragú de pomodoro). Para 2 personas.",
      dishDiet: "OMNIVORE" as const,
    },
    {
      name: "Lasagna artesanal en ragú napolitano",
      categoryName: "Pastas",
      price: 16990,
      description: "Ragú napolitano, bechamel, finas láminas de pasta artesanal, fior di latte, grana padano y nuestra base de pomodoro.",
      dishDiet: "OMNIVORE" as const,
    },
    {
      name: "Gelato fior di latte",
      categoryName: "Postres",
      price: 4700,
      description: "Cremoso helado artesanal de fior di latte con frutos rojos.",
      dishDiet: "VEGETARIAN" as const,
    },
    {
      name: "Gelato amaretto",
      categoryName: "Postres",
      price: 4700,
      description: "Cremoso helado artesanal con licor amaretto, caramelo salado y praliné.",
      dishDiet: "VEGETARIAN" as const,
    },
    {
      name: "Gelato di pistachio",
      categoryName: "Postres",
      price: 4700,
      description: "Cremoso helado artesanal de pistachio con pistacho granulado.",
      dishDiet: "VEGETARIAN" as const,
      containsNuts: true,
    },
  ];
  for (const nd of newDishes) {
    const cat = catByName(nd.categoryName) || catByContains(nd.categoryName);
    if (!cat) { note(`⚠️  Categoría no encontrada: ${nd.categoryName}`); continue; }
    if (findDish(nd.name)) { note(`= Ya existe: ${nd.name}`); continue; }
    note(`➕ Crear [${cat.name}] ${nd.name} — $${nd.price.toLocaleString("es-CL")}`);
    if (!DRY_RUN) {
      const maxPos = await prisma.dish.findFirst({
        where: { categoryId: cat.id, deletedAt: null },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      await prisma.dish.create({
        data: {
          restaurantId: r.id,
          categoryId: cat.id,
          name: nd.name,
          description: nd.description,
          price: nd.price,
          position: (maxPos?.position ?? -1) + 1,
          dishDiet: nd.dishDiet,
          containsNuts: nd.containsNuts || false,
          photos: [],
          tags: [],
          isActive: true,
        },
      });
    }
  }

  // 5. MARCAR FRUTOS SECOS (containsNuts)
  note("\n--- 5. Marcar 🥜 contiene frutos secos ---");
  // Reload dishes (algunos cambiaron de nombre)
  const refreshed = DRY_RUN ? dishes : await prisma.dish.findMany({ where: { restaurantId: r.id, deletedAt: null } });
  const findRefreshed = (name: string) => {
    const lower = name.toLowerCase().trim();
    return refreshed.find(d => d.name.toLowerCase().trim() === lower);
  };
  const nutDishNames = [
    "Cannoli di Pistacho",
    "Angioletti Fritti con Nutella",
    "MINI Angioletti Fritti Con Nutella",
    "Tiramisú Alleria",
    "Cannoli Alleria",
    "Cannolis 2 Sabores",
    "Toscana",
    "Sofía",
    "Don Marocchino",
    "Don Vittorio",
    "Antipasti para dos",
    "Risotto porcini",
  ];
  for (const name of nutDishNames) {
    const d = findRefreshed(name);
    if (!d) { note(`⚠️  No encontré para 🥜: ${name}`); continue; }
    if (d.containsNuts) { note(`= Ya marcado 🥜: ${d.name}`); continue; }
    note(`🥜 Marcar: ${d.name}`);
    if (!DRY_RUN) await prisma.dish.update({ where: { id: d.id }, data: { containsNuts: true } });
  }

  note(`\n=== ${DRY_RUN ? "DRY RUN — sin cambios aplicados" : "Sincronización completa"} ===`);
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });

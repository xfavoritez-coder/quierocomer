import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  const slugs = [
    "ravioli-de-ricotta-y-nuez-48-un",
    "ravioli-de-ricotta",
    "ravioli-de-verdura-y-pollo-48-un",
  ];

  // Also check if savedDish model exists (might be feedSaved)


  const restaurant = await p.restaurant.findUnique({
    where: { slug: "ristorante-y-trattoria-da-noi" },
    select: { id: true, name: true },
  });

  if (!restaurant) {
    console.error("Restaurante no encontrado");
    process.exit(1);
  }

  console.log(`Restaurante: ${restaurant.name} (${restaurant.id})`);

  // Find all dishes for this restaurant and match by name (slug is derived from name)
  const allDishes = await p.dish.findMany({
    where: { restaurantId: restaurant.id },
    select: { id: true, name: true },
  });

  // Slugify helper (mirrors how QC generates slugs)
  const slugify = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const toDelete = allDishes.filter(d => slugs.includes(slugify(d.name)));

  if (toDelete.length === 0) {
    console.log("  ⚠ No se encontraron platos con esos slugs");
    console.log("  Platos disponibles:");
    allDishes.filter(d => /ravioli/i.test(d.name)).forEach(d =>
      console.log(`    - "${d.name}" → ${slugify(d.name)}`)
    );
  }

  for (const dish of toDelete) {
    await p.dishSuggestion.deleteMany({
      where: { OR: [{ dishId: dish.id }, { suggestedDishId: dish.id }] },
    }).catch(() => {});
    await p.feedSaved.deleteMany({ where: { dishId: dish.id } }).catch(() => {});
    await p.feedInteraction.deleteMany({ where: { dishId: dish.id } }).catch(() => {});
    await (p as any).feedDishStats?.delete({ where: { dishId: dish.id } }).catch(() => {});

    await p.dish.delete({ where: { id: dish.id } });
    console.log(`  ✓ Eliminado: "${dish.name}"`);
  }

  await p.$disconnect();
}

main().catch(console.error);

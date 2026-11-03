import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const PRODUCT_NAMES = [
  "camote furai",
  "sake en palta",
  "seitan",
  "champi",
  "maracuya",
  "palmito",
  "choclo",
];

const TEMPLATE_NAME = "Envuelto";
const GROUP_NAME = "Envuelto en";
const OPTIONS = [
  { name: "Envuelto en palta", priceAdjustment: 0 },
  { name: "Envuelto en Panako", priceAdjustment: 0 },
];

async function processRestaurant(restaurantId: string, restaurantName: string) {
  console.log(`\n── ${restaurantName} (${restaurantId}) ──`);

  // Find matching dishes
  const dishes = await prisma.dish.findMany({
    where: {
      category: { restaurantId },
      deletedAt: null,
      name: { in: PRODUCT_NAMES.map((n) => n), mode: "insensitive" } as any,
    },
    select: { id: true, name: true },
  });

  // Fallback: contains search for partial matches
  const allDishes = await prisma.dish.findMany({
    where: { category: { restaurantId }, deletedAt: null },
    select: { id: true, name: true },
  });

  const matched = allDishes.filter((d) =>
    PRODUCT_NAMES.some((p) => d.name.toLowerCase().includes(p.toLowerCase()))
  );

  console.log(`Platos encontrados (${matched.length}):`);
  matched.forEach((d) => console.log(`  • ${d.name} (${d.id})`));

  if (matched.length === 0) {
    console.log("  ⚠ Sin platos que coincidan, saltando.");
    return;
  }

  // Create modifier template
  const template = await prisma.modifierTemplate.create({
    data: {
      restaurantId,
      name: TEMPLATE_NAME,
      scope: "product",
      groups: {
        create: {
          name: GROUP_NAME,
          required: false,
          minSelect: 0,
          maxSelect: 1,
          position: 0,
          options: {
            create: OPTIONS.map((o, i) => ({
              name: o.name,
              priceAdjustment: o.priceAdjustment,
              position: i,
            })),
          },
        },
      },
    },
  });

  console.log(`✓ Template creado: ${template.id}`);

  // Attach template to all matched dishes
  for (const dish of matched) {
    await prisma.dish.update({
      where: { id: dish.id },
      data: { modifierTemplates: { connect: { id: template.id } } },
    });
    console.log(`  ✓ Conectado: ${dish.name}`);
  }
}

async function main() {
  const restaurants = await prisma.restaurant.findMany({
    where: { slug: { in: ["kojo-sushi-recoleta", "kojo-sushi-la-florida"] } },
    select: { id: true, slug: true, name: true },
  });

  for (const r of restaurants) {
    await processRestaurant(r.id, `${r.name} (${r.slug})`);
  }

  console.log("\n✅ Listo");
}

main().catch(console.error).finally(() => prisma.$disconnect());

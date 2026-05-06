import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { OR: [{ slug: { contains: "alleria" } }, { name: { contains: "Alleria" } }] },
    include: {
      categories: { orderBy: { position: "asc" }, select: { id: true, name: true, isActive: true, dishType: true } },
      dishes: {
        where: { deletedAt: null },
        orderBy: [{ category: { position: "asc" } }, { position: "asc" }],
        select: {
          id: true, name: true, price: true, isActive: true, isHero: true,
          dishDiet: true, isSpicy: true, containsNuts: true,
          isGlutenFree: true, isLactoseFree: true, isSoyFree: true,
          categoryId: true,
          category: { select: { name: true } },
        },
      },
    },
  });
  if (!r) { console.log("No se encontró Alleria"); return; }
  console.log(`Restaurant: ${r.name} (slug: ${r.slug}) — id ${r.id}`);
  console.log(`Categorias (${r.categories.length}):`);
  for (const c of r.categories) {
    console.log(`  - ${c.name}${c.isActive ? "" : " [INACTIVA]"}${c.dishType ? ` <${c.dishType}>` : ""}`);
  }
  console.log(`\nPlatos (${r.dishes.length}):`);
  for (const d of r.dishes) {
    const flags: string[] = [];
    if (d.dishDiet === "VEGAN") flags.push("VEG");
    if (d.dishDiet === "VEGETARIAN") flags.push("VEGT");
    if (d.isSpicy) flags.push("PIC");
    if (d.containsNuts) flags.push("NUTS");
    if (d.isGlutenFree) flags.push("GF");
    if (d.isLactoseFree) flags.push("LF");
    if (d.isSoyFree) flags.push("SF");
    if (!d.isActive) flags.push("OCULTO");
    if (d.isHero) flags.push("HERO");
    console.log(`  [${d.category.name}] ${d.name} — $${d.price.toLocaleString("es-CL")} ${flags.length ? "{" + flags.join(",") + "}" : ""}`);
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });

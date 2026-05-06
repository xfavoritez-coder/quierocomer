import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "1";

async function main() {
  // Categorias drink + cafetería + cualquier tipo "drink" — todos los platos pasan a OMNIVORE
  // (que es "sin sello dieta" en la UI)
  const drinkCats = await prisma.category.findMany({
    where: {
      OR: [
        { dishType: "drink" },
        { name: { contains: "Cafet", mode: "insensitive" } },
        { name: { contains: "Bebida", mode: "insensitive" } },
        { name: { contains: "Bebestible", mode: "insensitive" } },
        { name: { contains: "Café", mode: "insensitive" } },
        { name: { contains: "Cafe", mode: "insensitive" } },
        { name: { contains: "Trago", mode: "insensitive" } },
        { name: { contains: "Cocktail", mode: "insensitive" } },
        { name: { contains: "Vino", mode: "insensitive" } },
        { name: { contains: "Cerveza", mode: "insensitive" } },
        { name: { contains: "Jugo", mode: "insensitive" } },
        { name: { contains: "Infusi", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, dishType: true, restaurant: { select: { name: true } } },
  });

  console.log(`Categorías de bebida encontradas: ${drinkCats.length}`);

  let updated = 0;
  for (const cat of drinkCats) {
    const result = await prisma.dish.updateMany({
      where: {
        categoryId: cat.id,
        deletedAt: null,
        dishDiet: { in: ["VEGAN", "VEGETARIAN"] },
      },
      data: { dishDiet: "OMNIVORE" },
    });
    if (result.count > 0) {
      console.log(`  [${cat.restaurant.name}] ${cat.name}: ${result.count} platos actualizados`);
      updated += result.count;
    }
  }

  console.log(`\nTotal: ${updated} platos de bebida con sello vegano/vegetariano limpiado a OMNIVORE`);
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });

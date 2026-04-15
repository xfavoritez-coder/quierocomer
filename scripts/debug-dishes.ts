import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const EXCLUDE = ["DESSERT","ICE_CREAM","COFFEE","TEA","SMOOTHIE","JUICE","DRINK","BEER","WINE","COCKTAIL","OTHER"];

  // What the API query would return
  const dishes = await p.menuItem.findMany({
    where: {
      isAvailable: true,
      imagenUrl: { not: null },
      categoria: { notIn: EXCLUDE },
    },
    take: 9,
    select: { id: true, nombre: true, categoria: true, imagenUrl: true, localId: true },
  });

  console.log("API would return:", dishes.length, "dishes");
  dishes.forEach(d => console.log(`  [${d.categoria}] ${d.nombre} | img: ${d.imagenUrl ? "YES" : "NO"}`));

  // Also check: what if imagenUrl filter is the problem?
  const withoutImgFilter = await p.menuItem.count({
    where: { isAvailable: true, categoria: { notIn: EXCLUDE } },
  });
  const withImgFilter = await p.menuItem.count({
    where: { isAvailable: true, imagenUrl: { not: null }, categoria: { notIn: EXCLUDE } },
  });
  console.log("\nSin filtro imagen:", withoutImgFilter);
  console.log("Con filtro imagen:", withImgFilter);

  // Check a sample imagenUrl
  const sample = await p.menuItem.findFirst({ where: { imagenUrl: { not: null } }, select: { imagenUrl: true, nombre: true } });
  console.log("\nSample imagenUrl:", sample?.imagenUrl?.slice(0, 80));

  // Check if imagenUrl is empty string vs null
  const emptyStr = await p.menuItem.count({ where: { imagenUrl: "" } });
  const nullImg = await p.menuItem.count({ where: { imagenUrl: null } });
  console.log("imagenUrl empty string:", emptyStr);
  console.log("imagenUrl null:", nullImg);
}
main().finally(() => p.$disconnect());

import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const locales = await p.local.count();
  const platos = await p.menuItem.count();
  const disponibles = await p.menuItem.count({ where: { isAvailable: true } });
  const conImagen = await p.menuItem.count({ where: { isAvailable: true, imagenUrl: { not: null } } });
  const sinImagen = await p.menuItem.count({ where: { isAvailable: true, imagenUrl: null } });
  const EXCLUDE = ["DESSERT","ICE_CREAM","COFFEE","TEA","SMOOTHIE","JUICE","DRINK","BEER","WINE","COCKTAIL","OTHER"];
  const comidaReal = await p.menuItem.count({ where: { isAvailable: true, imagenUrl: { not: null }, categoria: { notIn: EXCLUDE } } });
  console.log("Locales:", locales);
  console.log("Platos total:", platos);
  console.log("Disponibles:", disponibles);
  console.log("Con imagen:", conImagen);
  console.log("Sin imagen:", sinImagen);
  console.log("Comida real (sin postres/bebidas, con imagen):", comidaReal);
}
main().finally(() => p.$disconnect());

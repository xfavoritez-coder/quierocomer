import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  // Check "supreme" and "ebi acevichado"
  const platos = await p.menuItem.findMany({
    where: { OR: [
      { nombre: { contains: "supreme", mode: "insensitive" } },
      { nombre: { contains: "ebi acevichado", mode: "insensitive" } },
    ]},
    include: { ingredientTags: { include: { ingredient: true } }, local: { select: { nombre: true } } },
  });

  for (const p of platos) {
    const ings = p.ingredientTags.map(t => `${t.ingredient.name} (${t.ingredient.category})`);
    console.log(`\n${p.nombre} [${p.local.nombre}]`);
    console.log(`  Categoria: ${p.categoria}`);
    console.log(`  Ingredientes DB: ${p.ingredients.join(", ") || "NINGUNO"}`);
    console.log(`  Tags: ${ings.join(", ") || "NINGUNO"}`);
    console.log(`  Descripcion: ${p.descripcion?.slice(0, 100) || "SIN"}`);
  }

  // Check how many dishes from Kojo (vegano) have animal ingredients
  const kojo = await p.local.findFirst({ where: { nombre: { contains: "kojo", mode: "insensitive" } } });
  if (kojo) {
    const kojoPlatos = await p.menuItem.findMany({
      where: { localId: kojo.id },
      include: { ingredientTags: { include: { ingredient: true } } },
    });
    const animalIngs = ["pollo", "carne", "cerdo", "salmón", "salmon", "camarón", "camaron", "ebi", "huevo", "jamón", "jamon", "pepperoni", "queso", "crema", "mozzarella", "cheddar"];
    const withAnimal = kojoPlatos.filter(p =>
      p.ingredientTags.some(t => animalIngs.includes(t.ingredient.name.toLowerCase()))
    );
    console.log(`\nKojo: ${kojoPlatos.length} platos, ${withAnimal.length} con ingredientes animales`);
    withAnimal.forEach(p => console.log(`  ${p.nombre}: ${p.ingredientTags.map(t => t.ingredient.name).join(", ")}`));
  }

  // Check Hand Roll — how many have animal ingredients
  const hr = await p.local.findFirst({ where: { nombre: { contains: "hand roll", mode: "insensitive" } } });
  if (hr) {
    const hrPlatos = await p.menuItem.findMany({
      where: { localId: hr.id },
      include: { ingredientTags: { include: { ingredient: true } } },
    });
    const veganos = hrPlatos.filter(p => {
      const ings = p.ingredientTags.map(t => t.ingredient.name.toLowerCase());
      return !ings.some(i => ["pollo", "carne", "cerdo", "salmón", "salmon", "camarón", "camaron", "ebi", "huevo", "jamón", "jamon", "pepperoni", "beef", "tori", "lomo", "mechada", "prosciutto"].includes(i));
    });
    console.log(`\nHand Roll: ${hrPlatos.length} platos, ${veganos.length} sin carne/animal`);
  }
}

main().finally(() => p.$disconnect());

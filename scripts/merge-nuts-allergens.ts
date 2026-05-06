import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "1";

// Alergenos individuales de frutos secos que vamos a unificar en "frutos secos"
const NUT_NAMES = ["maní", "mani", "nueces", "almendras", "nuez", "almendra", "avellana", "avellanas", "pistacho", "pistachos", "pistaccio", "pistacchio", "marañon", "marañón", "cashew", "anacardo"];

async function main() {
  console.log(`\n=== ${DRY_RUN ? "DRY RUN " : ""}Unificar alergenos de frutos secos ===\n`);

  // 1. Buscar/crear el allergen canonical "frutos secos"
  let canonical = await prisma.allergen.findFirst({ where: { name: "frutos secos" } });
  if (!canonical) {
    console.log(`📁 Crear alergeno "frutos secos"`);
    if (!DRY_RUN) {
      const maxPos = await prisma.allergen.findFirst({ where: { type: "ALLERGEN" }, orderBy: { position: "desc" }, select: { position: true } });
      canonical = await prisma.allergen.create({
        data: { name: "frutos secos", type: "ALLERGEN", position: (maxPos?.position ?? -1) + 1 },
      });
    } else {
      canonical = { id: "DRY-RUN", name: "frutos secos", type: "ALLERGEN", position: 0 } as any;
    }
  } else {
    console.log(`= Alergeno "frutos secos" ya existe (id: ${canonical.id})`);
  }

  // 2. Encontrar todos los alergenos legacy a fusionar
  const legacy = await prisma.allergen.findMany({
    where: { name: { in: NUT_NAMES }, NOT: { id: canonical!.id } },
    include: { ingredients: { select: { id: true, name: true } } },
  });

  if (legacy.length === 0) {
    console.log(`No hay alergenos legacy de nuts para unificar`);
    return;
  }

  console.log(`\nAlergenos a fusionar en "frutos secos" (${legacy.length}):`);
  for (const a of legacy) {
    console.log(`  - "${a.name}" (id ${a.id.substring(0, 12)}…) — ${a.ingredients.length} ingredientes`);
  }

  // 3. Mover todos los ingredientes al canonical
  const allIngredientIds = new Set<string>();
  for (const a of legacy) {
    for (const i of a.ingredients) allIngredientIds.add(i.id);
  }
  console.log(`\nIngredientes únicos a mover: ${allIngredientIds.size}`);

  if (!DRY_RUN && allIngredientIds.size > 0) {
    await prisma.allergen.update({
      where: { id: canonical!.id },
      data: {
        ingredients: { connect: Array.from(allIngredientIds).map(id => ({ id })) },
      },
    });
    console.log(`✓ Ingredientes vinculados a "frutos secos"`);
  }

  // 4. Borrar los alergenos legacy
  if (!DRY_RUN) {
    for (const a of legacy) {
      await prisma.allergen.delete({ where: { id: a.id } });
      console.log(`✓ Eliminado alergeno legacy: "${a.name}"`);
    }
  }

  console.log(`\n=== ${DRY_RUN ? "DRY RUN — sin cambios" : "Migración completa"} ===`);
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });

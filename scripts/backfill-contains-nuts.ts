import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "1";

// Patrones de alérgenos / ingredientes con frutos secos
const NUT_REGEX = /man[ií]|nuez|nueces|almendr|frutos secos|avellana|pistach|mara[nñ]on|cashew|coco rallado/i;

async function main() {
  // Solo platos NO marcados aún (containsNuts=false) y no eliminados
  const dishes = await prisma.dish.findMany({
    where: { deletedAt: null, containsNuts: false },
    include: {
      restaurant: { select: { name: true } },
      dishIngredients: {
        include: {
          ingredient: { include: { allergens: { select: { name: true } } } },
        },
      },
    },
  });

  console.log(`Escaneando ${dishes.length} platos sin containsNuts marcado...\n`);

  const toMark: { id: string; name: string; restaurant: string; reasons: string[] }[] = [];

  for (const d of dishes) {
    const reasons: string[] = [];

    // 1. Alergenos de ingredientes
    for (const di of d.dishIngredients) {
      const ingName = di.ingredient.name;
      if (NUT_REGEX.test(ingName)) reasons.push(`ingrediente "${ingName}"`);
      for (const a of di.ingredient.allergens) {
        if (NUT_REGEX.test(a.name)) reasons.push(`alergeno "${a.name}" (vía ${ingName})`);
      }
    }

    // 2. Texto de ingredientes legacy
    if (d.ingredients && NUT_REGEX.test(d.ingredients)) {
      reasons.push(`texto ingredientes contiene nuts`);
    }

    // 3. Texto de alergenos legacy (campo string)
    if (d.allergens && NUT_REGEX.test(d.allergens)) {
      reasons.push(`campo allergens contiene nuts`);
    }

    // 4. Descripción del plato (último recurso) — buscar palabras clave
    if (d.description && NUT_REGEX.test(d.description)) {
      reasons.push(`descripción menciona nuts`);
    }

    if (reasons.length > 0) {
      toMark.push({ id: d.id, name: d.name, restaurant: d.restaurant.name, reasons: [...new Set(reasons)] });
    }
  }

  console.log(`Platos a marcar con containsNuts=true: ${toMark.length}\n`);
  for (const t of toMark) {
    console.log(`🥜 [${t.restaurant}] ${t.name}`);
    console.log(`   Razones: ${t.reasons.join(", ")}`);
  }

  if (!DRY_RUN && toMark.length > 0) {
    await prisma.dish.updateMany({
      where: { id: { in: toMark.map(t => t.id) } },
      data: { containsNuts: true },
    });
    console.log(`\n✓ ${toMark.length} platos marcados con containsNuts=true`);
  } else if (DRY_RUN) {
    console.log(`\n[DRY RUN — sin cambios aplicados]`);
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });

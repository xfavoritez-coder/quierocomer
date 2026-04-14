import { PrismaClient } from "@prisma/client";

// Source: DeseoComer DB
const src = new PrismaClient({
  datasources: { db: { url: "postgresql://postgres.ybsttlzviefwjafpbikc:DeseoComer2026!@aws-1-us-east-1.pooler.supabase.com:5432/postgres" } },
});

// Destination: QuieroComer DB
const dst = new PrismaClient({
  datasources: { db: { url: "postgresql://postgres.awbeyxfqtrdfhengabmw:quierocomer6868@aws-1-us-east-1.pooler.supabase.com:5432/postgres" } },
});

const LOCAL_NAMES = ["Hand Roll", "Kojo", "Vegan Mobile", "Katako", "Nana"];

async function main() {
  console.log("=== Migrando datos DeseoComer → QuieroComer ===\n");

  // 1. Migrate locals
  for (const name of LOCAL_NAMES) {
    const local = await src.local.findFirst({
      where: { nombre: { contains: name, mode: "insensitive" } },
    });
    if (!local) { console.log(`❌ ${name} no encontrado en origen`); continue; }

    const exists = await dst.local.findFirst({ where: { email: local.email } });
    if (exists) { console.log(`⏭️ ${local.nombre} ya existe en destino`); continue; }

    const { updatedAt, ...data } = local;
    await dst.local.create({ data: { ...data } });
    console.log(`✅ Local: ${local.nombre}`);
  }

  // 2. Migrate ingredients
  const ingredients = await src.ingredient.findMany();
  console.log(`\nIngredientes: ${ingredients.length}`);
  for (const ing of ingredients) {
    const exists = await dst.ingredient.findUnique({ where: { name: ing.name } });
    if (!exists) {
      await dst.ingredient.create({ data: { id: ing.id, name: ing.name, category: ing.category } });
    }
  }
  console.log("✅ Ingredientes migrados");

  // 3. Migrate menu items + tags
  for (const name of LOCAL_NAMES) {
    const srcLocal = await src.local.findFirst({ where: { nombre: { contains: name, mode: "insensitive" } }, select: { id: true, nombre: true, email: true } });
    if (!srcLocal) continue;

    const dstLocal = await dst.local.findFirst({ where: { email: srcLocal.email }, select: { id: true } });
    if (!dstLocal) continue;

    const existingCount = await dst.menuItem.count({ where: { localId: dstLocal.id } });
    if (existingCount > 0) { console.log(`⏭️ ${srcLocal.nombre} ya tiene ${existingCount} platos`); continue; }

    const items = await src.menuItem.findMany({
      where: { localId: srcLocal.id },
      include: { ingredientTags: true },
    });

    let created = 0;
    for (const item of items) {
      const { id: _, localId: __, createdAt, ingredientTags, ...data } = item;
      const newItem = await dst.menuItem.create({
        data: { ...data, localId: dstLocal.id },
      });

      // Create ingredient tags
      for (const tag of ingredientTags) {
        await dst.ingredientTag.create({
          data: { menuItemId: newItem.id, ingredientId: tag.ingredientId },
        }).catch(() => {}); // Skip if ingredient doesn't exist
      }
      created++;
    }
    console.log(`✅ ${srcLocal.nombre}: ${created} platos migrados`);
  }

  console.log("\n=== Migración completa ===");
}

main().finally(async () => { await src.$disconnect(); await dst.$disconnect(); });

/**
 * Limpia promos duplicadas de Kojo La Florida y Recoleta.
 * Deja 1 promo por tipo (la que tiene linkedDishId), marca el resto DELETED.
 */
import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const RESTAURANTS = [
  { id: "cmubc0yoq0001jv041si8zicn", name: "La Florida" },
  { id: "cmvcjbx090001jn074i0eg9zu", name: "Recoleta" },
];

async function main() {
  for (const r of RESTAURANTS) {
    console.log(`\n── ${r.name} ──`);

    const promos = await db.promotion.findMany({
      where: { restaurantId: r.id, status: { not: "DELETED" } },
      select: { id: true, name: true, status: true, linkedDishId: true, dishIds: true, daysOfWeek: true },
      orderBy: { createdAt: "asc" },
    });

    console.log(`  Promos activas: ${promos.length}`);

    // Agrupar por nombre
    const byName = new Map<string, typeof promos>();
    for (const p of promos) {
      const key = p.name.trim().toLowerCase();
      byName.set(key, [...(byName.get(key) ?? []), p]);
    }

    for (const [name, group] of byName) {
      if (group.length <= 1) continue;

      console.log(`  ⚠ "${name}" tiene ${group.length} registros, buscando duplicados...`);

      // Preferir el que tiene linkedDishId; si ninguno tiene, el primero
      const keep = group.find((p) => p.linkedDishId) ?? group[0];
      const toDelete = group.filter((p) => p.id !== keep.id);

      console.log(`    ✓ Mantener: [${keep.id}] linkedDish=${keep.linkedDishId ?? "null"}`);

      for (const p of toDelete) {
        // Si tiene un linkedDish huérfano, desactivarlo
        if (p.linkedDishId) {
          await db.dish.updateMany({
            where: { id: p.linkedDishId, deletedAt: null },
            data: { isActive: false, deletedAt: new Date() },
          });
          console.log(`    🗑 linkedDish del duplicado desactivado: ${p.linkedDishId}`);
        }
        await db.promotion.update({ where: { id: p.id }, data: { status: "DELETED" } });
        console.log(`    🗑 Promo marcada DELETED: [${p.id}] "${p.name}"`);
      }
    }
  }

  // Verificar estado final
  console.log("\n── Estado final ──");
  for (const r of RESTAURANTS) {
    const promos = await db.promotion.findMany({
      where: { restaurantId: r.id, status: { not: "DELETED" } },
      select: { id: true, name: true, status: true, linkedDishId: true, daysOfWeek: true },
      orderBy: { createdAt: "asc" },
    });
    console.log(`\n  ${r.name} (${promos.length} promos):`);
    for (const p of promos) {
      console.log(`    "${p.name}" days=[${p.daysOfWeek}] linkedDish=${p.linkedDishId ?? "null"}`);
    }
  }

  console.log("\n✅ Listo");
}

main().catch(console.error).finally(() => db.$disconnect());

import { config } from "dotenv";
config({ path: ".env.prod" });
import { Client } from "pg";
const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });

async function q(sql: string, params: any[] = []) {
  return (await client.query(sql, params)).rows;
}

async function main() {
  await client.connect();

  // 1. Activar "Deluxe (60 piezas)" en ambos locales
  //    (estaba isActive=false porque antes el linkedDish era el visible)
  const deluxeIds = [
    "cmubc0yvq0008jv04zyvvopoa", // La Florida
    "cmvcjbxdb001pjn07ad700h7k", // Recoleta
  ];
  for (const id of deluxeIds) {
    const [d] = await q(`SELECT id, name, "isActive" FROM "Dish" WHERE id = $1`, [id]);
    console.log(`Activando "${d.name}" (${id}) — era isActive=${d.isActive}`);
    await q(`UPDATE "Dish" SET "isActive" = true WHERE id = $1`, [id]);
  }

  // 2. Renombrar "🔥 Miércoles Mix" → "Miércoles Mix" en ambos locales
  const mixIds = [
    "cmw0s3ayp0007enjk0hb9f0i3", // La Florida
    "cmw0s3k02000henjkc698ap34", // Recoleta
  ];
  for (const id of mixIds) {
    const [d] = await q(`SELECT id, name FROM "Dish" WHERE id = $1`, [id]);
    if (d) {
      const newName = d.name.replace(/^🔥\s*/, "");
      console.log(`Renombrando "${d.name}" → "${newName}"`);
      await q(`UPDATE "Dish" SET name = $1 WHERE id = $2`, [newName, id]);
    }
  }

  // 3. Verificar estado final
  console.log("\n=== Estado final ===");
  for (const id of [...deluxeIds, ...mixIds]) {
    const [d] = await q(`SELECT id, name, "isActive", "deletedAt", "daysOfWeek" FROM "Dish" WHERE id = $1`, [id]);
    if (d) console.log(`  "${d.name}" isActive=${d.isActive} deleted=${!!d.deletedAt} days=[${d.daysOfWeek}]`);
  }

  await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });

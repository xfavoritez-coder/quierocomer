import { config } from "dotenv";
config({ path: ".env.prod" });
import { Client } from "pg";
const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });

const KOJO1 = "cmubc0yoq0001jv041si8zicn";
const KOJO2 = "cmvcjbx090001jn074i0eg9zu";

async function q(sql: string, params: any[] = []) {
  return (await client.query(sql, params)).rows;
}

async function check(restaurantId: string, label: string) {
  console.log(`\n========== ${label} ==========`);

  // Promos activas
  const promos = await q(
    `SELECT id, name, status, "dishId", "promoName", "linkedDishId", "daysOfWeek", "promoPrice", "originalPrice"
     FROM "Promotion" WHERE "restaurantId" = $1 AND status != 'DELETED' ORDER BY "createdAt"`,
    [restaurantId]
  );
  console.log(`\nPromos activas: ${promos.length}`);
  for (const p of promos) {
    console.log(`  "${p.name}" status=${p.status} dishId=${p.dishId ?? "NULL"} linkedDishId=${p.linkedDishId ?? "NULL"}`);
    if (p.dishId) {
      const [d] = await q(`SELECT id, name, "isActive", "deletedAt", price, "ecommerceOnly", "appOnly" FROM "Dish" WHERE id = $1`, [p.dishId]);
      console.log(`    → dish: "${d?.name}" isActive=${d?.isActive} deleted=${!!d?.deletedAt} ecomOnly=${d?.ecommerceOnly} appOnly=${d?.appOnly}`);
    }
  }

  // Platos con emoji fuego u otras linked dishes que puedan estar mostrando
  const suspectDishes = await q(
    `SELECT id, name, "isActive", "deletedAt", "ecommerceOnly", "appOnly", price, "daysOfWeek"
     FROM "Dish"
     WHERE "restaurantId" = $1 AND (name LIKE '%🔥%' OR name LIKE '%Promo%' OR name LIKE '%fuego%')
     ORDER BY "createdAt"`,
    [restaurantId]
  );
  console.log(`\nPlatos con emoji/promo en nombre: ${suspectDishes.length}`);
  for (const d of suspectDishes) {
    console.log(`  "${d.name}" isActive=${d.isActive} deleted=${!!d.deletedAt} ecomOnly=${d.ecommerceOnly} days=[${d.daysOfWeek}]`);
  }

  // Platos VISIBLES en carta QR (isActive=true, deletedAt=null, no ecomOnly, no appOnly)
  const visibleDishes = await q(
    `SELECT id, name, "discountPrice", price, "ecommerceOnly", "appOnly", "daysOfWeek"
     FROM "Dish"
     WHERE "restaurantId" = $1 AND "isActive" = true AND "deletedAt" IS NULL
       AND "ecommerceOnly" = false AND "appOnly" = false
     ORDER BY position`,
    [restaurantId]
  );
  console.log(`\nPlatos visibles en carta QR: ${visibleDishes.length}`);
  for (const d of visibleDishes) {
    const days = d.daysOfWeek?.length ? ` [días: ${d.daysOfWeek.join(",")}]` : "";
    const disc = d.discountPrice ? ` discount=$${d.discountPrice}` : "";
    console.log(`  "${d.name}" $${d.price}${disc}${days}`);
  }
}

async function main() {
  await client.connect();
  await check(KOJO1, "Kojo La Florida");
  await check(KOJO2, "Kojo Recoleta");
  await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });

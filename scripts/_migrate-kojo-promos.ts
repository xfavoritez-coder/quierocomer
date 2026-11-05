/**
 * Migrate Kojo promos to new system (dishId model)
 *
 * - Deluxe & Suprema: set dishId = dishIds[0], clear linkedDishId (soft-delete linked dish)
 * - Mix: set daysOfWeek=[3] on linkedDish so it becomes a real carta dish, delete promo
 * - All linked dishes: set isActive=false + deletedAt (safe — orders already have JSON snapshots)
 */
import { config } from "dotenv";
config({ path: ".env.prod" });
import { Client } from "pg";

const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });

const KOJO1 = "cmubc0yoq0001jv041si8zicn";
const KOJO2 = "cmvcjbx090001jn074i0eg9zu";

async function q(sql: string, params: any[] = []) {
  const r = await client.query(sql, params);
  return r.rows;
}

async function inspect(restaurantId: string, label: string) {
  console.log(`\n========== ${label} (${restaurantId}) ==========`);
  const promos = await q(
    `SELECT id, name, status, "dishIds", "dishId", "promoName", "linkedDishId", "daysOfWeek", "promoPrice", "originalPrice"
     FROM "Promotion" WHERE "restaurantId" = $1 AND status != 'DELETED' ORDER BY "createdAt" ASC`,
    [restaurantId]
  );

  for (const p of promos) {
    console.log(`\n  [${p.id}] "${p.name}"`);
    console.log(`    status=${p.status}  dishId=${p.dishId ?? "NULL"}  dishIds=[${p.dishIds?.join(",")}]`);
    console.log(`    linkedDishId=${p.linkedDishId ?? "NULL"}  promoName=${p.promoName ?? "-"}`);
    console.log(`    prices: orig=${p.originalPrice} promo=${p.promoPrice}  days=[${p.daysOfWeek}]`);

    if (p.linkedDishId) {
      const [ld] = await q(
        `SELECT id, name, "isActive", "deletedAt", price, "categoryId", "daysOfWeek" FROM "Dish" WHERE id = $1`,
        [p.linkedDishId]
      );
      if (ld) console.log(`    linkedDish: "${ld.name}" active=${ld.isActive} deleted=${!!ld.deletedAt} price=${ld.price} days=[${ld.daysOfWeek}]`);
    }
    if (p.dishId) {
      const [d] = await q(`SELECT id, name, price FROM "Dish" WHERE id = $1`, [p.dishId]);
      if (d) console.log(`    dish (new): "${d.name}" price=${d.price}`);
    }
    if (p.dishIds?.length) {
      const dishes = await q(
        `SELECT id, name, price FROM "Dish" WHERE id = ANY($1)`,
        [p.dishIds]
      );
      console.log(`    dishIds dishes: ${dishes.map((d: any) => `"${d.name}" (${d.price})`).join(", ")}`);
    }
  }
}

async function migrate(restaurantId: string, label: string) {
  console.log(`\n\n========== MIGRATING ${label} ==========`);
  const promos = await q(
    `SELECT id, name, status, "dishIds", "dishId", "promoName", "linkedDishId", "daysOfWeek", "promoPrice", "originalPrice"
     FROM "Promotion" WHERE "restaurantId" = $1 AND status != 'DELETED'`,
    [restaurantId]
  );

  for (const p of promos) {
    const name = p.name as string;
    const isMix = /mix|miércoles|miercoles/i.test(name);
    const isDeluxe = /deluxe/i.test(name);
    const isSuprema = /suprema/i.test(name);

    if (isMix) {
      if (p.linkedDishId) {
        const [linkedDish] = await q(`SELECT id, name, "deletedAt" FROM "Dish" WHERE id = $1`, [p.linkedDishId]);
        if (linkedDish && !linkedDish.deletedAt) {
          console.log(`  [MIX] Setting daysOfWeek=[3] on linkedDish "${linkedDish.name}" (${linkedDish.id})`);
          await q(
            `UPDATE "Dish" SET "daysOfWeek" = ARRAY[3]::integer[], "isActive" = true, "ecommerceOnly" = false, "appOnly" = false WHERE id = $1`,
            [p.linkedDishId]
          );
        }
      }
      console.log(`  [MIX] Marking promo DELETED: "${p.name}" (${p.id})`);
      await q(`UPDATE "Promotion" SET status = 'DELETED' WHERE id = $1`, [p.id]);

    } else if (isDeluxe || isSuprema) {
      const targetDishId = p.dishId || p.dishIds?.[0] || null;
      if (!targetDishId) {
        console.log(`  [SKIP] "${p.name}" has no dish`);
        continue;
      }
      const [targetDish] = await q(`SELECT id, name, price FROM "Dish" WHERE id = $1`, [targetDishId]);
      if (!targetDish) {
        console.log(`  [ERROR] Target dish ${targetDishId} not found`);
        continue;
      }

      const tag = isDeluxe ? "DELUXE" : "SUPREMA";
      console.log(`  [${tag}] "${p.name}" → dishId="${targetDish.name}" (${targetDishId})`);
      const origPrice = p.originalPrice ?? targetDish.price;
      await q(
        `UPDATE "Promotion" SET "dishId" = $1, "originalPrice" = $2 WHERE id = $3`,
        [targetDishId, origPrice, p.id]
      );

      if (p.linkedDishId) {
        const [linkedDish] = await q(`SELECT id, name, "deletedAt" FROM "Dish" WHERE id = $1`, [p.linkedDishId]);
        if (linkedDish && !linkedDish.deletedAt) {
          console.log(`  [${tag}] Soft-deleting linkedDish "${linkedDish.name}" (${p.linkedDishId})`);
          await q(`UPDATE "Dish" SET "isActive" = false, "deletedAt" = NOW() WHERE id = $1`, [p.linkedDishId]);
        }
        await q(`UPDATE "Promotion" SET "linkedDishId" = NULL WHERE id = $1`, [p.id]);
      }

    } else {
      // Generic: set dishId = dishIds[0] if not already set
      if (!p.dishId && p.dishIds?.length) {
        const [d] = await q(`SELECT id, name FROM "Dish" WHERE id = $1`, [p.dishIds[0]]);
        if (d) {
          console.log(`  [OTHER] "${p.name}" → dishId="${d.name}"`);
          await q(`UPDATE "Promotion" SET "dishId" = $1 WHERE id = $2`, [p.dishIds[0], p.id]);
        }
      }
      if (p.linkedDishId) {
        const [linkedDish] = await q(`SELECT id, name, "deletedAt" FROM "Dish" WHERE id = $1`, [p.linkedDishId]);
        if (linkedDish && !linkedDish.deletedAt) {
          console.log(`  [OTHER] Soft-deleting linkedDish "${linkedDish.name}" (${p.linkedDishId})`);
          await q(`UPDATE "Dish" SET "isActive" = false, "deletedAt" = NOW() WHERE id = $1`, [p.linkedDishId]);
          await q(`UPDATE "Promotion" SET "linkedDishId" = NULL WHERE id = $1`, [p.id]);
        }
      }
    }
  }
  console.log(`  Done migrating ${label}`);
}

async function migrateAllOtherRestaurants() {
  console.log("\n\n========== OTHER RESTAURANTS (migrate dishIds[0] → dishId) ==========");
  const promos = await q(
    `SELECT id, name, "restaurantId", "dishIds", "linkedDishId"
     FROM "Promotion"
     WHERE "restaurantId" NOT IN ($1, $2)
       AND status != 'DELETED'
       AND "dishId" IS NULL
       AND "linkedDishId" IS NOT NULL`,
    [KOJO1, KOJO2]
  );
  console.log(`Found ${promos.length} promos in other restaurants with linkedDish but no dishId`);

  for (const p of promos) {
    if (p.dishIds?.length) {
      const [d] = await q(`SELECT id, name FROM "Dish" WHERE id = $1`, [p.dishIds[0]]);
      if (d) {
        console.log(`  "${p.name}" → dishId="${d.name}"`);
        await q(`UPDATE "Promotion" SET "dishId" = $1 WHERE id = $2`, [p.dishIds[0], p.id]);
      }
    }
    const [linkedDish] = await q(`SELECT id, name, "deletedAt" FROM "Dish" WHERE id = $1`, [p.linkedDishId]);
    if (linkedDish && !linkedDish.deletedAt) {
      console.log(`  Soft-deleting linkedDish "${linkedDish.name}"`);
      await q(`UPDATE "Dish" SET "isActive" = false, "deletedAt" = NOW() WHERE id = $1`, [p.linkedDishId]);
      await q(`UPDATE "Promotion" SET "linkedDishId" = NULL WHERE id = $1`, [p.id]);
    }
  }
}

async function main() {
  await client.connect();
  const args = process.argv.slice(2);
  const DRY = !args.includes("--run");

  if (DRY) {
    console.log("=== DRY RUN (inspect only) — pass --run to execute ===");
    await inspect(KOJO1, "Kojo Local 1");
    await inspect(KOJO2, "Kojo Local 2");
  } else {
    console.log("=== RUNNING MIGRATION ===");
    await migrate(KOJO1, "Kojo Local 1");
    await migrate(KOJO2, "Kojo Local 2");
    await migrateAllOtherRestaurants();
    console.log("\n✓ Migration complete");
  }

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });

import { config } from "dotenv";
config({ path: ".env.prod" });
import { Client } from "pg";
const c = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
async function main() {
  await c.connect();
  // Promos activas con dishId para Kojo local 1
  const promos = await c.query(
    `SELECT id, name, "dishId", "promoName", "promoPrice", "originalPrice", "daysOfWeek", status
     FROM "Promotion" WHERE "restaurantId" = $1 AND status != 'DELETED'`,
    ["cmubc0yoq0001jv041si8zicn"]
  );
  console.log("=== Promos Kojo La Florida ===");
  promos.rows.forEach(p => console.log(JSON.stringify(p)));

  const todayDow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" })).getDay();
  console.log(`\nHoy es día de la semana: ${todayDow} (0=dom,1=lun,2=mar,3=mié,4=jue,5=vie,6=sáb)`);
  await c.end();
}
main().catch(console.error);

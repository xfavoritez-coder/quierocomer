import { config } from "dotenv";
config({ path: ".env.prod" });
import { Client } from "pg";
const client = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
async function main() {
  await client.connect();
  const r = await client.query(
    `SELECT id, name, slug FROM "Restaurant" WHERE id IN ($1, $2)`,
    ["cmubc0yoq0001jv041si8zicn", "cmvcjbx090001jn074i0eg9zu"]
  );
  r.rows.forEach(x => console.log(x.id, x.name, x.slug));
  await client.end();
}
main().catch(console.error);

/**
 * One-time setup: write Horus Vegan's Toteat credentials into the Restaurant
 * row from the local TOTEAT_* env vars. Run with:
 *   npx tsx scripts/seed-toteat-config.ts
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv(); // also .env if present

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const slug = "horusvegan";
  const xir = process.env.TOTEAT_RESTAURANT_ID;
  const xilStr = process.env.TOTEAT_LOCAL_ID;
  const xiuStr = process.env.TOTEAT_USER_ID;
  const token = process.env.TOTEAT_API_TOKEN;

  if (!xir || !xilStr || !xiuStr || !token) {
    console.error("❌ Missing env vars: TOTEAT_RESTAURANT_ID, TOTEAT_LOCAL_ID, TOTEAT_USER_ID, TOTEAT_API_TOKEN");
    process.exit(1);
  }

  const xil = parseInt(xilStr, 10);
  const xiu = parseInt(xiuStr, 10);
  if (!Number.isFinite(xil) || !Number.isFinite(xiu)) {
    console.error("❌ TOTEAT_LOCAL_ID and TOTEAT_USER_ID must be integers");
    process.exit(1);
  }

  const r = await prisma.restaurant.findUnique({ where: { slug } });
  if (!r) {
    console.error(`❌ Restaurant slug "${slug}" not found`);
    process.exit(1);
  }

  await prisma.restaurant.update({
    where: { id: r.id },
    data: {
      toteatRestaurantId: xir,
      toteatLocalId: xil,
      toteatUserId: xiu,
      toteatApiToken: token,
    },
  });

  console.log(`✅ Toteat credentials saved on Restaurant ${r.name} (${r.id})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

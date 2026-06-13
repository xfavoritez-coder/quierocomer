import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const result = await prisma.restaurant.updateMany({
    data: { ownerBannerEnabled: false },
  });
  console.log("Updated", result.count, "restaurants: ownerBannerEnabled = false");
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const result = await p.restaurant.updateMany({
    where: { slug: "forty-four" },
    data: { showCategoryLobby: true },
  });
  console.log(`Updated ${result.count} restaurants`);
  await p.$disconnect();
}

main().catch(console.error);

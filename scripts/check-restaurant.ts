import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
async function main() {
  const p = new PrismaClient();
  const r = await p.restaurant.findFirst({ where: { slug: process.argv[2] || "horus" }, select: { instagramUrl: true, website: true, name: true } });
  console.log(r?.name, "| ig:", r?.instagramUrl || "NULL", "| web:", r?.website || "NULL");
  await p.$disconnect();
}
main();

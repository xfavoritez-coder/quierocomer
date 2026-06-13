import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const slug = "heladeria-italia-1609-cafe-crepe";
  await p.restaurant.updateMany({ where: { slug }, data: { isDemo: false } });
  await p.lead.updateMany({ where: { generatedSlug: slug, activatedAt: null }, data: { activatedAt: new Date(), activated: true } });
  console.log("Activated");
  await p.$disconnect();
}
main();

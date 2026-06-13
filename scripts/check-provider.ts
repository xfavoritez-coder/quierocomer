import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
async function main() {
  const p = new PrismaClient();
  const prov = await p.menuProvider.findFirst({ where: { name: "QRPro" } });
  console.log(JSON.stringify(prov, null, 2));
  await p.$disconnect();
}
main();

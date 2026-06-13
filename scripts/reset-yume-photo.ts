import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
async function main() {
  const p = new PrismaClient();
  await p.lead.update({ where: { id: "cmpifm63d0000jv04r9oeqbqb" }, data: { cartaStatus: "PENDING", errorLog: null } });
  console.log("Reset Yume photo lead to PENDING");
  await p.$disconnect();
}
main();

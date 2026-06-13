import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
async function main() {
  const p = new PrismaClient();
  const lead = await p.lead.findUnique({ where: { id: "cmpjoi0hh0000jr04n8xghh4b" }, select: { cartaFileUrl: true, cartaType: true, whatsapp: true } });
  console.log("Type:", lead?.cartaType);
  console.log("WA:", lead?.whatsapp);
  console.log("Files:", lead?.cartaFileUrl);
  await p.$disconnect();
}
main();

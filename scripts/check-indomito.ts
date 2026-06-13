import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
async function main() {
  const p = new PrismaClient();
  const lead = await p.lead.findFirst({ where: { localName: { contains: "ndómito", mode: "insensitive" } }, select: { whatsapp: true, whatsappSentAt: true, email: true, ownerName: true } });
  console.log("WA:", lead?.whatsapp || "NULL");
  console.log("WA sent:", lead?.whatsappSentAt || "NULL");
  console.log("Email:", lead?.email);
  console.log("Owner:", lead?.ownerName);
  await p.$disconnect();
}
main();

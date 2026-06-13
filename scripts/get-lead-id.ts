import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
async function main() {
  const p = new PrismaClient();
  const lead = await p.lead.findFirst({ where: { localName: { contains: process.argv[2] || "parada", mode: "insensitive" } }, orderBy: { createdAt: "desc" }, select: { id: true, localName: true, email: true } });
  if (lead) console.log(`${lead.localName} | ${lead.email} | ${lead.id}`);
  else console.log("Not found");
  await p.$disconnect();
}
main();

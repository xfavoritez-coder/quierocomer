import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const leads = await p.lead.findMany({
    where: { OR: [
      { localName: { contains: "yume", mode: "insensitive" } },
      { email: { contains: "yume", mode: "insensitive" } },
    ]},
    orderBy: { createdAt: "desc" },
    select: { id: true, localName: true, cartaType: true, cartaUrl: true, cartaFileUrl: true, cartaStatus: true, errorLog: true, createdAt: true },
  });
  for (const l of leads) {
    console.log(`${l.localName} | ${l.cartaType} | ${l.cartaStatus} | ${l.errorLog || "ok"}`);
    console.log(`  URL: ${l.cartaUrl?.slice(0, 80) || "—"}`);
    console.log(`  File: ${l.cartaFileUrl?.slice(0, 80) || "—"}`);
    console.log(`  Created: ${l.createdAt.toISOString()}`);
    console.log();
  }
  await p.$disconnect();
}
main();

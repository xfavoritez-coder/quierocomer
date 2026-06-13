import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const leads = await p.lead.findMany({
    where: { generatedSlug: { not: null } },
    select: { localName: true, cartaUrl: true, cartaFileUrl: true, cartaType: true },
    take: 10,
    orderBy: { createdAt: "desc" },
  });
  for (const l of leads) {
    console.log(`${(l.localName || "?").padEnd(30)} | type: ${(l.cartaType || "?").padEnd(10)} | url: ${l.cartaUrl || "-"} | file: ${l.cartaFileUrl || "-"}`);
  }
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

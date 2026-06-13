import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const leads = await p.lead.findMany({
    where: { generatedSlug: { not: null }, OR: [{ cartaFileUrl: { not: null } }, { cartaUrl: { not: null } }] },
    select: { localName: true, cartaUrl: true, cartaFileUrl: true, cartaType: true },
  });
  for (const l of leads) {
    const url = l.cartaFileUrl || l.cartaUrl;
    if (!url) continue;
    if (url.startsWith("http")) {
      try {
        const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
        if (!res.ok) console.log(`BROKEN (${res.status}): ${(l.localName || "?").padEnd(25)} → ${url.slice(0, 80)}`);
      } catch (e: any) {
        console.log(`ERROR: ${(l.localName || "?").padEnd(25)} → ${url.slice(0, 80)} (${e.message})`);
      }
    }
  }
  console.log("Done");
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

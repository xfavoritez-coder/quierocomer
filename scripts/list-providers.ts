import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const providers = await prisma.menuProvider.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, domainPatterns: true, htmlSignatures: true, status: true, extractionConfig: true, notes: true, successCount: true, failCount: true, _count: { select: { leads: true } } },
  });
  console.log(`Total providers: ${providers.length}\n`);
  for (const p of providers) {
    const config = p.extractionConfig as any;
    console.log(`${p.name} [${p.status}] — ${p._count.leads} leads`);
    console.log(`  Domains: ${p.domainPatterns.join(", ")}`);
    if (p.htmlSignatures.length > 0) console.log(`  HTML signatures: ${p.htmlSignatures.join(", ")}`);
    if (config) console.log(`  Config: ${JSON.stringify(config)}`);
    console.log(`  Success: ${p.successCount} | Fail: ${p.failCount}`);
    if (p.notes) console.log(`  Notes: ${p.notes}`);
    console.log();
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());

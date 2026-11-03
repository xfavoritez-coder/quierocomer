import * as dotenv from "dotenv";
dotenv.config({ path: ".env.prod" });
import { prisma } from "../src/lib/prisma";

const SLUGS = ["nagisa-sushi-delivery", "el-rincon-de-las-brujas-pomaire"];

async function main() {
  for (const slug of SLUGS) {
    const lead = await prisma.lead.findFirst({
      where: { generatedSlug: slug },
      select: { id: true, panelVisitedAt: true },
    });
    if (!lead) { console.log(`${slug}: no lead found`); continue; }
    if (!lead.panelVisitedAt) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { panelVisitedAt: new Date() },
      });
      console.log(`${slug}: panelVisitedAt seteado`);
    } else {
      console.log(`${slug}: ya tenia panelVisitedAt (${lead.panelVisitedAt.toISOString()})`);
    }
  }
  await prisma.$disconnect();
}
main();

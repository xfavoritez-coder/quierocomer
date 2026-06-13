import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const lead = await p.lead.findFirst({ where: { ownerName: { contains: "aquiles", mode: "insensitive" } }, select: { id: true } });
  if (lead) {
    await p.lead.delete({ where: { id: lead.id } });
    console.log("Lead deleted:", lead.id);
  } else {
    console.log("Lead not found");
  }
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

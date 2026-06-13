import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  // Delete WA messages
  const msgs = await p.whatsAppMessage.deleteMany({ where: { phone: "+56982883779" } });
  console.log(`Deleted ${msgs.count} WA messages`);

  // Delete lead
  const lead = await p.lead.deleteMany({ where: { id: "cmpyhuq5t001nl504afbjvvhp" } });
  console.log(`Deleted ${lead.count} lead`);

  console.log("Done");
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

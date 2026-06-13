import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const rest = await p.restaurant.findFirst({ where: { name: { contains: "Fábrica", mode: "insensitive" } }, select: { id: true, name: true } });
  if (rest) {
    await p.panelActivity.create({ data: { restaurantId: rest.id, action: "nurturing_carta_no_revisada", details: { whatsapp: "+56996333410", manual: true } } });
    console.log("OK", rest.name);
  } else console.log("Not found");
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

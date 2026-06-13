import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const REMAINING = [
  { phone: "+56993502372", action: "nurturing_vio_no_activo" },
  { phone: "+56999333286", action: "nurturing_vio_no_activo" },
  { phone: "+56985845133", action: "nurturing_vio_no_activo" },
  { phone: "+56986231842", action: "nurturing_vio_no_activo" },
];

async function main() {
  for (const t of REMAINING) {
    const owner = await p.restaurantOwner.findFirst({
      where: { whatsapp: t.phone },
      select: { id: true, name: true, restaurants: { select: { id: true, name: true } } },
    });
    if (!owner?.restaurants[0]) { console.log(`SKIP ${t.phone}`); continue; }
    const rest = owner.restaurants[0];
    const already = await p.panelActivity.findFirst({ where: { restaurantId: rest.id, action: t.action }, select: { id: true } });
    if (already) { console.log(`SKIP ${rest.name} — already`); continue; }
    await p.panelActivity.create({
      data: { restaurantId: rest.id, action: t.action, details: { whatsapp: t.phone, ownerName: owner.name, restaurantName: rest.name, manual: true } },
    });
    console.log(`OK ${rest.name}`);
  }
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

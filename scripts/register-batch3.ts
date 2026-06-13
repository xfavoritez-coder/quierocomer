import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const TARGETS = [
  { phone: "+56996710189", action: "nurturing_no_volvio" },
  { phone: "+56982670252", action: "nurturing_no_volvio" },
  { phone: "+56968027830", action: "nurturing_vio_no_activo" },
  { phone: "+56999790424", action: "nurturing_no_volvio" },
  { phone: "+56933710034", action: "nurturing_no_volvio" },
  { phone: "+56996333410", action: "nurturing_carta_no_revisada" },
  { phone: "+56983119155", action: "nurturing_no_volvio" },
  { phone: "+56976323134", action: "nurturing_no_volvio" },
  { phone: "+56952433979", action: "nurturing_no_volvio" },
  { phone: "+56974653979", action: "nurturing_no_volvio" },
  { phone: "+56989891234", action: "nurturing_vio_no_activo" },
  { phone: "+56939201763", action: "nurturing_vio_no_activo" },
];
async function main() {
  let ok = 0;
  for (const t of TARGETS) {
    const owner = await p.restaurantOwner.findFirst({ where: { whatsapp: t.phone }, select: { name: true, restaurants: { select: { id: true, name: true } } } });
    if (!owner?.restaurants[0]) { console.log(`SKIP ${t.phone}`); continue; }
    const rest = owner.restaurants[0];
    await p.panelActivity.create({ data: { restaurantId: rest.id, action: t.action, details: { whatsapp: t.phone, ownerName: owner.name, restaurantName: rest.name, manual: true } } });
    console.log(`OK ${rest.name}`);
    ok++;
  }
  console.log(`\nRegistered: ${ok}`);
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

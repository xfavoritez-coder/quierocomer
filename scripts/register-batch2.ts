import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const TARGETS = [
  { phone: "+56940654742", action: "nurturing_vio_no_activo" },
  { phone: "+56996309579", action: "nurturing_vio_no_activo" },
  { phone: "+56933331189", action: "nurturing_no_volvio" },
  { phone: "+56998410759", action: "nurturing_vio_no_activo" },
  { phone: "+56989464703", action: "nurturing_no_volvio" },
  { phone: "+56959323734", action: "nurturing_vio_no_activo" },
  { phone: "+56982403093", action: "nurturing_vio_no_activo" },
  { phone: "+56966369589", action: "nurturing_no_volvio" },
  { phone: "+56951473257", action: "nurturing_no_volvio" },
  { phone: "+56997469594", action: "nurturing_vio_no_activo" },
  { phone: "+56984150995", action: "nurturing_vio_no_activo" },
  { phone: "+56944241930", action: "nurturing_vio_no_activo" },
  { phone: "+56940475435", action: "nurturing_no_volvio" },
  { phone: "+56930800921", action: "nurturing_vio_no_activo" },
  { phone: "+56984095639", action: "nurturing_vio_no_activo" },
  { phone: "+56997093547", action: "nurturing_vio_no_activo" },
  { phone: "+56994029494", action: "nurturing_vio_no_activo" },
  { phone: "+56992920928", action: "nurturing_vio_no_activo" },
  { phone: "+56987952009", action: "nurturing_vio_no_activo" },
  { phone: "+56959028621", action: "nurturing_no_volvio" },
];

async function main() {
  let ok = 0;
  for (const t of TARGETS) {
    const owner = await p.restaurantOwner.findFirst({ where: { whatsapp: t.phone }, select: { id: true, name: true, restaurants: { select: { id: true, name: true } } } });
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

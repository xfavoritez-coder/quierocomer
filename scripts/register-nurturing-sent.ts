import { PrismaClient } from "@prisma/client";
import { computeLifecycleStage, OWNER_ACTIONS } from "../src/lib/admin/lifecycle";

const p = new PrismaClient();

const TARGETS: { phone: string; action: string }[] = [
  { phone: "+56954085483", action: "nurturing_vio_no_activo" },
  { phone: "+56928254931", action: "nurturing_vio_no_activo" },
  { phone: "+56979226775", action: "nurturing_vio_no_activo" },
  { phone: "+56962630150", action: "nurturing_vio_no_activo" },
  { phone: "+56977977216", action: "nurturing_vio_no_activo" },
  { phone: "+56931987171", action: "nurturing_vio_no_activo" },
  { phone: "+56935883244", action: "nurturing_vio_no_activo" },
  { phone: "+56992190784", action: "nurturing_vio_no_activo" },
  { phone: "+56965720471", action: "nurturing_vio_no_activo" },
  { phone: "+56966755571", action: "nurturing_vio_no_activo" },
  { phone: "+56973046443", action: "nurturing_no_volvio" },
  { phone: "+56950463340", action: "nurturing_no_volvio" },
  { phone: "+56930350448", action: "nurturing_vio_no_activo" },
  { phone: "+56954036360", action: "nurturing_vio_no_activo" },
  { phone: "+56929966404", action: "nurturing_vio_no_activo" },
  { phone: "+56940959137", action: "nurturing_vio_no_activo" },
  { phone: "+56993502372", action: "nurturing_vio_no_activo" },
  { phone: "+56999333286", action: "nurturing_vio_no_activo" },
  { phone: "+56985845133", action: "nurturing_vio_no_activo" },
  { phone: "+56986231842", action: "nurturing_vio_no_activo" },
];

async function main() {
  let registered = 0;
  for (const t of TARGETS) {
    const owner = await p.restaurantOwner.findFirst({
      where: { whatsapp: t.phone },
      select: { id: true, name: true, restaurants: { select: { id: true, name: true } } },
    });
    if (!owner || !owner.restaurants[0]) {
      console.log(`SKIP ${t.phone} — no owner/restaurant found`);
      continue;
    }
    const rest = owner.restaurants[0];
    const already = await p.panelActivity.findFirst({
      where: { restaurantId: rest.id, action: t.action },
      select: { id: true },
    });
    if (already) {
      console.log(`SKIP ${rest.name} — ${t.action} already registered`);
      continue;
    }
    await p.panelActivity.create({
      data: {
        restaurantId: rest.id,
        action: t.action,
        details: { whatsapp: t.phone, ownerName: owner.name, restaurantName: rest.name, manual: true, registeredAfterSend: true },
      },
    });
    console.log(`OK ${rest.name} — ${t.action} registered`);
    registered++;
  }
  console.log(`\nDone: ${registered} registered`);
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

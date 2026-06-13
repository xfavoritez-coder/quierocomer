import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const [leads, restaurants, owners] = await Promise.all([
    p.lead.count(),
    p.restaurant.count(),
    p.restaurantOwner.count(),
  ]);
  const demos = await p.restaurant.count({ where: { isDemo: true } });
  const activos = await p.restaurant.count({ where: { isDemo: false } });
  const conOwner = await p.restaurant.count({ where: { ownerId: { not: null } } });
  const sinOwner = await p.restaurant.count({ where: { ownerId: null } });

  console.log("=== TOTALES ===");
  console.log(`Leads:          ${leads}`);
  console.log(`Restaurants:    ${restaurants} (${demos} demo, ${activos} activados)`);
  console.log(`Owners:         ${owners}`);
  console.log(`Con owner:      ${conOwner}`);
  console.log(`Sin owner:      ${sinOwner}`);
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

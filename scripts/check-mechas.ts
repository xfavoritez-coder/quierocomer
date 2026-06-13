import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const rest = await p.restaurant.findFirst({
    where: { name: { contains: "mechas", mode: "insensitive" } },
    select: { id: true, name: true, slug: true, owner: { select: { name: true, email: true, whatsapp: true } } },
  });
  console.log("Restaurant:", JSON.stringify(rest, null, 2));
  
  if (rest) {
    const activities = await p.panelActivity.findMany({
      where: { restaurantId: rest.id, action: { contains: "import" } },
      select: { action: true, details: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    console.log("Import activities:", JSON.stringify(activities, null, 2));
  }
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

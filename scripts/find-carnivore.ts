import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const guests = await p.guestProfile.findMany({
    where: { preferences: { not: undefined } },
    select: { id: true, preferences: true },
    orderBy: { lastSeenAt: "desc" },
    take: 20,
  });
  for (const g of guests) {
    const prefs = g.preferences as any;
    if (prefs?.dietType) {
      console.log(`${g.id.slice(0, 12)} | diet=${prefs.dietType} | res=${JSON.stringify(prefs.restrictions || [])}`);
    }
  }
  await p.$disconnect();
}
main();

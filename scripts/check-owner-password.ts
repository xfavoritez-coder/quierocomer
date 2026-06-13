import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const owner = await db.restaurantOwner.findUnique({
    where: { email: "favoritez@gmail.com" },
    select: { id: true, email: true, passwordHash: true, mustChangePassword: true, restaurants: { select: { id: true, slug: true, name: true } } },
  });
  console.log("Owner:", JSON.stringify(owner, null, 2));
}

main().catch(console.error).finally(() => db.$disconnect());

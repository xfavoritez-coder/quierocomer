import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const restaurantId = "cmpmkozub0000l504pod0da21";

  const resto = await db.restaurant.findUnique({
    where: { id: restaurantId },
    include: { owner: true },
  });

  if (resto?.owner) {
    await db.restaurantOwner.update({
      where: { id: resto.owner.id },
      data: {
        name: "Jaime",
        email: "favoritez@gmail.com",
        whatsapp: "+56999946208",
      },
    });
    console.log("✓ Owner actualizado:", resto.owner.id);
  } else {
    console.log("No hay owner, ownerId:", resto?.ownerId);
  }

  const final = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { name: true, slug: true, isDemo: true, plan: true, subscriptionStatus: true, trialEndsAt: true, owner: { select: { name: true, email: true, whatsapp: true } } },
  });
  console.log("\n== Estado final ==");
  console.log(JSON.stringify(final, null, 2));
}

main().catch(console.error).finally(() => db.$disconnect());

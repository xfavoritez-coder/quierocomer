import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const restaurantId = "cmpmkozub0000l504pod0da21";

  // Find owner with favoritez@gmail.com
  const existingOwner = await db.restaurantOwner.findUnique({
    where: { email: "favoritez@gmail.com" },
    select: { id: true, name: true, email: true, whatsapp: true, restaurants: { select: { id: true, name: true, slug: true } } },
  });
  console.log("Owner existente:", JSON.stringify(existingOwner, null, 2));

  if (existingOwner) {
    // Update owner data
    await db.restaurantOwner.update({
      where: { id: existingOwner.id },
      data: { name: "Jaime", whatsapp: "+56999946208" },
    });

    // Reassign restaurant to this owner
    await db.restaurant.update({
      where: { id: restaurantId },
      data: { ownerId: existingOwner.id },
    });
    console.log("✓ Restaurante reasignado a owner:", existingOwner.id);
  }

  const final = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { name: true, slug: true, isDemo: true, plan: true, subscriptionStatus: true, trialEndsAt: true, owner: { select: { name: true, email: true, whatsapp: true } } },
  });
  console.log("\n== Estado final ==");
  console.log(JSON.stringify(final, null, 2));
}

main().catch(console.error).finally(() => db.$disconnect());

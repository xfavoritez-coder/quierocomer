import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const leadId = "cmpmkm1pa0000jo04idfutghw";
  const restaurantId = "cmpmkozub0000l504pod0da21";

  // 1. Update lead
  const lead = await db.lead.update({
    where: { id: leadId },
    data: {
      email: "favoritez@gmail.com",
      whatsapp: "+56999946208",
      ownerName: "Jaime",
      activated: false,
      activatedAt: null,
      panelVisitedAt: null,
      onboardingDoneAt: null,
      events: [],
    },
  });
  console.log("✓ Lead actualizado:", lead.email, lead.ownerName);

  // 2. Update restaurant
  const resto = await db.restaurant.update({
    where: { id: restaurantId },
    data: {
      name: "Fogón del Puerto",
      slug: "fogon-del-puerto",
      isDemo: true,
      subscriptionStatus: "NONE",
      plan: "PREMIUM",
      trialEndsAt: null,
      trialReminderSentAt: null,
    },
  });
  console.log("✓ Restaurante:", resto.name, "slug:", resto.slug, "isDemo:", resto.isDemo);

  // 3. Update lead slug
  await db.lead.update({
    where: { id: leadId },
    data: { generatedSlug: "fogon-del-puerto" },
  });
  console.log("✓ Lead slug actualizado a fogon-del-puerto");

  // 4. Update owner if exists
  const owner = await db.restaurantOwner.findFirst({
    where: { restaurantId },
  });
  if (owner) {
    await db.restaurantOwner.update({
      where: { id: owner.id },
      data: {
        name: "Jaime",
        email: "favoritez@gmail.com",
        whatsapp: "+56999946208",
      },
    });
    console.log("✓ Owner actualizado:", owner.id);
  }

  // 5. Show current state
  const finalResto = await db.restaurant.findUnique({
    where: { id: restaurantId },
    select: { name: true, slug: true, isDemo: true, plan: true, subscriptionStatus: true, trialEndsAt: true },
  });
  console.log("\n== Estado actual ==");
  console.log(JSON.stringify(finalResto, null, 2));
  console.log("\nURL carta: /qr/fogon-del-puerto");
  console.log("URL activación: /activar/fogon-del-puerto");
}

main().catch(console.error).finally(() => db.$disconnect());

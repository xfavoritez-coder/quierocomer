import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const lead = await p.lead.findFirst({
    where: { localName: { contains: "parada", mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  });
  if (!lead) { console.log("Not found"); await p.$disconnect(); return; }

  // Fix email: saldiva → saldivia
  const oldEmail = lead.email;
  const newEmail = "camilosaldivia.c@gmail.com";
  console.log(`Email: ${oldEmail} → ${newEmail}`);

  await p.lead.update({
    where: { id: lead.id },
    data: { email: newEmail, emailBouncedAt: null },
  });

  // Also fix on RestaurantOwner if exists
  if (lead.generatedSlug) {
    const owner = await p.restaurantOwner.findFirst({ where: { email: oldEmail } });
    if (owner) {
      await p.restaurantOwner.update({
        where: { id: owner.id },
        data: { email: newEmail },
      });
      console.log("Updated RestaurantOwner email too");
    }
  }

  console.log("Done. Now retrigger email delivery.");
  await p.$disconnect();
}
main();

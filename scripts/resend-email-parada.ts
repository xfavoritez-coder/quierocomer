import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { sendAdminEmail } from "../src/lib/email/sendAdminEmail";
import { cartaReadyEmailHtml } from "../src/lib/email/cartaReadyEmailHtml";

async function main() {
  const p = new PrismaClient();
  const lead = await p.lead.findFirst({
    where: { localName: { contains: "parada", mode: "insensitive" } },
    include: { detectedProvider: true },
    orderBy: { createdAt: "desc" },
  });
  if (!lead || !lead.generatedSlug) { console.log("Lead not found or no slug"); await p.$disconnect(); return; }

  const rest = await p.restaurant.findFirst({ where: { slug: lead.generatedSlug } });
  if (!rest) { console.log("Restaurant not found"); await p.$disconnect(); return; }

  const dishCount = await p.dish.count({ where: { restaurantId: rest.id } });
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
  const openPixel = `${baseUrl}/api/funnel/track/open?lid=${lead.id}`;
  const clickUrl = `${baseUrl}/api/funnel/track/click?lid=${lead.id}&url=${encodeURIComponent(`${baseUrl}/qr/${rest.slug}`)}`;
  const activarUrl = `${baseUrl}/activar/${rest.slug}`;
  const panelUrl = `${baseUrl}/api/panel/demo-auth?slug=${rest.slug}`;

  console.log(`Sending to: ${lead.email}`);
  console.log(`Restaurant: ${rest.name} (${rest.slug})`);
  console.log(`Dishes: ${dishCount}`);

  await sendAdminEmail({
    to: lead.email,
    subject: `Tu nueva carta ${rest.name} está lista`,
    purpose: "funnel_carta_ready",
    html: cartaReadyEmailHtml({
      ownerName: lead.ownerName || "Hola",
      restaurantName: rest.name,
      logoUrl: rest.logoUrl,
      dishCount,
      clickUrl,
      openPixel,
      activarUrl,
      panelUrl,
    }),
  });

  await p.lead.update({
    where: { id: lead.id },
    data: { deliveredAt: new Date() },
  });

  console.log("Email sent and deliveredAt updated.");
  await p.$disconnect();
}
main();

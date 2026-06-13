import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  const lead = await p.lead.findFirst({
    where: { localName: { contains: "forty", mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  });

  if (!lead) { console.log("No lead found"); await p.$disconnect(); return; }

  console.log("Lead:", lead.localName, "| Status:", lead.cartaStatus, "| Email:", lead.email);
  console.log("Slug:", lead.generatedSlug, "| Error:", lead.errorLog);

  if (!lead.generatedSlug) { console.log("No slug — cannot send email"); await p.$disconnect(); return; }

  const rest = await p.restaurant.findFirst({
    where: { slug: lead.generatedSlug },
    select: { id: true, name: true, slug: true },
  });

  if (!rest) { console.log("Restaurant not found"); await p.$disconnect(); return; }

  const dishCount = await p.dish.count({ where: { restaurantId: rest.id } });
  const catCount = await p.category.count({ where: { restaurantId: rest.id } });

  console.log(`Restaurant: ${rest.name} | ${dishCount} platos, ${catCount} categorías`);

  // Send email
  const { sendAdminEmail, cartaListaSimpleEmailHtml } = await import("../src/lib/email/sendAdminEmail");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
  const openPixel = `${baseUrl}/api/funnel/track/open?lid=${lead.id}`;
  const clickUrl = `${baseUrl}/api/funnel/track/click?lid=${lead.id}&url=${encodeURIComponent(`${baseUrl}/qr/${rest.slug}`)}`;
  const ownerName = (lead.ownerName || "Hola").split(" ")[0];

  console.log(`Sending email to ${lead.email}...`);
  await sendAdminEmail({
    to: lead.email!,
    subject: `${ownerName}, tu carta está lista`,
    html: cartaListaSimpleEmailHtml({
      ownerName,
      restaurantName: rest.name,
      cartaUrl: clickUrl,
      openPixel,
      dishCount,
      categoryCount: catCount,
      logoUrl: null,
    }),
    purpose: "funnel_carta_lista",
  });

  // Update lead status
  await p.lead.update({
    where: { id: lead.id },
    data: { cartaStatus: "DELIVERED", deliveredAt: new Date(), errorLog: null },
  });

  console.log("Done! Email sent and lead marked as DELIVERED.");
  await p.$disconnect();
}

main().catch(console.error);

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const leadId = "cmpvf052m00d2l7044j7eokus";
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) { console.log("Lead not found"); return; }

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: "terraza-alameda" },
    select: { id: true, name: true, slug: true, logoUrl: true, qrToken: true },
  });
  if (!restaurant) { console.log("Restaurant not found"); return; }

  const dishCount = await prisma.dish.count({ where: { restaurantId: restaurant.id, isActive: true } });
  const catCount = await prisma.category.count({ where: { restaurantId: restaurant.id, isActive: true } });

  console.log(`Restaurant: ${restaurant.name}, ${dishCount} dishes, ${catCount} categories`);

  const baseUrl = "https://quierocomer.com";
  const ownerName = (lead.ownerName || "Hola").split(" ")[0];

  // Send email
  if (lead.email) {
    const { sendAdminEmail, cartaListaSimpleEmailHtml } = await import("../src/lib/email/sendAdminEmail");
    const openPixel = `${baseUrl}/api/funnel/track/open?lid=${leadId}`;
    const clickUrl = `${baseUrl}/api/funnel/track/click?lid=${leadId}&url=${encodeURIComponent(`${baseUrl}/qr/${restaurant.slug}`)}`;

    await sendAdminEmail({
      to: lead.email,
      subject: `${ownerName}, tu carta está lista`,
      html: cartaListaSimpleEmailHtml({ ownerName, restaurantName: restaurant.name, cartaUrl: clickUrl, openPixel, dishCount, categoryCount: catCount, logoUrl: restaurant.logoUrl }),
      purpose: "funnel_carta_lista",
    });
    console.log(`Email sent to ${lead.email}`);
  }

  // Send WhatsApp
  if (lead.whatsapp) {
    const { sendWhatsApp, buildCartaReadyMessage } = await import("../src/lib/whatsapp");
    const waTrackUrl = `${baseUrl}/c/${restaurant.slug}`;
    const msg = buildCartaReadyMessage({ ownerName, restaurantName: restaurant.name, trackUrl: waTrackUrl });
    const sid = await sendWhatsApp({ to: lead.whatsapp, ...msg });
    if (sid) {
      console.log(`WhatsApp sent to ${lead.whatsapp} (SID: ${sid})`);
    } else {
      console.log("WhatsApp send returned no SID");
    }
  }

  // Update lead status
  await prisma.lead.update({
    where: { id: leadId },
    data: { cartaStatus: "DELIVERED", deliveredAt: new Date(), whatsappSentAt: lead.whatsapp ? new Date() : undefined },
  });
  console.log("Lead updated to DELIVERED");
}

main().catch(console.error).finally(() => prisma.$disconnect());

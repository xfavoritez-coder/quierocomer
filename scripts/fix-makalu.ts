import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { processLead } from "../src/lib/extractors/pipeline";
import { sendAdminEmail } from "../src/lib/email/sendAdminEmail";
import { cartaReadyEmailHtml } from "../src/lib/email/cartaReadyEmailHtml";

async function main() {
  const p = new PrismaClient();

  // 1. Force Jina for the Pubmakalu provider
  const provider = await p.menuProvider.findFirst({ where: { name: { contains: "Pubmakalu", mode: "insensitive" } } });
  if (provider) {
    await p.menuProvider.update({
      where: { id: provider.id },
      data: { extractionConfig: { useJina: true, maxContentChars: 60000 } },
    });
    console.log("✓ Provider updated: useJina=true, maxContentChars=60000");
  }

  // 2. Check lead current state
  const lead = await p.lead.findFirst({
    where: { localName: { contains: "makalu", mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  });
  if (!lead) { console.log("Lead not found"); await p.$disconnect(); return; }

  console.log(`Lead: ${lead.localName} (${lead.id})`);
  console.log(`Status: ${lead.cartaStatus}`);

  // Reset if not already PENDING
  if (lead.cartaStatus !== "PENDING") {
    await p.lead.update({
      where: { id: lead.id },
      data: {
        cartaStatus: "PENDING",
        errorLog: null,
        generatedSlug: null,
        preview: null as any,
        deliveredAt: null,
        emailOpenedAt: null,
        emailClickedAt: null,
        onboardingDoneAt: null,
        panelVisitedAt: null,
        activarVisitedAt: null,
        activatedAt: null,
        activated: false,
        whatsappSentAt: null,
        events: (lead.events as any[]).filter((e: any) =>
          ["paso1_completed", "paso2_loaded", "paso2_completed"].includes(e.action)
        ) as any,
      },
    });
    console.log("✓ Lead reset to PENDING");
  }

  // 3. Process lead directly
  console.log("\nProcessing lead...");
  try {
    const result = await processLead(lead.id);
    console.log(`\n✓ Restaurant created: ${result.slug}`);
    console.log(`  URL: ${result.url}`);
  } catch (err: any) {
    console.error("\n✗ Processing failed:", err.message);
    await p.$disconnect();
    return;
  }

  // 4. Re-fetch lead to get updated data
  const updatedLead = await p.lead.findUnique({ where: { id: lead.id } });
  if (!updatedLead?.generatedSlug) {
    console.log("No slug generated — skipping email/WA");
    await p.$disconnect();
    return;
  }

  const rest = await p.restaurant.findFirst({ where: { slug: updatedLead.generatedSlug } });
  if (!rest) {
    console.log("Restaurant not found");
    await p.$disconnect();
    return;
  }

  const dishCount = await p.dish.count({ where: { restaurantId: rest.id } });
  console.log(`\nRestaurant: ${rest.name} | ${dishCount} dishes | demo: ${rest.isDemo}`);

  // 5. Reset lead tracking again (processLead may have set deliveredAt etc.)
  await p.lead.update({
    where: { id: lead.id },
    data: {
      deliveredAt: null,
      emailOpenedAt: null,
      emailClickedAt: null,
      onboardingDoneAt: null,
      panelVisitedAt: null,
      activarVisitedAt: null,
      activatedAt: null,
      activated: false,
      whatsappSentAt: null,
    },
  });
  console.log("✓ Lead tracking data reset");

  // 6. Send carta ready email
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
  const openPixel = `${baseUrl}/api/funnel/track/open?lid=${lead.id}`;
  const clickUrl = `${baseUrl}/api/funnel/track/click?lid=${lead.id}&url=${encodeURIComponent(`${baseUrl}/qr/${rest.slug}`)}`;
  const activarUrl = `${baseUrl}/activar/${rest.slug}`;
  const panelUrl = `${baseUrl}/api/panel/demo-auth?slug=${rest.slug}`;

  await sendAdminEmail({
    to: updatedLead.email,
    subject: `Tu carta ${rest.name} está lista`,
    purpose: "funnel_carta_ready",
    html: cartaReadyEmailHtml({
      ownerName: updatedLead.ownerName || "Hola",
      restaurantName: rest.name,
      logoUrl: rest.logoUrl,
      dishCount,
      clickUrl,
      openPixel,
      activarUrl,
      panelUrl,
    }),
  });
  await p.lead.update({ where: { id: lead.id }, data: { deliveredAt: new Date() } });
  console.log(`✓ Email sent to ${updatedLead.email}`);

  // 7. Send WhatsApp
  if (updatedLead.whatsapp) {
    try {
      const { sendWhatsApp, buildCartaReadyMessage } = await import("../src/lib/whatsapp");
      const waTrackUrl = `${baseUrl}/c/${rest.slug}`;
      const ownerName = (updatedLead.ownerName || "Hola").split(" ")[0];
      const msg = buildCartaReadyMessage({
        ownerName,
        restaurantName: rest.name,
        trackUrl: waTrackUrl,
      });
      const sid = await sendWhatsApp({ to: updatedLead.whatsapp, ...msg });
      if (sid) {
        await p.lead.update({ where: { id: lead.id }, data: { whatsappSentAt: new Date() } });
        console.log(`✓ WhatsApp sent to ${updatedLead.whatsapp}`);
      }
    } catch (waErr: any) {
      console.error("WhatsApp failed:", waErr.message);
    }
  }

  console.log("\n✓ Done! Restaurant in demo mode, email & WA sent, tracking reset.");
  await p.$disconnect();
}
main().catch(console.error);

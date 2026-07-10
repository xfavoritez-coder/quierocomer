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

  console.log("Lead:", lead.localName, "| WhatsApp:", lead.whatsapp);
  console.log("Slug:", lead.generatedSlug);

  if (!lead.whatsapp) { console.log("No WhatsApp number — skipping"); await p.$disconnect(); return; }
  if (!lead.generatedSlug) { console.log("No slug"); await p.$disconnect(); return; }

  const rest = await p.restaurant.findFirst({
    where: { slug: lead.generatedSlug },
    select: { name: true, slug: true },
  });

  if (!rest) { console.log("Restaurant not found"); await p.$disconnect(); return; }

  const { sendWhatsApp, buildCartaReadyMessage } = await import("../src/lib/whatsapp");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";
  const waTrackUrl = `${baseUrl}/c/${rest.slug}`;
  const ownerName = (lead.ownerName || "Hola").split(" ")[0];

  const msg = buildCartaReadyMessage({ ownerName, restaurantName: rest.name, trackUrl: waTrackUrl });

  console.log(`Sending WhatsApp to ${lead.whatsapp}...`);
  const sid = await sendWhatsApp({ to: lead.whatsapp, ...msg });

  if (sid) {
    await p.lead.update({ where: { id: lead.id }, data: { whatsappSentAt: new Date() } });
    console.log(`Done! WhatsApp sent (SID: ${sid})`);
  } else {
    console.log("WhatsApp send returned no SID");
  }

  await p.$disconnect();
}

main().catch(console.error);

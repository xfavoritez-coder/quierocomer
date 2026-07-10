import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  // Find leads: email delivered, never opened, have whatsapp, no WA sent yet
  const leads = await p.lead.findMany({
    where: {
      deliveredAt: { not: null },
      emailOpenedAt: null,
      whatsapp: { not: null },
      whatsappSentAt: null,
      cartaStatus: { in: ["DELIVERED", "READY"] },
    },
    select: { id: true, localName: true, ownerName: true, whatsapp: true, generatedSlug: true, email: true },
  });

  console.log(`Found ${leads.length} leads with unopened emails and WhatsApp:`);
  for (const l of leads) {
    console.log(`  ${l.localName} | ${l.ownerName} | ${l.whatsapp} | slug: ${l.generatedSlug}`);
  }

  if (leads.length === 0) { await p.$disconnect(); return; }

  const SID = process.env.TWILIO_ACCOUNT_SID!;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN!;
  const FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
  const TEMPLATE = "HX73cbf24831adf5448d0e4eef6cb84f41";
  const baseUrl = "https://quierocomer.com";

  let sent = 0;
  for (const l of leads) {
    if (!l.whatsapp || !l.generatedSlug) continue;
    const ownerName = (l.ownerName || "Hola").split(" ")[0];
    const trackUrl = `${baseUrl}/api/funnel/track/wa-click?lid=${l.id}&url=${encodeURIComponent(`${baseUrl}/qr/${l.generatedSlug}`)}`;

    try {
      const rest = await p.restaurant.findFirst({ where: { slug: l.generatedSlug }, select: { name: true } });
      const restaurantName = rest?.name || l.localName || "tu local";

      const params = new URLSearchParams({
        From: FROM,
        To: `whatsapp:${l.whatsapp.startsWith("+") ? l.whatsapp : "+" + l.whatsapp}`,
        ContentSid: TEMPLATE,
        ContentVariables: JSON.stringify({ "1": ownerName, "2": restaurantName, "3": trackUrl }),
      });

      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
        method: "POST",
        headers: {
          "Authorization": "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });

      const data = await res.json();
      if (res.status === 201 && data.sid) {
        await p.lead.update({ where: { id: l.id }, data: { whatsappSentAt: new Date() } });
        sent++;
        console.log(`  ✓ Sent to ${l.localName} (${l.whatsapp}) — SID: ${data.sid}`);
      } else {
        console.log(`  ✗ Failed ${l.localName}: ${data.error_message || data.message || res.status}`);
      }
    } catch (e) {
      console.log(`  ✗ Error ${l.localName}: ${(e as Error).message}`);
    }
  }

  console.log(`\nDone. Sent ${sent}/${leads.length} WhatsApp messages.`);
  await p.$disconnect();
}
main();

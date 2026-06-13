import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const SID = process.env.TWILIO_ACCOUNT_SID!;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN!;
  const FROM = (process.env.TWILIO_WHATSAPP_FROM || "").replace("whatsapp:", "");

  console.log("Fetching Twilio message history...");

  let url = `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json?PageSize=200`;
  let imported = 0;
  let skipped = 0;

  while (url) {
    const res = await fetch(url, {
      headers: { "Authorization": "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64") },
    });
    const data = await res.json();

    for (const msg of (data.messages || [])) {
      // Only WhatsApp messages
      if (!msg.from?.includes("whatsapp:") && !msg.to?.includes("whatsapp:")) continue;

      const isOutbound = msg.from?.includes(FROM);
      const phone = isOutbound
        ? msg.to?.replace("whatsapp:", "")
        : msg.from?.replace("whatsapp:", "");

      if (!phone) continue;

      // Check if already exists
      if (msg.sid) {
        const existing = await p.$queryRaw`SELECT id FROM "WhatsAppMessage" WHERE "twilioSid" = ${msg.sid} LIMIT 1`.catch(() => []) as any[];
        if (existing.length > 0) { skipped++; continue; }
      }

      // Find linked lead
      const lead = await p.lead.findFirst({
        where: { whatsapp: { contains: phone.replace("+", "") } },
        orderBy: { createdAt: "desc" },
        select: { id: true, generatedSlug: true },
      }).catch(() => null);

      let restaurantId: string | undefined;
      if (lead?.generatedSlug) {
        const rest = await p.restaurant.findFirst({
          where: { slug: lead.generatedSlug },
          select: { id: true },
        }).catch(() => null);
        if (rest) restaurantId = rest.id;
      }

      const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await p.$executeRaw`INSERT INTO "WhatsAppMessage" (id, phone, direction, body, "leadId", "restaurantId", "twilioSid", "profileName", status, "createdAt") VALUES (${id}, ${phone}, ${isOutbound ? "OUTBOUND" : "INBOUND"}::"WhatsAppDirection", ${msg.body || ""}, ${lead?.id || null}, ${restaurantId || null}, ${msg.sid}, ${null}, ${msg.status || "sent"}, ${new Date(msg.date_created)})`.catch((e: any) => console.log("  Skip:", e.message?.slice(0, 60)));
      imported++;
    }

    // Next page
    url = data.next_page_uri ? `https://api.twilio.com${data.next_page_uri}` : "";
  }

  console.log(`Imported: ${imported}, Skipped (duplicates): ${skipped}`);
  await p.$disconnect();
}
main();

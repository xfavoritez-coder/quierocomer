import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const l = await p.lead.findFirst({ where: { localName: { contains: "cholito", mode: "insensitive" } }, select: { id: true, whatsapp: true, ownerName: true, generatedSlug: true } });
  if (!l || !l.whatsapp) { console.log("Not found"); await p.$disconnect(); return; }

  const SID = process.env.TWILIO_ACCOUNT_SID!;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN!;
  const FROM = process.env.TWILIO_WHATSAPP_FROM!;
  const trackUrl = `https://quierocomer.com/api/funnel/track/wa-click?lid=${l.id}&url=${encodeURIComponent(`https://quierocomer.com/qr/${l.generatedSlug}`)}`;

  const params = new URLSearchParams({
    From: FROM, To: `whatsapp:${l.whatsapp}`,
    ContentSid: "HX73cbf24831adf5448d0e4eef6cb84f41",
    ContentVariables: JSON.stringify({ "1": (l.ownerName || "Hola").split(" ")[0], "2": "Cholitos", "3": trackUrl }),
  });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
    method: "POST",
    headers: { "Authorization": "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = await res.json();
  if (data.sid) {
    await p.lead.update({ where: { id: l.id }, data: { whatsappSentAt: new Date() } });
    console.log(`Sent to ${l.whatsapp}! SID: ${data.sid}`);
  } else {
    console.log(`Failed: ${data.error_message || data.message}`);
  }
  await p.$disconnect();
}
main();

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const lead = await p.lead.findFirst({ where: { localName: { contains: "viceverza", mode: "insensitive" } }, select: { id: true, whatsapp: true } });
  if (!lead || !lead.whatsapp) { console.log("Not found"); await p.$disconnect(); return; }

  const SID = process.env.TWILIO_ACCOUNT_SID!;
  const TOKEN = process.env.TWILIO_AUTH_TOKEN!;
  const FROM = process.env.TWILIO_WHATSAPP_FROM!;

  const body = "Hola Enrique, no pudimos extraer tu carta desde el link que nos compartiste. ¿Podrías subir una foto de tu carta o el PDF directamente? Puedes hacerlo aquí: quierocomer.cl/subircarta 😊";

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: FROM,
      To: `whatsapp:${lead.whatsapp.startsWith("+") ? lead.whatsapp : "+" + lead.whatsapp}`,
      Body: body,
    }),
  });
  const data = await res.json();
  if (data.sid) {
    await p.lead.update({ where: { id: lead.id }, data: { whatsappSentAt: new Date() } });
    console.log("Sent! SID:", data.sid);
  } else {
    console.log("Failed:", data.error_message || data.message);
  }
  await p.$disconnect();
}
main();

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config({ path: ".env.local" });

const p = new PrismaClient();

async function main() {
  // Aloha doesn't have Twilio creds locally, need to check
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from) {
    console.log("No Twilio credentials in .env.local — cannot send locally");
    console.log("Use the production endpoint instead:");
    console.log("https://quierocomer.cl/api/cron/nurturing?key=qr-seed-2024-secreto&test=%2B56934343410&scenario=no_volvio");
    await p.$disconnect();
    return;
  }

  const { sendWhatsApp } = await import("../src/lib/whatsapp");

  const phone = "+56934343410";
  const ownerName = "Vaithiare";
  const restaurantName = "Aloha";
  const templateSid = "HXe8201d69e53b2c6c4c2af79470c34845"; // no_volvio

  const sid = await sendWhatsApp({
    to: phone,
    body: "",
    contentSid: templateSid,
    contentVariables: { "1": ownerName, "2": restaurantName },
  });

  if (sid) {
    console.log("Enviado! SID:", sid);

    // Save to WhatsAppMessage
    const rest = await p.restaurant.findFirst({ where: { slug: "aloha" }, select: { id: true } });
    const lead = await p.lead.findFirst({ where: { generatedSlug: "aloha" }, select: { id: true } });

    await p.whatsAppMessage.create({
      data: {
        phone,
        direction: "OUTBOUND",
        body: `Hola ${ownerName}, vi que revisaste la carta de ${restaurantName}. ¿Necesitas ayuda para activar tu local? — Camila de QuieroComer`,
        twilioSid: sid,
        status: "sent",
        restaurantId: rest?.id || null,
        leadId: lead?.id || null,
      },
    });
    console.log("WhatsAppMessage creado");

    // Track in PanelActivity
    if (rest) {
      await p.panelActivity.create({
        data: {
          restaurantId: rest.id,
          action: "nurturing_vio_no_activo",
          details: { sid, whatsapp: phone, ownerName, restaurantName },
        },
      });
      console.log("PanelActivity creado");
    }
  } else {
    console.log("Fallo el envio (sid null)");
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });

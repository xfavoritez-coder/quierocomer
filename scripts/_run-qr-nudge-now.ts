import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY!);
const BASE_URL = "https://quierocomer.com";
const GOLD = "#c8870a";
const FROM = "QuieroComer <hola@quierocomer.cl>";

function qrNudgeEmailHtml({ ownerName, restaurantName, slug, openPixel, clickTrackUrl }: {
  ownerName: string; restaurantName: string; slug: string; openPixel?: string; clickTrackUrl?: string;
}): string {
  const qrLink = `${BASE_URL}/qr/${slug}`;
  const qrGenerarLink = `${BASE_URL}/qr/generar/${slug}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrLink)}&color=1a1a1a&bgcolor=fffaf1&qzone=2`;
  const firstName = ownerName.split(" ")[0];
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fbf6ec;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;-webkit-text-size-adjust:100%;">
${openPixel ? `<img src="${openPixel}" alt="" width="1" height="1" style="display:none" />` : ""}
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fbf6ec;">
<tr><td align="center" style="padding:40px 16px 32px;">
<table width="460" cellpadding="0" cellspacing="0" border="0" style="max-width:460px;width:100%;">
  <tr><td align="center" style="padding-bottom:28px;">
    <a href="${BASE_URL}" style="text-decoration:none;">
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;padding-right:5px;"><img src="${BASE_URL}/logo.png" alt="" width="20" height="20" style="width:20px;height:20px;display:block;" /></td>
        <td style="vertical-align:middle;"><span style="font-family:Georgia,serif;font-size:15px;color:${GOLD};">QuieroComer</span></td>
      </tr></table>
    </a>
  </td></tr>
  <tr><td style="background:#fffaf1;border-radius:28px;border:1px solid #ead7b7;box-shadow:0 20px 60px rgba(70,45,10,0.09);overflow:hidden;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="background:${GOLD};padding:14px 28px;">
      <p style="font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#fff;margin:0;text-align:center;">Tu carta ya recibe pedidos online</p>
    </td></tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="padding:32px 28px 28px;">
      <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;letter-spacing:-0.02em;margin:0 0 18px;color:#111;text-align:center;">
        Cada mesa sin QR es un pedido que no llegó
      </h1>
      <p style="font-size:15px;color:#5a3e1b;line-height:1.75;margin:0 0 14px;text-align:center;">
        ${firstName}, tu carta de <strong>${restaurantName}</strong> está publicada con fotos, sugiere platos y recibe pedidos directo a tu WhatsApp.
      </p>
      <p style="font-size:16px;font-weight:700;color:#111;line-height:1.6;margin:0 0 28px;text-align:center;">
        Pero sin el QR en tus mesas,<br/>nadie lo sabe. Y estás perdiendo ventas.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      <tr><td align="center">
        <table cellpadding="0" cellspacing="0" border="0" style="background:#fffaf1;border-radius:20px;border:1.5px solid #ead7b7;box-shadow:0 6px 20px rgba(70,45,10,0.10);">
        <tr><td style="padding:20px 20px 0;" align="center">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;font-weight:800;color:${GOLD};margin:0 0 12px;">Tu código QR — listo para imprimir</p>
          <img src="${qrImageUrl}" alt="QR ${restaurantName}" width="160" height="160" style="width:160px;height:160px;display:block;border-radius:4px;" />
        </td></tr>
        <tr><td style="padding:12px 20px 18px;" align="center">
          <p style="font-family:Georgia,serif;font-size:15px;color:#111;margin:0 0 2px;">${restaurantName}</p>
          <p style="font-size:11px;color:#b8a888;margin:0;">${qrLink}</p>
        </td></tr>
        </table>
      </td></tr>
      </table>
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding-bottom:10px;">
        <a href="${clickTrackUrl || qrGenerarLink}" style="display:inline-block;background:${GOLD};color:#fff;font-size:16px;font-weight:800;padding:17px 40px;border-radius:14px;text-decoration:none;box-shadow:0 10px 28px rgba(232,147,10,0.35);">
          Imprimir mi QR ahora →
        </a>
      </td></tr></table>
      <p style="font-size:13px;color:#b8a888;text-align:center;margin:14px 0 0;line-height:1.6;">
        Imprímelo, ponlo en tus mesas y empieza a recibir pedidos hoy.
      </p>
    </td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding-top:24px;">
    <p style="color:#b8a888;font-size:11px;margin:0;line-height:1.8;">
      <a href="${BASE_URL}" style="color:${GOLD};text-decoration:none;font-family:Georgia,serif;">QuieroComer.cl</a>
      &nbsp;·&nbsp; ¿Dudas? <a href="${BASE_URL}/#contacto" style="color:${GOLD};text-decoration:none;">Contáctanos</a>
      &nbsp;·&nbsp; Hecho en Chile
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function main() {
  const since = new Date("2026-09-02T00:01:00.000-03:00");
  const nudgeWindowStart = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const EXCLUDE_EMAILS = new Set(["jaimee@handoll.cl"]);
  const leads = await prisma.lead.findMany({
    where: {
      cartaStatus: "DELIVERED",
      deliveredAt: { lte: nudgeWindowStart },
      email: { not: "" },
      createdAt: { gte: since },
    },
    select: { id: true, email: true, ownerName: true, localName: true, generatedSlug: true, events: true },
  });

  const pending = leads.filter(l => {
    if (EXCLUDE_EMAILS.has(l.email)) return false;
    const events = Array.isArray(l.events) ? l.events as any[] : [];
    return !events.some((e: any) => e.type === "qr_nudge_sent");
  });

  console.log(`Total candidates: ${leads.length} | Pending (sin nudge): ${pending.length}`);

  let sent = 0;
  for (const lead of pending) {
    const slug = lead.generatedSlug;
    if (!slug) continue;

    const firstName = (lead.ownerName || "").split(" ")[0] || "Hola";
    const restaurantName = lead.localName || "";
    const openPixel = `${BASE_URL}/api/funnel/track/open?lid=${lead.id}&type=qr_nudge`;
    const clickTrackUrl = `${BASE_URL}/api/funnel/track/click?lid=${lead.id}&url=${encodeURIComponent(`${BASE_URL}/qr/generar/${slug}`)}`;

    try {
      const { error } = await resend.emails.send({
        from: FROM,
        to: lead.email,
        subject: `${firstName}, estás perdiendo ventas...`,
        html: qrNudgeEmailHtml({ ownerName: firstName, restaurantName, slug, openPixel, clickTrackUrl }),
      });

      if (error) {
        console.error(`  ❌ ${lead.email} (${restaurantName}):`, error);
        continue;
      }

      const events = Array.isArray(lead.events) ? lead.events as any[] : [];
      await prisma.lead.update({
        where: { id: lead.id },
        data: { events: [...events, { type: "qr_nudge_sent", at: new Date().toISOString() }] },
      });

      sent++;
      console.log(`  ✅ ${restaurantName} → ${lead.email}`);
    } catch (e: any) {
      console.error(`  ❌ ${lead.email}:`, e.message);
    }
  }

  console.log(`\nListo: ${sent}/${pending.length} enviados`);
  await prisma.$disconnect();
}
main().catch(console.error);

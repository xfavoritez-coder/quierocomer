import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { sendAdminEmail, adminEmailTemplate } from "../src/lib/email/sendAdminEmail";

async function main() {
  const p = new PrismaClient();

  // Send update email
  const baseUrl = "https://quierocomer.cl";
  const slug = "heladeria-italia-1609-cafe-crepe";
  const qrLink = `${baseUrl}/qr/${slug}`;
  const panelLink = `${baseUrl}/api/panel/demo-auth?slug=${slug}`;

  const html = `<html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="background-color:#fbf6ec;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;margin:0;padding:0">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:430px;margin:0 auto;padding:24px 16px 32px">
<tr><td>
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#fffaf1;border-radius:24px;border:1px solid #ead7b7">
<tr><td style="padding:28px 22px 24px">

<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:16px">
  <p style="font-size:36px;margin:0">✨</p>
</td></tr>
</table>

<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:8px">
<h1 style="font-family:Georgia,serif;font-size:26px;line-height:1.1;color:#1a1a1a;margin:0">
  Actualizamos tu carta
</h1>
</td></tr>
<tr><td style="text-align:center;padding-bottom:22px">
<p style="font-size:15px;color:#7a6547;line-height:1.55;margin:0">
  Freddy, mejoramos las fotos de tu carta a alta calidad. Ya puedes verla con el nuevo diseño.
</p>
</td></tr>
</table>

<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="padding-bottom:22px"><div style="width:40px;height:2px;background:#f29a00;margin:0 auto;border-radius:1px"></div></td></tr>
</table>

<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-bottom:10px">
  <a href="${qrLink}" style="display:block;background:#f7a400;color:#ffffff;font-size:16px;font-weight:800;padding:16px 0;border-radius:14px;text-decoration:none;text-align:center;max-width:300px;margin:0 auto">
    Ver mi carta →
  </a>
</td></tr>
<tr><td style="text-align:center;padding-bottom:16px">
  <a href="${panelLink}" style="display:block;background:transparent;color:#7a6547;font-size:14px;font-weight:700;padding:12px 0;border-radius:14px;text-decoration:none;border:1.5px solid #ead7b7;text-align:center;max-width:300px;margin:0 auto">
    Entrar al panel
  </a>
</td></tr>
</table>

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #ead7b7">
<tr><td style="padding-top:16px;text-align:center">
  <p style="font-size:13px;color:#7a6547;margin:0">
    ¿Necesitas ayuda? <a href="https://quierocomer.cl/#contacto" style="color:#f29a00;text-decoration:underline;font-weight:700">Contáctanos</a>
  </p>
</td></tr>
</table>

</td></tr>
</table>

<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="text-align:center;padding-top:24px">
<p style="color:#b8a888;font-size:11px;margin:0">QuieroComer.cl · 2026</p>
</td></tr>
</table>

</td></tr>
</table>
</body></html>`;

  await sendAdminEmail({
    to: "contacto@italia1609.cl",
    subject: "Heladería Italia 1609 · Mejoramos la calidad de tu carta",
    purpose: "carta_update",
    html,
  });
  console.log("Email sent to contacto@italia1609.cl");

  // Activate (remove demo flag) without sending activation email
  await p.restaurant.updateMany({
    where: { slug },
    data: { isDemo: false },
  });
  console.log("Restaurant activated (isDemo: false)");

  // Track activation in lead
  await p.lead.updateMany({
    where: { generatedSlug: slug, activatedAt: null },
    data: { activatedAt: new Date(), activated: true },
  });
  console.log("Lead marked as activated");

  await p.$disconnect();
}
main();

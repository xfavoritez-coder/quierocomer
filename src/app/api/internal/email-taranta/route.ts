import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail, btn } from "@/lib/email/sendAdminEmail";

const GOLD = "#e8930a";
const BASE_URL = "https://quierocomer.com";

/**
 * GET /api/internal/email-taranta?key=SEED_SECRET
 * One-time: send apology email to Taranta Chicureo about photos.
 * Delete this file after use.
 */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const seedSecret = process.env.SEED_SECRET;
  if (!seedSecret || key !== seedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lead = await prisma.lead.findFirst({
    where: { generatedSlug: "taranta-chicureo" },
    select: { ownerName: true, email: true },
  });
  if (!lead?.email) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const r = await prisma.restaurant.findFirst({ where: { slug: "taranta-chicureo" }, select: { id: true } });
  if (!r) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  const dishes = await prisma.dish.findMany({ where: { restaurantId: r.id }, select: { id: true, photos: true } });
  const total = dishes.length;
  const withPhotos = dishes.filter(d => (d.photos as any[])?.length > 0).length;
  const firstName = (lead.ownerName || "").split(" ")[0] || "Hola";
  const cartaUrl = `${BASE_URL}/qr/taranta-chicureo`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fefefe;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;-webkit-text-size-adjust:100%;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fefefe;">
<tr><td align="center" style="padding:32px 16px;">
<table width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;">

  <tr><td align="center" style="padding-bottom:24px;">
    <a href="${BASE_URL}" style="text-decoration:none;"><table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="vertical-align:middle;padding-right:3px;"><img src="${BASE_URL}/logo.png" alt="" width="24" height="24" style="width:24px;height:24px;display:block;" /></td>
      <td style="vertical-align:middle;"><span style="font-family:Georgia,serif;font-size:16px;color:${GOLD};">QuieroComer</span></td>
    </tr></table></a>
  </td></tr>

  <tr><td style="padding-bottom:8px;">
    <h1 style="font-family:Georgia,serif;font-size:26px;font-weight:400;color:#1a1a1a;margin:0;text-align:center;line-height:1.15;">
      ${firstName}, tu carta ya tiene todas las fotos
    </h1>
  </td></tr>

  <tr><td style="font-size:15px;color:#7a6547;line-height:1.6;padding-bottom:20px;text-align:center;">
    Pedimos disculpas, al procesar la carta de <strong style="color:${GOLD};">Taranta Chicureo</strong> inicialmente no se extrajeron correctamente todas las secciones ni las fotos. Ya lo corregimos: ahora tu carta tiene <strong>${total} platos</strong> con <strong>${withPhotos} fotos</strong> de tu carta original.
  </td></tr>

  <tr><td style="padding-bottom:24px;">${btn(cartaUrl, "Ver mi carta")}</td></tr>

  <tr><td style="font-size:13px;color:#8a7550;line-height:1.55;padding-bottom:20px;text-align:center;">
    Si notas algo que no quedo bien o quieres hacer ajustes, puedes editar todo desde tu <a href="${BASE_URL}/panel" style="color:${GOLD};font-weight:700;text-decoration:none;">panel</a>. Cualquier duda estamos para ayudarte.
  </td></tr>

  <tr><td style="padding-top:8px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background:#e8dcc4;"></td></tr></table>
  </td></tr>
  <tr><td align="center" style="padding:20px 0 0;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td><a href="${BASE_URL}" style="font-family:Georgia,serif;font-size:13px;color:${GOLD};text-decoration:none;">QuieroComer.cl</a></td>
      <td style="font-size:11px;color:#ccc;padding:0 6px;">&middot;</td>
      <td style="font-size:11px;color:#b8a888;">Hecho en Chile</td>
      <td style="font-size:11px;color:#ccc;padding:0 6px;">&middot;</td>
      <td style="font-size:11px;color:#b8a888;">&copy; ${new Date().getFullYear()}</td>
    </tr></table>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  const result = await sendAdminEmail({
    to: lead.email,
    subject: `${firstName}, tu carta de Taranta Chicureo ya esta completa con fotos`,
    html,
    purpose: "taranta_apology",
  });

  return NextResponse.json({ ok: true, to: lead.email, emailId: result?.logId });
}

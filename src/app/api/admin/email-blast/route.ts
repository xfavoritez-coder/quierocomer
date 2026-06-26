import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
const GOLD = "#F4A623";

function buildExportarCartaEmailHtml({ ownerName }: { ownerName: string }) {
  const firstName = ownerName?.split(" ")[0] || "Hola";
  const panelUrl = `${BASE}/panel/exportar`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;">
<tr><td align="center" style="padding:32px 16px;">
<table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

  <!-- Logo -->
  <tr><td align="center" style="padding-bottom:28px;">
    <img src="${BASE}/logo.png" alt="QuieroComer" width="36" height="36" style="width:36px;height:36px;margin:0 auto 8px;display:block;" />
    <span style="font-family:Georgia,serif;font-size:18px;color:${GOLD};">QuieroComer</span>
  </td></tr>

  <!-- Card -->
  <tr><td style="background:#ffffff;border-radius:16px;padding:36px 32px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">

    <!-- Emoji hero -->
    <p style="text-align:center;font-size:48px;margin:0 0 16px;">🖨️</p>

    <h1 style="font-family:Georgia,serif;font-size:24px;color:#1a1a1a;text-align:center;margin:0 0 8px;line-height:1.3;">
      Tu carta ahora se imprime
    </h1>
    <p style="font-size:15px;color:#666;text-align:center;margin:0 0 28px;line-height:1.6;">
      ${firstName}, ahora puedes exportar tu carta completa como <strong>PDF profesional</strong> listo para imprimir.
    </p>

    <!-- Features -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
      <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
        <span style="font-size:20px;vertical-align:middle;">🎨</span>
        <span style="font-size:14px;color:#333;margin-left:10px;vertical-align:middle;"><strong>4 diseños profesionales</strong> — Carbón, Huerto, Mediterráneo y Piedra</span>
      </td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
        <span style="font-size:20px;vertical-align:middle;">📷</span>
        <span style="font-size:14px;color:#333;margin-left:10px;vertical-align:middle;"><strong>Con o sin fotos</strong> — activa las fotos de tus platos con un click</span>
      </td></tr>
      <tr><td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
        <span style="font-size:20px;vertical-align:middle;">📄</span>
        <span style="font-size:14px;color:#333;margin-left:10px;vertical-align:middle;"><strong>PDF listo para imprimir</strong> — descarga directa, formato A4</span>
      </td></tr>
      <tr><td style="padding:10px 0;">
        <span style="font-size:20px;vertical-align:middle;">✏️</span>
        <span style="font-size:14px;color:#333;margin-left:10px;vertical-align:middle;"><strong>Siempre actualizada</strong> — cada vez que cambies tu carta digital, el PDF refleja los cambios</span>
      </td></tr>
    </table>

    <!-- CTA -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center">
        <a href="${panelUrl}" style="display:inline-block;padding:14px 36px;background:${GOLD};color:#0a0a0a;text-decoration:none;font-weight:700;font-size:15px;border-radius:12px;letter-spacing:0.02em;">
          Exportar mi carta →
        </a>
      </td></tr>
    </table>

    <p style="font-size:13px;color:#999;text-align:center;margin:20px 0 0;line-height:1.5;">
      Funcionalidad exclusiva del plan Premium.
    </p>

  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px 0;text-align:center;">
    <p style="font-size:12px;color:#999;margin:0;">
      QuieroComer · La carta inteligente para restaurantes
    </p>
    <p style="font-size:11px;color:#bbb;margin:6px 0 0;">
      <a href="${BASE}/api/email/toggle-weekly?slug=_" style="color:#bbb;">Dejar de recibir estos emails</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { testEmail } = await req.json();

  if (testEmail) {
    // Send test email to a specific address
    await sendAdminEmail({
      to: testEmail,
      subject: "Tu carta ahora se imprime — nuevo en QuieroComer",
      html: buildExportarCartaEmailHtml({ ownerName: "Jaime" }),
      purpose: "feature_announcement",
    });
    return NextResponse.json({ ok: true, sent: 1 });
  }

  return NextResponse.json({ error: "Usa testEmail para enviar prueba" }, { status: 400 });
}

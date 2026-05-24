import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { resend } from "@/lib/resend";

/** GET: list all support messages */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const messages = await prisma.supportMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const unread = messages.filter(m => !m.read).length;

  return NextResponse.json({ messages, unread });
}

/** POST: reply to a message */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { messageId, replyText } = await req.json();
  if (!messageId || !replyText?.trim()) {
    return NextResponse.json({ error: "messageId y replyText requeridos" }, { status: 400 });
  }

  const msg = await prisma.supportMessage.findUnique({ where: { id: messageId } });
  if (!msg) return NextResponse.json({ error: "Mensaje no encontrado" }, { status: 404 });

  const GOLD = "#e8930a";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fefefe;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fefefe;">
<tr><td align="center" style="padding:32px 16px;">
<table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;">

  <!-- Logo -->
  <tr><td align="center" style="padding-bottom:24px;">
    <img src="https://quierocomer.cl/landing/logo.png" alt="QuieroComer" width="32" height="32" style="width:32px;height:32px;margin-bottom:8px;display:block;margin:0 auto 8px;" />
    <span style="font-family:Georgia,serif;font-size:18px;color:${GOLD};">QuieroComer</span>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding-bottom:20px;">
    <p style="font-size:15px;color:#1a1a1a;margin:0 0 4px;">Hola${msg.name ? ` ${msg.name.split(" ")[0]}` : ""},</p>
  </td></tr>

  <!-- Original message reference -->
  <tr><td style="padding-bottom:20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f6f0;border:1px solid #e8dcc4;border-radius:12px;">
      <tr><td style="padding:14px 16px;">
        <div style="font-size:10px;color:#b8a888;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">Tu mensaje</div>
        <div style="font-size:13px;color:#8a7550;line-height:1.5;white-space:pre-wrap;">${msg.message.length > 200 ? msg.message.substring(0, 200) + "..." : msg.message}</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- Reply -->
  <tr><td style="padding-bottom:28px;">
    <div style="font-size:15px;color:#1a1a1a;line-height:1.7;white-space:pre-wrap;">${replyText.trim()}</div>
  </td></tr>

  <!-- Separator -->
  <tr><td style="padding-bottom:20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background:#e8dcc4;"></td></tr></table>
  </td></tr>

  <!-- Footer -->
  <tr><td align="center">
    <p style="font-size:12px;color:#b8a888;margin:0 0 4px;">¿Necesitas más ayuda? Responde directamente a este correo.</p>
    <a href="https://quierocomer.cl" style="font-size:12px;color:${GOLD};text-decoration:none;">quierocomer.cl</a>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;

  try {
    await resend.emails.send({
      from: "QuieroComer <soporte@quierocomer.cl>",
      to: msg.email,
      replyTo: "hola@quierocomer.cl",
      subject: `Re: Tu consulta en QuieroComer`,
      html,
    });

    await prisma.supportMessage.update({
      where: { id: messageId },
      data: { read: true, repliedAt: new Date(), replyText: replyText.trim() },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[admin/soporte] Reply error:", e?.message);
    return NextResponse.json({ error: "Error al enviar respuesta" }, { status: 500 });
  }
}

/** PATCH: mark as read */
export async function PATCH(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { messageId } = await req.json();
  if (!messageId) return NextResponse.json({ error: "messageId requerido" }, { status: 400 });

  await prisma.supportMessage.update({ where: { id: messageId }, data: { read: true } });
  return NextResponse.json({ ok: true });
}

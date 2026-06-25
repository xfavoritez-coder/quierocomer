import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { resend } from "@/lib/resend";
import crypto from "crypto";

function genToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

const GOLD = "#e8930a";
const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";

function buildReplyEmailHtml(msg: { name: string | null; email: string; message: string }, replyText: string, replyToken: string): string {
  const replyUrl = `${BASE}/soporte/responder/${replyToken}`;
  const firstName = msg.name?.split(" ")[0] || "";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fefefe;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fefefe;">
<tr><td align="center" style="padding:32px 16px;">
<table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;">

  <tr><td align="center" style="padding-bottom:24px;">
    <img src="${BASE}/landing/logo.png" alt="QuieroComer" width="32" height="32" style="width:32px;height:32px;margin:0 auto 8px;display:block;" />
    <span style="font-family:Georgia,serif;font-size:18px;color:${GOLD};">QuieroComer</span>
  </td></tr>

  <tr><td style="padding-bottom:20px;">
    <p style="font-size:15px;color:#1a1a1a;margin:0;">Hola${firstName ? ` ${firstName}` : ""},</p>
  </td></tr>

  <tr><td style="padding-bottom:20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f6f0;border:1px solid #e8dcc4;border-radius:12px;">
      <tr><td style="padding:14px 16px;">
        <div style="font-size:10px;color:#b8a888;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">Tu mensaje</div>
        <div style="font-size:13px;color:#8a7550;line-height:1.5;white-space:pre-wrap;">${msg.message.length > 200 ? msg.message.substring(0, 200) + "..." : msg.message}</div>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding-bottom:28px;">
    <div style="font-size:15px;color:#1a1a1a;line-height:1.7;white-space:pre-wrap;">${replyText}</div>
  </td></tr>

  <tr><td align="center" style="padding-bottom:28px;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="border-radius:999px;background:${GOLD};padding:13px 32px;">
        <a href="${replyUrl}" style="color:#fff;font-size:14px;font-weight:800;text-decoration:none;display:block;">Responder</a>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding-bottom:20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background:#e8dcc4;"></td></tr></table>
  </td></tr>

  <tr><td align="center">
    <a href="${BASE}" style="font-size:12px;color:${GOLD};text-decoration:none;">quierocomer.cl</a>
    <br/><span style="font-size:10px;color:#ddd;">&copy; ${new Date().getFullYear()}</span>
  </td></tr>

</table>
</td></tr></table>
</body></html>`;
}

/** GET: list all support messages with replies */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  // If only badge count is needed (sidebar polling), return early with just the count
  const onlyCount = req.nextUrl.searchParams.get("countOnly") === "1";
  if (onlyCount) {
    const unread = await prisma.supportMessage.count({ where: { read: false } });
    return NextResponse.json({ unread });
  }

  const messages = await prisma.supportMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { replies: { orderBy: { createdAt: "asc" } } },
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

  // Ensure message has a reply token
  let token = msg.replyToken;
  if (!token) {
    token = genToken();
    await prisma.supportMessage.update({ where: { id: messageId }, data: { replyToken: token } });
  }

  try {
    await resend.emails.send({
      from: "QuieroComer <soporte@quierocomer.cl>",
      to: msg.email,
      replyTo: "hola@quierocomer.cl",
      subject: `Re: Tu consulta en QuieroComer`,
      html: buildReplyEmailHtml(msg, replyText.trim(), token),
    });

    await prisma.supportReply.create({
      data: { messageId, from: "admin", text: replyText.trim() },
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

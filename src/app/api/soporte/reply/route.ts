import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";

/**
 * POST /api/soporte/reply
 * Body: { token, text }
 *
 * Public endpoint — customer replies to a support thread via the web page.
 * Adds the reply to the thread and notifies admin by email.
 */
export async function POST(req: Request) {
  const { token, text } = await req.json();

  if (!token || !text?.trim()) {
    return NextResponse.json({ error: "Token y texto requeridos" }, { status: 400 });
  }

  const msg = await prisma.supportMessage.findUnique({ where: { replyToken: token } });
  if (!msg) return NextResponse.json({ error: "Conversacion no encontrada" }, { status: 404 });

  await prisma.supportReply.create({
    data: { messageId: msg.id, from: "customer", text: text.trim() },
  });

  // Mark as unread so admin sees the new reply
  await prisma.supportMessage.update({
    where: { id: msg.id },
    data: { read: false },
  });

  // Notify admin
  sendAdminEmail({
    to: "favoritez@gmail.com",
    subject: `Nueva respuesta de ${msg.name || msg.email} en soporte`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:600px;">
        <p><strong>${msg.name || msg.email}</strong> respondio a su ticket de soporte:</p>
        <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0;white-space:pre-wrap;line-height:1.6;">${text.trim()}</div>
        <p><a href="https://quierocomer.cl/admin/soporte" style="color:#e8930a;font-weight:700;">Ver en admin</a></p>
      </div>
    `,
    purpose: "support_reply_notification",
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}

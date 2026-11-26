import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";
import { addLeadEvent } from "@/lib/ventas/leads";
import { registrationToken, registrationUrl, sendRegistrationEmail } from "@/lib/ventas/registration";

export const runtime = "nodejs";
const ORIGIN = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";

/** Recordatorio a las 48 h si el dueño no completó su registro: correo al dueño (mismo enlace) y aviso al vendedor. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const pending = await prisma.leadRegistration.findMany({
    where: { completedAt: null, remindedAt: null, expiresAt: { gt: now }, updatedAt: { lt: new Date(now.getTime() - 48 * 3600000) } },
    select: { id: true, leadId: true, expiresAt: true, sentTo: true, lead: { select: { localName: true, whatsapp: true, seller: { select: { name: true, email: true } } } } },
    take: 50,
  });

  let sent = 0;
  for (const r of pending) {
    // Marcar primero: si algo falla no se repite el envío cada hora.
    const claimed = await prisma.leadRegistration.updateMany({ where: { id: r.id, remindedAt: null }, data: { remindedAt: now } });
    if (!claimed.count) continue;
    const url = registrationUrl(ORIGIN, registrationToken(r.leadId, r.expiresAt));
    if (r.sentTo) await sendRegistrationEmail(r.sentTo, url, r.lead.localName, r.lead.seller?.name ?? null).catch((e) => console.error("[ventas recordatorio]", e));
    if (r.lead.seller?.email) {
      await sendAdminEmail({
        to: r.lead.seller.email, subject: `⏰ ${r.lead.localName} aún no completa su registro`, purpose: "ventas_recordatorio", skipLog: true,
        html: `<p style="font-family:Arial,sans-serif;font-size:15px"><b>${r.lead.localName.replace(/[<>&]/g, "")}</b> recibió su enlace hace 2 días y aún no se registra. Le reenviamos el correo con su enlace.</p>
<p><a href="${ORIGIN}/ventas/${r.leadId}" style="font-family:Arial,sans-serif">Ver el local</a></p>`,
      }).catch((e) => console.error("[ventas recordatorio vendedor]", e));
    }
    await addLeadEvent(r.leadId, "email_sent", "system", null, { payload: { kind: "registration_reminder", to: r.sentTo } });
    sent++;
  }
  return NextResponse.json({ ok: true, sent });
}

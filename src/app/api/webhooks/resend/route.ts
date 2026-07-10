import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";

/**
 * Resend webhook — handles email bounce/complaint events.
 * Configure at: https://resend.com/webhooks
 * URL: https://quierocomer.com/api/webhooks/resend
 * Events: email.bounced, email.complained
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, data } = body;

    if (!type || !data) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const email = data.to?.[0] || data.email_address || null;

    if (type === "email.bounced" || type === "email.complained") {
      console.log(`[Resend Webhook] ${type} for ${email}`);

      if (email) {
        // Find leads with this email and mark as bounced
        const leads = await prisma.lead.findMany({
          where: { email: { equals: email, mode: "insensitive" }, emailBouncedAt: null },
          select: { id: true, whatsapp: true, localName: true, ownerName: true, generatedSlug: true },
        });

        for (const lead of leads) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              emailBouncedAt: new Date(),
              events: {
                push: { action: "email_bounced", type, email, ts: new Date().toISOString() },
              },
            },
          });

          // If we have WhatsApp, notify the owner that their email bounced
          if (lead.whatsapp) {
            const ownerName = lead.ownerName?.split(" ")[0] || "Hola";
            await sendWhatsApp({
              to: lead.whatsapp,
              body: `${ownerName}, al parecer hubo un error con tu correo ${email} y no pudimos enviarte tu carta de ${lead.localName}.\n\n¿Puedes confirmarnos tu correo correcto respondiendo este mensaje?\n\n— QuieroComer`,
            });
          }
        }

        // Also notify admin
        try {
          const { sendAdminPush } = await import("@/lib/adminPush");
          await sendAdminPush(
            "📧 Email rebotó",
            `${email} — ${leads.length} lead${leads.length > 1 ? "s" : ""} afectado${leads.length > 1 ? "s" : ""}`,
            "https://quierocomer.com/admin/funnel",
          );
        } catch {}
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Resend Webhook]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

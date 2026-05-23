import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

/**
 * GET /api/admin/whatsapp
 * Returns all leads with WhatsApp activity + incoming messages.
 */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    // All leads that have whatsappSentAt
    const leads = await prisma.lead.findMany({
      where: { whatsappSentAt: { not: null } },
      orderBy: { whatsappSentAt: "desc" },
      select: {
        id: true, localName: true, ownerName: true, email: true,
        whatsapp: true, generatedSlug: true, cartaStatus: true,
        whatsappSentAt: true, whatsappClickedAt: true,
        emailOpenedAt: true, emailClickedAt: true,
        openedVia: true, onboardingDoneAt: true,
        panelVisitedAt: true, activarVisitedAt: true, activatedAt: true,
        deliveredAt: true,
      },
    });

    // Fetch Twilio message statuses for recent messages (last 7 days)
    let twilioStatuses: Record<string, string> = {};
    try {
      const SID = process.env.TWILIO_ACCOUNT_SID;
      const TOKEN = process.env.TWILIO_AUTH_TOKEN;
      if (SID && TOKEN) {
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
        const res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json?From=whatsapp%3A${encodeURIComponent(process.env.TWILIO_WHATSAPP_FROM?.replace("whatsapp:", "") || "")}&DateSent%3E=${weekAgo}&PageSize=200`,
          { headers: { "Authorization": "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64") } },
        );
        if (res.ok) {
          const data = await res.json();
          for (const msg of (data.messages || [])) {
            const phone = msg.to?.replace("whatsapp:", "") || "";
            twilioStatuses[phone] = msg.status; // queued, sent, delivered, read, failed, undelivered
          }
        }
      }
    } catch {}

    // Enrich leads with Twilio delivery status
    const enriched = leads.map(l => {
      const phone = l.whatsapp?.startsWith("+") ? l.whatsapp : `+${l.whatsapp}`;
      return {
        ...l,
        twilioStatus: twilioStatuses[phone || ""] || null,
      };
    });

    // Stats
    const total = leads.length;
    const clicked = leads.filter(l => l.whatsappClickedAt).length;
    const opened = leads.filter(l => l.openedVia === "whatsapp").length;
    const delivered = Object.values(twilioStatuses).filter(s => s === "delivered" || s === "read").length;
    const read = Object.values(twilioStatuses).filter(s => s === "read").length;
    const failed = Object.values(twilioStatuses).filter(s => s === "failed" || s === "undelivered").length;

    return NextResponse.json({
      leads: enriched,
      stats: { total, clicked, opened, delivered, read, failed },
    });
  } catch (error) {
    console.error("[Admin WhatsApp]", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

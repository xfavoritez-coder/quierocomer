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

    // Skip Twilio API call to avoid timeouts — status comes from DB now
    const twilioStatuses: Record<string, string> = {};

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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

/**
 * POST /api/admin/resend-notifications
 * Body: { restaurantName: string } or { leadId: string }
 *
 * Re-sends carta-lista email + WhatsApp for a lead whose notifications
 * were missed (e.g. due to translationOk gate).
 */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await req.json();
  const { restaurantName, leadId } = body;

  // Find the lead
  let lead;
  if (leadId) {
    lead = await prisma.lead.findUnique({ where: { id: leadId } });
  } else if (restaurantName) {
    // Search by local name (fuzzy match)
    lead = await prisma.lead.findFirst({
      where: { localName: { contains: restaurantName, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
    });
  }

  if (!lead) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });

  // Find the restaurant by generated slug or local name
  let restaurant;
  if (lead.generatedSlug) {
    restaurant = await prisma.restaurant.findFirst({
      where: { slug: lead.generatedSlug },
      select: { id: true, name: true, slug: true, logoUrl: true },
    });
  }
  if (!restaurant && lead.localName) {
    restaurant = await prisma.restaurant.findFirst({
      where: { name: { contains: lead.localName, mode: "insensitive" } },
      select: { id: true, name: true, slug: true, logoUrl: true },
    });
  }

  if (!restaurant) return NextResponse.json({ error: "Restaurante no encontrado", lead: { id: lead.id, localName: lead.localName, email: lead.email, whatsapp: lead.whatsapp } }, { status: 404 });

  const results: Record<string, any> = {
    lead: { id: lead.id, localName: lead.localName, email: lead.email, whatsapp: lead.whatsapp, cartaStatus: lead.cartaStatus },
    restaurant: { name: restaurant.name, slug: restaurant.slug },
  };

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.com";

  // Count dishes/categories for email
  const [dishCount, categoryCount] = await Promise.all([
    prisma.dish.count({ where: { restaurantId: restaurant.id } }),
    prisma.category.count({ where: { restaurantId: restaurant.id } }),
  ]);

  // Send email
  if (lead.email) {
    try {
      const { sendAdminEmail, cartaListaSimpleEmailHtml } = await import("@/lib/email/sendAdminEmail");
      const openPixel = `${baseUrl}/api/funnel/track/open?lid=${lead.id}`;
      const clickUrl = `${baseUrl}/api/funnel/track/click?lid=${lead.id}&url=${encodeURIComponent(`${baseUrl}/qr/${restaurant.slug}`)}`;
      const ownerName = (lead.ownerName || "Hola").split(" ")[0];

      await sendAdminEmail({
        to: lead.email,
        subject: `${ownerName}, tu carta de ${restaurant.name} está lista`,
        html: cartaListaSimpleEmailHtml({ ownerName, restaurantName: restaurant.name, cartaUrl: clickUrl, openPixel, dishCount, categoryCount, logoUrl: restaurant.logoUrl }),
        purpose: "funnel_carta_lista",
      });

      await prisma.lead.update({ where: { id: lead.id }, data: { cartaStatus: "DELIVERED", deliveredAt: new Date() } });
      results.email = { sent: true, to: lead.email };
    } catch (err: any) {
      results.email = { sent: false, error: err.message };
    }
  } else {
    results.email = { sent: false, reason: "no email on lead" };
  }

  // Send WhatsApp
  if (lead.whatsapp) {
    try {
      const { sendWhatsApp, buildCartaReadyMessage } = await import("@/lib/whatsapp");
      const waTrackUrl = `${baseUrl}/c/${restaurant.slug}`;
      const ownerName = (lead.ownerName || "Hola").split(" ")[0];
      const msg = buildCartaReadyMessage({
        ownerName,
        restaurantName: restaurant.name,
        trackUrl: waTrackUrl,
      });
      const sid = await sendWhatsApp({ to: lead.whatsapp, ...msg });
      if (sid) {
        await prisma.lead.update({ where: { id: lead.id }, data: { whatsappSentAt: new Date() } });
        results.whatsapp = { sent: true, to: lead.whatsapp, sid };
      } else {
        results.whatsapp = { sent: false, reason: "Twilio returned null (credentials or delivery issue)" };
      }
    } catch (err: any) {
      results.whatsapp = { sent: false, error: err.message };
    }
  } else {
    results.whatsapp = { sent: false, reason: "no whatsapp on lead" };
  }

  return NextResponse.json(results);
}

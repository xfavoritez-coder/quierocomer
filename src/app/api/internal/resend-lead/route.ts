import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail, cartaListaSimpleEmailHtml } from "@/lib/email/sendAdminEmail";

/**
 * POST /api/admin/resend-lead
 * Body: { leadId, secret }
 * Reenvía email + WhatsApp a un lead READY que no recibió notificación.
 */
export async function POST(req: NextRequest) {
  const { leadId, secret } = await req.json().catch(() => ({} as any));
  if (secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || !lead.generatedSlug) return NextResponse.json({ error: "Lead not found or no slug" }, { status: 404 });

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: lead.generatedSlug },
    select: { id: true, name: true, slug: true, logoUrl: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
  const ownerName = (lead.ownerName || "Hola").split(" ")[0];
  const dishCount = await prisma.dish.count({ where: { restaurantId: restaurant.id, isActive: true } });
  const catCount = await prisma.category.count({ where: { restaurantId: restaurant.id, isActive: true } });
  const results: string[] = [];

  // Email
  if (lead.email) {
    try {
      const openPixel = `${baseUrl}/api/funnel/track/open?lid=${leadId}`;
      const clickUrl = `${baseUrl}/api/funnel/track/click?lid=${leadId}&url=${encodeURIComponent(`${baseUrl}/qr/${restaurant.slug}`)}`;
      await sendAdminEmail({
        to: lead.email,
        subject: `${ownerName}, tu carta está lista`,
        html: cartaListaSimpleEmailHtml({ ownerName, restaurantName: restaurant.name, cartaUrl: clickUrl, openPixel, dishCount, categoryCount: catCount, logoUrl: restaurant.logoUrl }),
        purpose: "funnel_carta_lista",
      });
      results.push(`email sent to ${lead.email}`);
    } catch (e: any) {
      results.push(`email failed: ${e.message}`);
    }
  }

  // WhatsApp
  if (lead.whatsapp) {
    try {
      const { sendWhatsApp, buildCartaReadyMessage } = await import("@/lib/whatsapp");
      const msg = buildCartaReadyMessage({ ownerName, restaurantName: restaurant.name, trackUrl: `${baseUrl}/c/${restaurant.slug}` });
      const sid = await sendWhatsApp({ to: lead.whatsapp, ...msg });
      results.push(sid ? `whatsapp sent (${sid})` : "whatsapp no sid");
    } catch (e: any) {
      results.push(`whatsapp failed: ${e.message}`);
    }
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { cartaStatus: "DELIVERED", deliveredAt: new Date(), ...(lead.whatsapp ? { whatsappSentAt: new Date() } : {}) },
  });

  return NextResponse.json({ ok: true, results });
}

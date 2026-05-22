import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";
import { cartaReadyEmailHtml } from "@/lib/email/cartaReadyEmailHtml";

/**
 * POST /api/admin/resend-email
 * Re-send the "carta lista" email to a lead.
 * Body: { leadId: string }
 */
export async function POST(req: NextRequest) {
  const { leadId } = await req.json();
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, email: true, ownerName: true, localName: true, generatedSlug: true },
  });
  if (!lead || !lead.email || !lead.generatedSlug) {
    return NextResponse.json({ error: "Lead not found or missing email/slug" }, { status: 404 });
  }

  const rest = await prisma.restaurant.findFirst({
    where: { slug: lead.generatedSlug },
    select: { id: true, name: true, slug: true, logoUrl: true },
  });
  if (!rest) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  const dishCount = await prisma.dish.count({ where: { restaurantId: rest.id } });
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
  const openPixel = `${baseUrl}/api/funnel/track/open?lid=${lead.id}`;
  const clickUrl = `${baseUrl}/api/funnel/track/click?lid=${lead.id}&url=${encodeURIComponent(`${baseUrl}/qr/${rest.slug}`)}`;
  const activarUrl = `${baseUrl}/activar/${rest.slug}`;
  let panelUrl = `${baseUrl}/api/panel/demo-auth?slug=${rest.slug}`;
  try {
    const owner = await prisma.restaurantOwner.findFirst({
      where: { restaurants: { some: { id: rest.id } }, status: "ACTIVE" },
      select: { id: true },
    });
    if (owner) {
      const { buildAutoLoginUrl } = await import("@/lib/email/autoLoginUrl");
      panelUrl = buildAutoLoginUrl(baseUrl, owner.id);
    }
  } catch {}

  await sendAdminEmail({
    to: lead.email,
    subject: `Tu nueva carta ${rest.name} está lista`,
    purpose: "funnel_carta_ready",
    html: cartaReadyEmailHtml({
      ownerName: lead.ownerName || "Hola",
      restaurantName: rest.name,
      logoUrl: rest.logoUrl,
      dishCount,
      clickUrl,
      openPixel,
      activarUrl,
      panelUrl,
    }),
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { deliveredAt: new Date(), emailBouncedAt: null },
  });

  return NextResponse.json({ ok: true, to: lead.email });
}

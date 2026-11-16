import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail, demoExpiredEmailHtml, qrNudgeEmailHtml } from "@/lib/email/sendAdminEmail";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const valid = key && (key === process.env.SEED_SECRET || key === process.env.CRON_SECRET);
  if (!valid) return NextResponse.json({ error: "No" }, { status: 401 });

  const action = req.nextUrl.searchParams.get("action") || "test";

  // action=test → enviar correo de prueba demo expired a favoritez@gmail.com
  if (action === "test") {
    const html = demoExpiredEmailHtml({
      ownerName: "Jaime",
      restaurantName: "Club de Campo San Fernando",
      slug: "varas-oportus",
      panelUrl: "https://quierocomer.com/panel",
    });
    await sendAdminEmail({
      to: "favoritez@gmail.com",
      subject: "Tu periodo de prueba de Club de Campo San Fernando ha finalizado",
      purpose: "demo_expired_test",
      html,
    });
    return NextResponse.json({ ok: true, sent: "favoritez@gmail.com" });
  }

  // action=nudge-sweep → barrido: enviar QR nudge a todos los leads del último mes con <30 visitas
  if (action === "nudge-sweep") {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const leads = await prisma.lead.findMany({
      where: {
        cartaStatus: "DELIVERED",
        deliveredAt: { gte: thirtyDaysAgo },
        email: { not: "" },
      },
      select: { id: true, email: true, ownerName: true, localName: true, generatedSlug: true, events: true },
    });

    let sent = 0;
    let skipped = 0;
    const results: string[] = [];

    for (const lead of leads) {
      const events = (lead.events as any[] | null) ?? [];
      if (events.some((e: any) => e.type === "qr_nudge_sent")) { skipped++; continue; }

      const slug = lead.generatedSlug;
      if (!slug) { skipped++; continue; }

      // Filtrar: solo los que tienen <30 visitas
      const restaurant = await prisma.restaurant.findUnique({ where: { slug }, select: { id: true } });
      if (restaurant) {
        const visitCount = await prisma.pageHit.count({ where: { restaurantId: restaurant.id } });
        if (visitCount >= 30) { skipped++; continue; }
      }

      const firstName = (lead.ownerName || "").split(" ")[0] || "Hola";
      const restaurantName = lead.localName || "";
      const openPixelUrl = `https://quierocomer.com/api/funnel/track/open?lid=${lead.id}&type=qr_nudge`;
      const clickTrackUrl = `https://quierocomer.com/api/funnel/track/click?lid=${lead.id}&url=${encodeURIComponent(`https://quierocomer.com/qr/generar/${slug}`)}`;

      try {
        await sendAdminEmail({
          to: lead.email,
          subject: `${firstName}, estás perdiendo ventas...`,
          purpose: "qr_nudge",
          html: qrNudgeEmailHtml({ ownerName: firstName, restaurantName, slug, openPixel: openPixelUrl, clickTrackUrl }),
        });

        await prisma.lead.update({
          where: { id: lead.id },
          data: { events: [...events, { type: "qr_nudge_sent", at: new Date().toISOString() }] },
        });

        sent++;
        results.push(`✓ ${lead.email} (${restaurantName})`);
      } catch (e: any) {
        results.push(`✗ ${lead.email}: ${e.message}`);
      }
    }

    return NextResponse.json({ ok: true, sent, skipped, total: leads.length, results });
  }

  return NextResponse.json({ error: "action must be 'test' or 'nudge-sweep'" }, { status: 400 });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSellerFromRequest } from "@/lib/ventas/session";
import { getSellerLead, getLeadDemoRestaurant } from "@/lib/ventas/leads";
import { suggestColorFromLogo } from "@/lib/ventas/logoColor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/ventas/leads/[id]/status[?full=1] — avance del armado del local (para la animación y la revisión). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const seller = await getSellerFromRequest(req);
  if (!seller) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const lead = await getSellerLead(seller, id);
  if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Si el proceso quedó "procesando" más de 6 min (se cortó), se marca como fallido para poder reintentar.
  if (lead.cartaStatus === "PROCESSING") {
    const row = await prisma.lead.findUnique({ where: { id }, select: { updatedAt: true } });
    if (row && Date.now() - row.updatedAt.getTime() > 6 * 60_000) {
      await prisma.lead.update({ where: { id }, data: { cartaStatus: "FAILED", errorLog: "El proceso se cortó antes de terminar (tardó demasiado). Prueba reintentar." } });
      lead.cartaStatus = "FAILED"; lead.errorLog = "El proceso se cortó antes de terminar (tardó demasiado). Prueba reintentar.";
    }
  }
  const restaurant = await getLeadDemoRestaurant(lead.generatedSlug);
  const categories = restaurant
    ? await prisma.category.findMany({
        where: { restaurantId: restaurant.id },
        orderBy: { position: "asc" },
        select: { id: true, name: true, dishes: { where: { deletedAt: null }, orderBy: { position: "asc" }, select: { id: true, name: true, price: true, photos: true } } },
      })
    : [];
  const dishCount = categories.reduce((n, c) => n + c.dishes.length, 0);
  const full = req.nextUrl.searchParams.get("full") === "1";
  const suggestedColor = full && restaurant ? await suggestColorFromLogo(restaurant.logoUrl) : null;

  return NextResponse.json({
    status: lead.cartaStatus, // PENDING | PROCESSING | READY | DELIVERED | FAILED
    error: lead.cartaStatus === "FAILED" ? lead.errorLog : null,
    source: lead.captureSource,
    localName: lead.localName,
    preview: lead.preview,
    restaurant: restaurant ? { slug: restaurant.slug, name: restaurant.name, logoUrl: restaurant.logoUrl, bannerUrl: restaurant.bannerUrl, accentColor: restaurant.cartaAccentColor, colorMode: restaurant.cartaColorMode, suggestedColor } : null,
    dishCount,
    categories: categories.map((c) => ({ id: c.id, name: c.name, dishes: c.dishes.map((d) => ({ id: d.id, name: d.name, price: d.price, photo: d.photos?.[0] ?? null })) })),
  });
}

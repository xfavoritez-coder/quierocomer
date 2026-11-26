import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSellerFromRequest } from "@/lib/ventas/session";
import { getSellerLead, getLeadDemoRestaurant } from "@/lib/ventas/leads";
import { suggestColorFromLogo } from "@/lib/ventas/logoColor";
import { isVisibleOnWhite } from "@/lib/extractors/logo";

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

  // Logos casi todo blancos no se muestran (se ve un cuadrado blanco): la pantalla usa la inicial.
  const visibleLogo = async (u: string | null | undefined) => (u && (await isVisibleOnWhite(u)) !== false ? u : null);
  const restaurantLogo = await visibleLogo(restaurant?.logoUrl);
  const prev = lead.preview && typeof lead.preview === "object" ? { ...(lead.preview as Record<string, unknown>), logoUrl: await visibleLogo((lead.preview as { logoUrl?: string | null }).logoUrl) } : lead.preview;
  const provider = (await prisma.lead.findUnique({ where: { id }, select: { detectedProvider: { select: { name: true } } } }))?.detectedProvider?.name ?? null;
  return NextResponse.json({
    provider,
    status: lead.cartaStatus, // PENDING | PROCESSING | READY | DELIVERED | FAILED
    error: lead.cartaStatus === "FAILED" ? lead.errorLog : null,
    source: lead.captureSource,
    localName: lead.localName,
    preview: prev,
    restaurant: restaurant ? { slug: restaurant.slug, name: restaurant.name, logoUrl: restaurantLogo, bannerUrl: restaurant.bannerUrl, accentColor: restaurant.cartaAccentColor, colorMode: restaurant.cartaColorMode, suggestedColor } : null,
    dishCount,
    categories: categories.map((c) => ({ id: c.id, name: c.name, dishes: c.dishes.map((d) => ({ id: d.id, name: d.name, price: d.price, photo: d.photos?.[0] ?? null })) })),
  });
}

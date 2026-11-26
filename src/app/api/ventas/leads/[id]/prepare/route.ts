import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getSellerFromRequest } from "@/lib/ventas/session";
import { getSellerLead, getLeadDemoRestaurant } from "@/lib/ventas/leads";
import { ensureDemoLoyalty, ensureDemoStore } from "@/lib/ventas/demoLive";

export const runtime = "nodejs";

/** POST /api/ventas/leads/[id]/prepare — al abrir la demo deja listo el local demo para los
 *  momentos interactivos (garzón, tarjeta, tienda) y refresca su carta en caché. Solo locales demo. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const seller = await getSellerFromRequest(req);
  if (!seller) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const lead = await getSellerLead(seller, id);
  if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const r = await getLeadDemoRestaurant(lead.generatedSlug);
  if (!r) return NextResponse.json({ ok: true, skipped: true });
  const b = await req.json().catch(() => ({}));
  const color = typeof b.color === "string" && /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : r.cartaAccentColor || "#DE7C00";
  const prize = typeof b.prize === "string" ? b.prize.slice(0, 80) : null;
  await Promise.all([ensureDemoLoyalty(r.slug, { color, prize }), ensureDemoStore(r.slug, color)]);
  revalidateTag(`qr-restaurant-${r.slug}`, { expire: 0 } as never);
  revalidateTag(`ecom-storefront-slug-${r.slug}`, { expire: 0 } as never);
  return NextResponse.json({ ok: true });
}

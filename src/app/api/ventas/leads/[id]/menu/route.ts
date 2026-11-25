import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSellerFromRequest } from "@/lib/ventas/session";
import { getSellerLead, getLeadDemoRestaurant, addLeadEvent } from "@/lib/ventas/leads";

export const runtime = "nodejs";

/** PATCH /api/ventas/leads/[id]/menu — revisión rápida de lo extraído.
 *  Body: { dishes?: [{ id, name, price }], bannerUrl?, accentColor? }
 *  Solo toca el local DEMO del lead (isDemo), nunca un local real. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const seller = await getSellerFromRequest(req);
  if (!seller) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const lead = await getSellerLead(seller, id);
  if (!lead) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const restaurant = await getLeadDemoRestaurant(lead.generatedSlug);
  if (!restaurant) return NextResponse.json({ error: "El local aún no está armado" }, { status: 409 });

  const b = await req.json().catch(() => ({}));
  const dishes: { id: string; name: string; price: number }[] = Array.isArray(b.dishes) ? b.dishes : [];
  let changed = 0;
  for (const d of dishes.slice(0, 500)) {
    const name = String(d?.name ?? "").trim().slice(0, 120);
    const price = Math.max(0, Math.round(Number(d?.price) || 0));
    if (!d?.id || !name) continue;
    // where incluye restaurantId: solo platos de ESTE local demo.
    const r = await prisma.dish.updateMany({ where: { id: String(d.id), restaurantId: restaurant.id }, data: { name, price } });
    changed += r.count;
  }
  const data: { bannerUrl?: string | null; cartaAccentColor?: string | null; cartaColorMode?: "LIGHT" | "DARK" } = {};
  if (typeof b.bannerUrl === "string" || b.bannerUrl === null) data.bannerUrl = b.bannerUrl ? String(b.bannerUrl).slice(0, 1000) : null;
  if (typeof b.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(b.accentColor)) data.cartaAccentColor = b.accentColor.toUpperCase();
  if (b.colorMode === "LIGHT" || b.colorMode === "DARK") data.cartaColorMode = b.colorMode;
  if (Object.keys(data).length) await prisma.restaurant.update({ where: { id: restaurant.id }, data });

  revalidateTag(`qr-restaurant-${restaurant.slug}`, { expire: 0 } as never);
  revalidateTag(`ecom-storefront-slug-${restaurant.slug}`, { expire: 0 } as never);
  await addLeadEvent(id, "menu_reviewed", "seller", seller.id, { payload: { dishesChanged: changed, ...data } });
  return NextResponse.json({ ok: true, dishesChanged: changed });
}

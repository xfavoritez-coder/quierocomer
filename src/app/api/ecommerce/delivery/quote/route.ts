import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDeliveryConfig } from "@/lib/ecommerce/delivery";
import { uberSettingsFor, uberConfigured, uberCreateQuote, uberQuoteErrorEs } from "@/lib/ecommerce/uberDirect";

export const runtime = "nodejs";

/**
 * POST /api/ecommerce/delivery/quote
 * Body: { restaurantId? , restaurantSlug?, address, lat, lng }
 * Devuelve el costo de despacho cotizado EN VIVO por Uber Direct (modo
 * "cotización externa"). Se usa en el storefront al ingresar la dirección y en
 * el checkout para fijar el fee real.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const restaurantId = (body?.restaurantId || "").toString();
    const restaurantSlug = (body?.restaurantSlug || "").toString();
    const address = (body?.address || "").toString().trim();
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    if (!restaurantId && !restaurantSlug) return NextResponse.json({ ok: false, error: "restaurante requerido" }, { status: 400 });
    if (!address && !(Number.isFinite(lat) && Number.isFinite(lng))) {
      return NextResponse.json({ ok: false, error: "Falta la dirección de entrega" }, { status: 400 });
    }

    const sel = { id: true, ecommerceConfig: true, ecommerceDeliveryConfig: true, address: true } as const;
    const restaurant = await (restaurantId
      ? prisma.restaurant.findUnique({ where: { id: restaurantId }, select: sel })
      : prisma.restaurant.findUnique({ where: { slug: restaurantSlug }, select: sel }));
    if (!restaurant) return NextResponse.json({ ok: false, error: "Local no encontrado" }, { status: 404 });

    const dcfg = parseDeliveryConfig(restaurant.ecommerceDeliveryConfig);
    if (dcfg.mode !== "uber") return NextResponse.json({ ok: false, error: "El despacho por cotización externa no está activo" }, { status: 400 });

    const creds = uberSettingsFor({ ecommerceConfig: restaurant.ecommerceConfig });
    if (!uberConfigured(creds)) return NextResponse.json({ ok: false, error: "Uber Direct no está configurado" }, { status: 400 });

    const q = await uberCreateQuote(creds, {
      pickupAddress: dcfg.originAddress || restaurant.address || "",
      pickupLat: dcfg.origin?.lat ?? null,
      pickupLng: dcfg.origin?.lng ?? null,
      dropoffAddress: address,
      dropoffLat: Number.isFinite(lat) ? lat : null,
      dropoffLng: Number.isFinite(lng) ? lng : null,
    });
    if (!q.ok || q.fee == null) {
      return NextResponse.json({ ok: false, error: uberQuoteErrorEs(q.error) }, { status: 422 });
    }
    return NextResponse.json({ ok: true, fee: q.fee, durationMin: q.durationMin ?? null });
  } catch {
    return NextResponse.json({ ok: false, error: "Error al cotizar el despacho" }, { status: 500 });
  }
}

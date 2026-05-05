import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncRestaurantVisibility } from "@/lib/toteat/syncVisibility";
import { loadCredentialsFromRestaurant } from "@/lib/toteat/sync";

/**
 * POST /api/toteat/webhook?secret=XXX
 *
 * Endpoint publico que Toteat invoca cuando hay cambios de catalogo /
 * visibilidad de productos. Como el formato exacto del payload de Toteat
 * puede variar, esta ruta es flexible: solo necesita el query param `secret`
 * para identificar al local. Una vez identificado, dispara un sync de
 * visibilidad ligero (que es idempotente y rapido).
 *
 * Configuracion del lado del dueño en Toteat:
 *   URL: https://quierocomer.cl/api/toteat/webhook?secret=<su_secret>
 *   Method: POST
 *   Eventos: cambios de producto (creacion, actualizacion, ocultar)
 *
 * El secret se genera automaticamente al guardar las credenciales y se
 * muestra en el panel del dueño con un boton de copiar.
 */
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret.length < 10) {
    return NextResponse.json({ ok: false, error: "Missing secret" }, { status: 401 });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { toteatWebhookSecret: secret },
    select: { id: true, slug: true },
  });

  if (!restaurant) {
    return NextResponse.json({ ok: false, error: "Invalid secret" }, { status: 401 });
  }

  // Cargar el body — Toteat puede mandar cualquier formato, no nos importa
  // mucho el contenido: el evento mismo es el trigger para resyncear.
  let payload: any = null;
  try { payload = await req.json(); } catch { /* body opcional */ }

  const credentials = await loadCredentialsFromRestaurant(restaurant.id, false);
  if (!credentials) {
    // No hay credenciales pero igual respondemos 200 para no causar reintentos
    return NextResponse.json({ ok: true, ignored: "no credentials" });
  }

  // Sync de visibilidad — operacion ligera, idempotente
  const result = await syncRestaurantVisibility({
    restaurantId: restaurant.id,
    credentials,
  }).catch((e) => ({ ok: false, error: e?.message, hidden: 0, shown: 0, unchanged: 0 }));

  return NextResponse.json({
    ok: true,
    restaurant: restaurant.slug,
    visibility: result,
    receivedPayload: payload ? Object.keys(payload).slice(0, 5) : null,
  });
}

// GET para que Toteat (o el dueño) pueda hacer un health-check
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret) return NextResponse.json({ ok: true, message: "Webhook endpoint listo" });
  const r = await prisma.restaurant.findUnique({
    where: { toteatWebhookSecret: secret },
    select: { slug: true },
  });
  if (!r) return NextResponse.json({ ok: false, error: "Invalid secret" }, { status: 401 });
  return NextResponse.json({ ok: true, restaurant: r.slug, message: "Webhook configurado correctamente" });
}

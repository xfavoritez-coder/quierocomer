// ═══════════════════════════════════════════════════════════
//  Webhook de Uber Eats (Orders API). Recibe los pedidos de Uber
//  Eats y los crea en el POS (Centro de pedidos), sin pasar por
//  Toteat.
//
//  Flujo: verifica firma HMAC → resuelve el local por storeId →
//  getOrder → crea PosOrder → (auto)acepta en Uber. Cancelaciones
//  marcan el PosOrder como anulado.
//
//  ⚠️ Requiere: env UBEREATS_CLIENT_ID / UBEREATS_CLIENT_SECRET (app
//  partner aprobada) y, por local, ecommerceConfig.ubereats.storeId.
//  La forma exacta del payload se confirma con el sandbox del partner.
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { parseEcommerceConfig } from "@/lib/ecommerce/config";
import { getUberOrder, acceptUberOrder, uberAppConfigured } from "@/lib/ubereats/client";
import { createPosOrderFromUberOrder } from "@/lib/ubereats/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifySignature(rawBody: string, signature: string | null): boolean {
  // Clave de firma del webhook configurada en el dashboard de Uber (Basic HMAC).
  // Dedicada (no el client secret de OAuth); fallback al client secret por compat.
  const secret = process.env.UBEREATS_WEBHOOK_SIGNING_KEY || process.env.UBEREATS_CLIENT_SECRET || "";
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature.trim().toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

type J = Record<string, unknown>;
const obj = (v: unknown): J => (v && typeof v === "object" && !Array.isArray(v) ? (v as J) : {});
const str = (v: unknown): string => (v == null ? "" : String(v)).trim();

// Resuelve el restaurantId cuya config de Uber Eats tiene ese storeId.
async function restaurantForStore(storeId: string): Promise<string | null> {
  if (!storeId) return null;
  try {
    const r = await prisma.restaurant.findFirst({
      where: { ecommerceConfig: { path: ["ubereats", "storeId"], equals: storeId } },
      select: { id: true, ecommerceConfig: true },
    });
    if (r && parseEcommerceConfig(r.ecommerceConfig).ubereats?.enabled) return r.id;
  } catch { /* el filtro JSON puede no estar soportado en todas las versiones */ }
  return null;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-uber-signature");
  if (!verifySignature(raw, sig)) {
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }
  if (!uberAppConfigured()) return NextResponse.json({ ok: true, ignored: "app no configurada" }, { status: 200 });

  let body: J;
  try { body = JSON.parse(raw) as J; } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }

  const eventType = str(body.event_type || body.type);
  const meta = obj(body.meta);
  const orderId = str(meta.resource_id || body.resource_id || obj(body.resource).id);
  const storeId = str(meta.user_id || meta.store_id || body.store_id);

  // Responder rápido; el procesamiento no debe hacer fallar el 200 (Uber reintenta
  // por status, pero evitamos timeouts).
  const restaurantId = await restaurantForStore(storeId);
  if (!restaurantId || !orderId) {
    return NextResponse.json({ ok: true, ignored: true, reason: "sin local/orden", storeId, orderId }, { status: 200 });
  }

  try {
    if (/cancel|failure/i.test(eventType)) {
      // Cancelación → anular el PosOrder si existe.
      await prisma.posOrder.updateMany({
        where: { restaurantId, externalId: `ue-${orderId}` },
        data: { posStatus: "canceled" },
      });
      return NextResponse.json({ ok: true, canceled: true, orderId }, { status: 200 });
    }

    // Nuevo pedido (o actualización): traer detalle y crear/espejar al POS.
    const order = await getUberOrder(orderId);
    const result = await createPosOrderFromUberOrder(restaurantId, order);
    if (result?.isNew) {
      const cfg = parseEcommerceConfig(
        (await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceConfig: true } }))?.ecommerceConfig,
      );
      // Aceptar automáticamente en Uber (salvo que el local lo desactive).
      if (cfg.ubereats?.autoAccept !== false) await acceptUberOrder(orderId).catch((e) => console.error("[ubereats] accept:", (e as Error).message));
    }
    return NextResponse.json({ ok: true, posOrderId: result?.posOrderId, isNew: result?.isNew }, { status: 200 });
  } catch (e) {
    console.error("[ubereats/webhook]", (e as Error)?.message);
    // 200 igual para no gatillar reintentos infinitos por un error nuestro.
    return NextResponse.json({ ok: false, error: "procesamiento" }, { status: 200 });
  }
}

// Verificación de dominio de Uber (algunas apps hacen GET al registrar el webhook).
export async function GET() {
  return NextResponse.json({ ok: true, service: "ubereats-webhook" });
}

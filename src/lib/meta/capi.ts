// ═══════════════════════════════════════════════════════════
//  Meta Conversions API (CAPI) — eventos server-side al Pixel.
//  SERVER-ONLY. El evento clave es `Purchase` (venta confirmada), que llega a Meta
//  aunque el navegador bloquee el pixel (iOS/Safari) → señal de alta calidad para
//  optimizar campañas a venta y construir audiencias.
//
//  Config por local: Pixel ID público en ecommerceStoreConfig.metaPixelId; token
//  CAPI (secreto, cifrado) en ecommerceConfig.meta.capiToken. Si falta cualquiera,
//  es no-op (multi-tenant seguro: solo dispara en locales configurados).
// ═══════════════════════════════════════════════════════════
import crypto from "crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseEcommerceConfig } from "@/lib/ecommerce/config";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";
import { decryptEcommerceSecrets } from "@/lib/ecommerce/configSecrets";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";

/** SHA-256 en minúsculas y sin espacios, como exige Meta para los datos personales. */
function hash(v?: string | null): string | undefined {
  const s = (v || "").trim().toLowerCase();
  if (!s) return undefined;
  return crypto.createHash("sha256").update(s).digest("hex");
}

/** Teléfono → solo dígitos con código país (56...) para hashear. */
function hashPhone(phone?: string | null): string | undefined {
  let d = (phone || "").replace(/\D/g, "");
  if (!d) return undefined;
  if (d.length === 9 && d.startsWith("9")) d = "56" + d; // 9XXXXXXXX → 569XXXXXXXX
  return crypto.createHash("sha256").update(d).digest("hex");
}

interface MetaUserData {
  em?: string[]; ph?: string[]; fbp?: string; fbc?: string;
  client_ip_address?: string; client_user_agent?: string;
}

interface MetaEvent {
  event_name: string;
  event_time: number;
  event_id?: string;
  action_source: "website";
  event_source_url?: string;
  user_data: MetaUserData;
  custom_data?: Record<string, unknown>;
}

/** Envía uno o más eventos a la Conversions API de un Pixel. */
export async function sendMetaEvents(pixelId: string, token: string, events: MetaEvent[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: events, access_token: token }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "capi error" };
  }
}

/** Lee los datos de atribución del request (cookies del pixel + IP + user agent). */
function userDataFromReq(req?: NextRequest | null): Pick<MetaUserData, "fbp" | "fbc" | "client_ip_address" | "client_user_agent"> {
  if (!req) return {};
  const fbp = req.cookies.get("_fbp")?.value || undefined;
  const fbc = req.cookies.get("_fbc")?.value || undefined;
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || undefined;
  const ua = req.headers.get("user-agent") || undefined;
  return { fbp, fbc, client_ip_address: ip, client_user_agent: ua };
}

/** content_ids + num_items desde los items del pedido (para catálogo/retargeting). */
function contentsFromItems(items: unknown): { content_ids: string[]; num_items: number } {
  const arr = Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
  const ids: string[] = [];
  let num = 0;
  for (const it of arr) {
    if (it?.isExtra) continue;
    const id = String(it?.dishId ?? it?.productId ?? it?.id ?? it?.productName ?? it?.name ?? "").trim();
    const qty = Number(it?.quantity ?? it?.qty ?? 1) || 1;
    if (id) ids.push(id);
    num += qty;
  }
  return { content_ids: ids, num_items: num };
}

/**
 * Dispara el evento `Purchase` de un pedido a Meta (CAPI). IDEMPOTENTE: marca el
 * pedido (statusHistory META_PURCHASE_SENT) y no vuelve a disparar. Fire-and-forget:
 * nunca lanza (se usa con void). No-op si el local no tiene Pixel + token CAPI.
 */
export async function fireMetaPurchase(orderId: string, req?: NextRequest | null): Promise<void> {
  try {
    const order = await prisma.onlineOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true, total: true, items: true, customerEmail: true, customerPhone: true,
        statusHistory: true, paymentStatus: true, paymentGateway: true,
        restaurant: { select: { ecommerceConfig: true, ecommerceStoreConfig: true, slug: true } },
      },
    });
    if (!order) return;
    // Pago online no confirmado → NO es una venta: no disparar (robusto ante mal uso).
    const ONLINE = ["webpay", "flow", "mercadopago"];
    if (ONLINE.includes(order.paymentGateway || "") && order.paymentStatus !== "paid") return;

    const pixelId = parseStoreConfig(order.restaurant?.ecommerceStoreConfig).metaPixelId;
    const token = decryptEcommerceSecrets(parseEcommerceConfig(order.restaurant?.ecommerceConfig)).meta?.capiToken;
    if (!pixelId || !token) return; // local sin CAPI configurada → no-op

    // Idempotencia: no re-disparar.
    const hist = Array.isArray(order.statusHistory) ? (order.statusHistory as Record<string, unknown>[]) : [];
    if (hist.some((h) => h?.type === "META_PURCHASE_SENT")) return;

    const user_data: MetaUserData = { ...userDataFromReq(req) };
    const em = hash(order.customerEmail); if (em) user_data.em = [em];
    const ph = hashPhone(order.customerPhone); if (ph) user_data.ph = [ph];

    const { content_ids, num_items } = contentsFromItems(order.items);
    const event: MetaEvent = {
      event_name: "Purchase",
      event_time: Math.floor(Date.now() / 1000),
      event_id: `order-${order.id}`, // mismo id que usará el pixel del navegador → dedup
      action_source: "website",
      event_source_url: order.restaurant?.slug ? `https://quierocomer.com/ecommerce/${order.restaurant.slug}` : undefined,
      user_data,
      custom_data: {
        currency: "CLP",
        value: order.total,
        ...(content_ids.length ? { content_ids, content_type: "product" } : {}),
        num_items,
      },
    };

    const res = await sendMetaEvents(pixelId, token, [event]);
    if (!res.ok) { console.error("[meta/capi] Purchase falló", order.id, res.error); return; }

    // Marca enviado (idempotencia).
    hist.push({ type: "META_PURCHASE_SENT", ts: new Date().toISOString() });
    await prisma.onlineOrder.update({ where: { id: order.id }, data: { statusHistory: hist as unknown as object } }).catch(() => {});
  } catch (e) {
    console.error("[meta/capi] fireMetaPurchase error", orderId, (e as Error)?.message);
  }
}

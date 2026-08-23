import { NextRequest, NextResponse } from "next/server";
import { confirmMercadoPagoPayment } from "@/lib/payments/mercadopagoConfirm";

export const runtime = "nodejs";

/**
 * Webhook (notification_url) de MercadoPago. Llega como POST con
 * { type:"payment", data:{ id } } y/o query ?type=payment&data.id=…
 * El order id viaja en la query (?order=…) que fijamos en notification_url.
 * Debe responder 200.
 */
async function handle(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("order");
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const type = req.nextUrl.searchParams.get("type") || req.nextUrl.searchParams.get("topic") || (body as { type?: string }).type;
  const paymentId =
    req.nextUrl.searchParams.get("data.id") ||
    req.nextUrl.searchParams.get("id") ||
    ((body as { data?: { id?: string | number } }).data?.id != null ? String((body as { data?: { id?: string | number } }).data!.id) : null);

  if ((type === "payment" || !type) && paymentId) {
    await confirmMercadoPagoPayment(orderId, String(paymentId)).catch((e) => console.error("[ecommerce/mercadopago/confirm]", e));
  }
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) { return handle(req); }
export async function GET(req: NextRequest) { return handle(req); }

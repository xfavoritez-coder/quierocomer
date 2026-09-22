import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) {
    const m = await prisma.teamMember.findUnique({ where: { id: panelId.slice(3) }, select: { restaurantId: true } });
    return m?.restaurantId === restaurantId;
  }
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

/** POST /api/panel/ecommerce/pos-orders/test → dispara un pedido de prueba por el
 *  MISMO endpoint del webhook, usando el token del local. Valida toda la cadena:
 *  auth por token → parser → upsert en BD → tablero en vivo. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { toteatWebhookSecret: true } });
  const token = r?.toteatWebhookSecret;
  if (!token) return NextResponse.json({ error: "Genera primero el token del local." }, { status: 400 });

  // Payload con la forma de un pedido real de Toteat (para ejercitar el parser).
  const externalId = "TEST-" + Date.now();
  const payload = {
    data: [
      {
        orderId: externalId,
        type: "delivery",
        status: "created",
        vendorName: "Prueba",
        orderReference: "TEST",
        comment: "Pedido de prueba de QuieroComer",
        document: {
          customer: {
            name: "Pedido de prueba",
            phoneNumber: "+56990000000",
            delivery: { address: "Av. Siempre Viva 123", city: "Santiago" },
          },
          line: [
            { productName: "Producto de prueba", quantity: 2, unitPriceAfterTax: 3990, amountAfterTax: 7980 },
            { productName: "Delivery", productCode: "TOTEATDVYCOST", quantity: 1, amountAfterTax: 2500 },
          ],
          payments: [{ amount: 10480, amountPaid: 12000, paymentType: 1000 }],
        },
      },
    ],
  };

  const url = `${req.nextUrl.origin}/api/ecommerce/toteat/webhook`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-token": token },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return NextResponse.json({ error: `El webhook respondió ${resp.status}`, detail: data }, { status: 502 });
    return NextResponse.json({ ok: true, webhook: data, externalId });
  } catch (e: any) {
    return NextResponse.json({ error: "No se pudo llamar al webhook: " + (e?.message || "error") }, { status: 502 });
  }
}

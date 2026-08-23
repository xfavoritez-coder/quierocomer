import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dispatchOrderToPos } from "@/lib/ecommerce/pos";

export const runtime = "nodejs";

async function verifyAccess(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId.startsWith("tm_")) {
    const m = await prisma.teamMember.findUnique({ where: { id: panelId.slice(3) }, select: { restaurantId: true } });
    return m?.restaurantId === restaurantId;
  }
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

interface ManualItem {
  product_id: string;
  name: string;
  unit_price: number; // ya viene 0 si es cortesía
  quantity: number;
  toteat_code?: string | null;
  comment?: string;
  courtesy?: boolean;
  courtesyReason?: string;
  options?: { group_id: string; group_name: string; value_id: string; value: string; price_delta: number; toteat_modifier_code?: string | null }[];
}

/**
 * POST /api/panel/ecommerce/manual-order
 * Crea un pedido tomado en mostrador ("Tomar pedidos") dentro del pilar Ecommerce.
 * - source='ecommerce' → aparece en /panel/ecommerce/pedidos (y llega por Realtime).
 * - Queda ACCEPTED (offline, por pagar). Descuento y envío los ingresa el staff.
 * - Opcionalmente lo despacha al POS (Toteat).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      restaurantId, customerName, customerPhone, orderType, deliveryAddress,
      deliveryLat, deliveryLng, items, notes, paymentMethod, discount, deliveryFee, sendToPos,
    } = body as {
      restaurantId?: string; customerName?: string; customerPhone?: string; orderType?: string;
      deliveryAddress?: string; deliveryLat?: number; deliveryLng?: number; items?: ManualItem[];
      notes?: string; paymentMethod?: string; discount?: number; deliveryFee?: number; sendToPos?: boolean;
    };

    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    if (!(await verifyAccess(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    if (!customerName?.trim()) return NextResponse.json({ error: "Falta el nombre del cliente" }, { status: 400 });
    if (!Array.isArray(items) || !items.length) return NextResponse.json({ error: "El pedido no tiene productos" }, { status: 400 });
    if (!paymentMethod) return NextResponse.json({ error: "Falta el medio de pago" }, { status: 400 });

    const isDelivery = orderType === "DELIVERY";

    // Subtotal server-side (nunca confiar en el total del cliente). El staff sí
    // define descuento y envío manualmente (endpoint autenticado por panel).
    const subtotal = Math.round(items.reduce((s, it) => s + Number(it.unit_price) * Number(it.quantity), 0));
    const disc = Math.max(0, Math.round(Number(discount) || 0));
    const fee = isDelivery ? Math.max(0, Math.round(Number(deliveryFee) || 0)) : 0;
    const total = Math.max(0, subtotal + fee - disc);

    // Correlativo por restaurante.
    const orderNumber = (await prisma.onlineOrder.count({ where: { restaurantId } })) + 1;

    // Nota final: notas generales + cortesías (motivo) + comentarios por ítem.
    const extraNotes: string[] = [];
    for (const it of items) {
      if (it.courtesy) extraNotes.push(`🎁 Cortesía: ${it.name}${it.courtesyReason ? ` (${it.courtesyReason})` : ""}`);
      if (it.comment?.trim()) extraNotes.push(`📝 ${it.name}: ${it.comment.trim()}`);
    }
    const finalNotes = [notes?.trim(), ...extraNotes].filter(Boolean).join(" · ") || null;

    // Items en formato superset (visor/panel + POS), igual que el checkout.
    const storedItems = items.map((it) => ({
      dishName: it.name,
      quantity: it.quantity,
      unitTotal: it.unit_price,
      selectedOptions: (it.options ?? []).map((o) => ({ optionName: o.value })),
      courtesy: !!it.courtesy,
      comment: it.comment?.trim() || null,
      // datos para el POS (Toteat)
      name: it.name,
      product_id: it.product_id,
      unit_price: it.unit_price,
      toteat_code: it.toteat_code ?? null,
      options: it.options ?? [],
    }));

    const order = await prisma.onlineOrder.create({
      data: {
        restaurantId,
        source: "ecommerce",
        customerName: String(customerName).trim(),
        customerPhone: customerPhone?.trim() || "",
        customerEmail: null,
        orderType: isDelivery ? "DELIVERY" : "PICKUP",
        deliveryAddress: isDelivery ? (deliveryAddress?.trim() || null) : null,
        paymentMethod,
        paymentStatus: "unpaid",
        paymentGateway: null,
        items: storedItems as unknown as object,
        total,
        deliveryFee: fee,
        discount: disc,
        notes: finalNotes,
        orderNumber,
        status: "ACCEPTED",
        statusHistory: [{ status: "ACCEPTED", ts: new Date().toISOString() }],
      },
    });

    let pos: { ok: boolean; message: string; skipped?: boolean } | null = null;
    if (sendToPos) pos = await dispatchOrderToPos(order.id).catch((e) => ({ ok: false, message: String(e) }));

    return NextResponse.json({ ok: true, orderId: order.id, orderNumber, pos });
  } catch (e) {
    console.error("[ecommerce/manual-order]", e);
    return NextResponse.json({ error: "Error al registrar el pedido" }, { status: 500 });
  }
}

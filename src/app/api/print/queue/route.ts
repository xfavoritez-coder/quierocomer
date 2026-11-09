import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";
import { encodeKitchenComanda, bytesToBase64 } from "@/lib/pos/escpos";

// Comanda de COCINA (letra grande, sin precios) a partir de un pedido de la cola.
// Devuelve el ESC/POS ya renderizado en base64 para que el agente lo imprima crudo.
function kitchenEscposFor(o: {
  id: string; orderNumber: number | null; customerName: string | null; customerPhone: string | null;
  orderType: string; deliveryAddress: string | null; items: unknown;
}): string {
  const rawItems = Array.isArray(o.items) ? (o.items as Record<string, unknown>[]) : [];
  const items = rawItems.map((it) => ({
    quantity: Number(it.quantity) || 1,
    dish_name: String(it.dishName || it.name || "Producto"),
    modifiers: Array.isArray(it.selectedOptions)
      ? (it.selectedOptions as Record<string, unknown>[])
          .filter((op) => op && op.optionName)
          .map((op) => ({ name: String(op.optionName), price_adjustment: 0 }))
      : [],
    note: (typeof it.comment === "string" && it.comment) || (typeof it.notes === "string" && it.notes) || undefined,
  }));
  const bytes = encodeKitchenComanda({
    jobId: "kc_" + o.id,
    type: o.orderType === "DELIVERY" ? "delivery" : "retiro",
    orderLabel: "#" + (o.orderNumber ?? ""),
    customerName: o.customerName || undefined,
    customerPhone: o.customerPhone || undefined,
    customerAddress: o.orderType === "DELIVERY" ? (o.deliveryAddress || undefined) : undefined,
    sentBy: "ecommerce",
    items,
  });
  return bytesToBase64(bytes);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El agente de impresión local (PowerShell) consulta esta cola con su token.
// Devuelve los pedidos de ecommerce REALES (pagados o efectivo/transferencia),
// creados después de generar el token y todavía sin imprimir (printedAt = null).
// GET /api/print/queue?token=XXX
export async function GET(req: NextRequest) {
  const token = (req.nextUrl.searchParams.get("token") || "").trim();
  if (!token) return NextResponse.json({ ok: false, error: "Falta token" }, { status: 400 });

  const restaurant = await prisma.restaurant.findFirst({
    where: { ecommerceStoreConfig: { path: ["printToken"], equals: token } },
    select: { id: true, name: true, ecommerceStoreConfig: true },
  });
  if (!restaurant) return NextResponse.json({ ok: false, error: "Token inválido" }, { status: 401 });

  const cfg = parseStoreConfig(restaurant.ecommerceStoreConfig);
  const since = cfg.printTokenAt ? new Date(cfg.printTokenAt) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const paperWidth = cfg.printPaperWidth === 58 ? 58 : 80;

  // El agente respeta el "Modo de impresión":
  //  - auto: imprime automáticamente cada pedido nuevo (createdAt >= since).
  //  - manual / off (Desactivada): NO auto-imprime; solo reimprime a demanda
  //    cuando el staff toca "Imprimir comanda" (printRequestedAt).
  const autoPrint = cfg.printMode === "auto";
  const availability = autoPrint
    ? [{ createdAt: { gte: since } }, { printRequestedAt: { not: null } }]
    : [{ printRequestedAt: { not: null } }];

  const orders = await prisma.onlineOrder.findMany({
    where: {
      restaurantId: restaurant.id,
      source: "ecommerce",
      printedAt: null,
      status: { not: "CANCELLED" },
      // Pedidos programados aún no liberados: NO se imprimen hasta que el cron los
      // libere (marca scheduledReleasedAt). Un pedido normal no tiene scheduledFor.
      AND: [
        { OR: availability },
        { OR: [{ scheduledFor: null }, { scheduledReleasedAt: { not: null } }] },
        // Solo pedidos REALES: sin gateway (efectivo/transferencia) o con gateway
        // YA pagado. Los intentos de pago online no completados (webpay
        // failed/pending de checkouts abandonados) tienen printedAt=null para
        // siempre; si se filtraran recién en JS (abajo), ocupaban los 20 cupos de
        // la ventana y tapaban los pedidos pagados reales → el agente recibía una
        // cola vacía y dejaba de imprimir. Filtrarlos aquí evita ese atasco.
        { OR: [{ paymentGateway: null }, { paymentStatus: "paid" }] },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: {
      id: true, orderNumber: true, customerName: true, customerPhone: true,
      orderType: true, deliveryAddress: true, paymentMethod: true, paymentStatus: true, paymentGateway: true,
      items: true, total: true, deliveryFee: true, discount: true, couponCode: true, notes: true, createdAt: true,
      reprintTicketOnly: true,
    },
  });

  // Pedidos reencolados "solo ticket" (botón Imprimir ticket del POS): no se les
  // agrega la comanda de cocina aunque el local la tenga activada.
  const ticketOnlyIds = new Set(orders.filter((o) => o.reprintTicketOnly).map((o) => o.id));

  // Excluir intentos de pago online no completados (no son pedidos reales todavía).
  const real = orders.filter((o) => !(o.paymentGateway && o.paymentStatus !== "paid"));

  const mapped = real.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      orderType: o.orderType,
      deliveryAddress: o.deliveryAddress,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      items: o.items,
      total: o.total,
      deliveryFee: o.deliveryFee,
      discount: o.discount,
      couponCode: o.couponCode,
      notes: o.notes,
      createdAt: o.createdAt.toISOString(),
    }));

  // Impresión de prueba: si el dueño la solicitó y el agente aún no la confirmó,
  // anteponemos un ticket sintético (id "test-<printTestAt>") que el agente
  // imprime y confirma en /api/print/ack para no repetirlo.
  const testPending =
    cfg.printTestAt && (!cfg.printTestAckAt || new Date(cfg.printTestAckAt) < new Date(cfg.printTestAt));
  if (testPending) {
    mapped.unshift({
      id: `test-${cfg.printTestAt}`,
      orderNumber: 0,
      customerName: "*** IMPRESION DE PRUEBA ***",
      customerPhone: null,
      orderType: "PICKUP",
      deliveryAddress: null,
      paymentMethod: "efectivo",
      paymentStatus: "paid",
      items: [{ dishName: "Ticket de prueba", quantity: 1, unitTotal: 0 }],
      total: 0,
      deliveryFee: 0,
      discount: 0,
      couponCode: null,
      notes: "Si lees este ticket, el agente de impresion funciona correctamente.",
      createdAt: new Date().toISOString(),
    } as unknown as (typeof mapped)[number]);
  }

  // Copias por comanda: si el local configuró 2 copias, duplicamos cada pedido
  // REAL en la cola (el agente imprime cada entrada una vez → 2 copias). No
  // duplicamos el ticket de prueba.
  // Comanda de cocina: si está activada, agregamos una entrada extra por pedido
  // con el ESC/POS ya renderizado (campo `escpos`), que el agente imprime crudo
  // después de la comanda normal. El id es el mismo del pedido → el ack vale igual.
  const out = mapped.flatMap((o) => {
    const isTest = typeof o.id === "string" && o.id.startsWith("test-");
    if (isTest) return [o];
    const entries: (typeof mapped)[number][] = cfg.printCopies === 2 ? [o, o] : [o];
    if (cfg.kitchenComanda && !ticketOnlyIds.has(o.id)) {
      try {
        const escpos = kitchenEscposFor(o);
        entries.push({ id: o.id, orderNumber: o.orderNumber, escpos } as unknown as (typeof mapped)[number]);
      } catch { /* si falla el render de cocina, no rompemos la comanda normal */ }
    }
    return entries;
  });

  // Config de impresora (el agente la aplica en caliente, sin reinstalar):
  //  default = predeterminada de Windows | name = por nombre | ip = ESC/POS directo a IP:9100
  const printer = { target: cfg.printTarget, name: cfg.printerName, ip: cfg.printerIp };
  // Impresora de cocina (opcional): solo si el local configuró una distinta.
  // El agente enruta las comandas de cocina (las que traen `escpos`) aquí.
  const kitchenPrinter = cfg.kitchenPrintTarget === "same"
    ? null
    : { target: cfg.kitchenPrintTarget, name: cfg.kitchenPrinterName, ip: cfg.kitchenPrinterIp };

  return NextResponse.json({ ok: true, store: restaurant.name, paperWidth, printer, kitchenPrinter, orders: out });
}

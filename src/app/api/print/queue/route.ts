import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";

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

  const orders = await prisma.onlineOrder.findMany({
    where: {
      restaurantId: restaurant.id,
      source: "ecommerce",
      printedAt: null,
      status: { not: "CANCELLED" },
      // Auto-impresión: solo pedidos creados después de instalar el agente (no
      // floodea el histórico). Reimpresión manual (printRequestedAt): sin importar
      // la fecha, para poder reimprimir cualquier pedido a demanda.
      OR: [
        { createdAt: { gte: since } },
        { printRequestedAt: { not: null } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: {
      id: true, orderNumber: true, customerName: true, customerPhone: true,
      orderType: true, deliveryAddress: true, paymentMethod: true, paymentStatus: true, paymentGateway: true,
      items: true, total: true, deliveryFee: true, discount: true, couponCode: true, notes: true, createdAt: true,
    },
  });

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

  // Config de impresora (el agente la aplica en caliente, sin reinstalar):
  //  default = predeterminada de Windows | name = por nombre | ip = ESC/POS directo a IP:9100
  const printer = { target: cfg.printTarget, name: cfg.printerName, ip: cfg.printerIp };

  return NextResponse.json({ ok: true, store: restaurant.name, paperWidth, printer, orders: mapped });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El agente confirma que imprimió una comanda → se marca printedAt para no repetir.
// POST /api/print/ack  { token, orderId }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = (body?.token || "").toString().trim();
  const orderId = (body?.orderId || "").toString().trim();
  if (!token || !orderId) return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 });

  const restaurant = await prisma.restaurant.findFirst({
    where: { ecommerceStoreConfig: { path: ["printToken"], equals: token } },
    select: { id: true, ecommerceStoreConfig: true },
  });
  if (!restaurant) return NextResponse.json({ ok: false, error: "Token inválido" }, { status: 401 });

  // Impresión de prueba: no hay pedido real; marcamos printTestAckAt en la config
  // para que la cola deje de ofrecer el ticket sintético.
  if (orderId.startsWith("test-")) {
    const cfg = parseStoreConfig(restaurant.ecommerceStoreConfig);
    const next = { ...cfg, printTestAckAt: new Date().toISOString() };
    await prisma.restaurant.update({ where: { id: restaurant.id }, data: { ecommerceStoreConfig: next as unknown as object } });
    return NextResponse.json({ ok: true });
  }

  // Solo marca si el pedido pertenece a ese local (evita marcar pedidos ajenos).
  const res = await prisma.onlineOrder.updateMany({
    where: { id: orderId, restaurantId: restaurant.id },
    data: { printedAt: new Date() },
  });
  return NextResponse.json({ ok: res.count > 0 });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
    select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ ok: false, error: "Token inválido" }, { status: 401 });

  // Solo marca si el pedido pertenece a ese local (evita marcar pedidos ajenos).
  const res = await prisma.onlineOrder.updateMany({
    where: { id: orderId, restaurantId: restaurant.id },
    data: { printedAt: new Date() },
  });
  return NextResponse.json({ ok: res.count > 0 });
}

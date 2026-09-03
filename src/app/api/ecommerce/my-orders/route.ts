import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/ecommerce/my-orders?restaurantId=…&limit=3
 * Pedidos del cliente logueado (cookie qr_user_id → su email) en este local.
 * Devuelve los últimos N con sus items (para "volver a pedir").
 */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  const limit = Math.min(20, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 3));
  if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });

  const cookieStore = await cookies();
  const userId = cookieStore.get("qr_user_id")?.value;
  if (!userId) return NextResponse.json({ orders: [] });

  const user = await prisma.qRUser.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user?.email) return NextResponse.json({ orders: [] });

  const orders = await prisma.onlineOrder.findMany({
    where: { restaurantId, source: "ecommerce", customerEmail: { equals: user.email, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, orderNumber: true, total: true, status: true, orderType: true, createdAt: true,
      paymentMethod: true, paymentStatus: true, items: true,
    },
  });

  return NextResponse.json({ orders });
}

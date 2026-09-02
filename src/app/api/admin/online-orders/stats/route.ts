import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId") || undefined;

  const where: any = { status: { not: "CANCELLED" } };
  if (restaurantId) where.restaurantId = restaurantId;

  const allOrders = await prisma.onlineOrder.findMany({
    where,
    select: {
      id: true,
      restaurantId: true,
      customerPhone: true,
      orderType: true,
      paymentMethod: true,
      items: true,
      total: true,
      status: true,
      createdAt: true,
      restaurant: { select: { name: true } },
    },
  });

  // Totales
  const totalOrders = allOrders.length;
  const totalRevenue = allOrders.filter(o => o.status === "DONE").reduce((s, o) => s + o.total, 0);
  const totalRevenueAll = allOrders.reduce((s, o) => s + o.total, 0);
  const deliveryRevenue = allOrders.filter(o => o.status === "DONE" && o.orderType === "DELIVERY").reduce((s, o) => s + o.total, 0);

  // Por estado
  const byStatus: Record<string, number> = {};
  for (const o of allOrders) {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  }

  // Clientes repetidos (por teléfono)
  const phoneCount: Record<string, number> = {};
  for (const o of allOrders) {
    if (o.customerPhone) phoneCount[o.customerPhone] = (phoneCount[o.customerPhone] || 0) + 1;
  }
  const repeatCustomers = Object.values(phoneCount).filter(n => n > 1).length;
  const uniqueCustomers = Object.keys(phoneCount).length;

  // Top platos
  const dishCount: Record<string, number> = {};
  for (const o of allOrders) {
    const items = o.items as { dishName?: string; quantity?: number }[];
    for (const item of items) {
      if (item.dishName) {
        dishCount[item.dishName] = (dishCount[item.dishName] || 0) + (item.quantity || 1);
      }
    }
  }
  const topDishes = Object.entries(dishCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // Por método de pago
  const byPaymentMethod: Record<string, number> = {};
  for (const o of allOrders) {
    const m = o.paymentMethod || "otro";
    byPaymentMethod[m] = (byPaymentMethod[m] || 0) + 1;
  }

  // Por tipo de pedido
  const deliveryCount = allOrders.filter(o => o.orderType === "DELIVERY").length;
  const pickupCount = allOrders.filter(o => o.orderType === "PICKUP").length;

  // Por local (cuando no hay filtro)
  const byRestaurant = !restaurantId
    ? Object.entries(
        allOrders.reduce<Record<string, { name: string; count: number; revenue: number }>>((acc, o) => {
          const id = o.restaurantId;
          if (!acc[id]) acc[id] = { name: o.restaurant.name, count: 0, revenue: 0 };
          acc[id].count += 1;
          if (o.status === "DONE") acc[id].revenue += o.total;
          return acc;
        }, {})
      )
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.count - a.count)
    : [];

  return NextResponse.json({
    totalOrders,
    totalRevenue,
    totalRevenueAll,
    deliveryRevenue,
    byStatus,
    repeatCustomers,
    uniqueCustomers,
    topDishes,
    byPaymentMethod,
    deliveryCount,
    pickupCount,
    byRestaurant,
  });
}

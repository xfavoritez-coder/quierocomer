import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ phone: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { phone } = await params;
  const decodedPhone = decodeURIComponent(phone);

  try {
    // 1. Todos los pedidos de este cliente
    const orders = await prisma.onlineOrder.findMany({
      where: {
        customerPhone: decodedPhone,
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        orderType: true,
        total: true,
        deliveryFee: true,
        discount: true,
        items: true,
        notes: true,
        createdAt: true,
        guestId: true,
        customerName: true,
        customerEmail: true,
        restaurant: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!orders.length) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });

    // 2. Eventos de comportamiento (via guestId)
    const guestIds = [...new Set(orders.map((o) => o.guestId).filter(Boolean) as string[])];

    const storeEvents = guestIds.length
      ? await prisma.statEvent.findMany({
          where: {
            guestId: { in: guestIds },
            eventType: {
              in: [
                "STORE_VIEW",
                "STORE_DISH_VIEW",
                "STORE_CART_ADD",
                "STORE_CART_REMOVE",
                "STORE_CHECKOUT_START",
                "STORE_CHECKOUT_ABANDON",
                "STORE_ORDER_PLACED",
                "STORE_SEARCH",
              ] as any[],
            },
          },
          select: {
            id: true,
            eventType: true,
            createdAt: true,
            metadata: true,
            restaurant: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : [];

    // 3. Platos más pedidos (de items JSON)
    const dishCounts = new Map<string, { name: string; orderCount: number; totalQty: number; totalRevenue: number }>();
    for (const order of orders) {
      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items as any[]) {
        const name: string = item.dishName || item.name || "?";
        const qty = Number(item.quantity) || 1;
        const unit = Number(item.unitTotal || item.unit_price) || 0;
        if (!dishCounts.has(name)) dishCounts.set(name, { name, orderCount: 0, totalQty: 0, totalRevenue: 0 });
        const d = dishCounts.get(name)!;
        d.orderCount++;
        d.totalQty += qty;
        d.totalRevenue += unit * qty;
      }
    }
    const topDishes = Array.from(dishCounts.values()).sort((a, b) => b.totalQty - a.totalQty).slice(0, 10);

    // 4. Platos vistos pero nunca pedidos
    const viewEvents = storeEvents.filter((e) => e.eventType === "STORE_DISH_VIEW");
    const orderedDishNames = new Set(topDishes.map((d) => d.name.toLowerCase()));
    const viewedNotOrdered = new Map<string, { dishName: string; viewCount: number; lastSeen: Date }>();
    for (const e of viewEvents) {
      const meta = e.metadata as any;
      const name: string = meta?.dishName || "?";
      if (orderedDishNames.has(name.toLowerCase())) continue;
      if (!viewedNotOrdered.has(name)) viewedNotOrdered.set(name, { dishName: name, viewCount: 0, lastSeen: e.createdAt });
      viewedNotOrdered.get(name)!.viewCount++;
    }
    const viewedOnlyDishes = Array.from(viewedNotOrdered.values()).sort((a, b) => b.viewCount - a.viewCount).slice(0, 10);

    // 5. Funnel
    const eventCounts = (type: string) => storeEvents.filter((e) => e.eventType === type).length;
    const funnel = {
      storeViews: eventCounts("STORE_VIEW"),
      dishViews: eventCounts("STORE_DISH_VIEW"),
      cartAdds: eventCounts("STORE_CART_ADD"),
      checkoutStarts: eventCounts("STORE_CHECKOUT_START"),
      checkoutAbandons: eventCounts("STORE_CHECKOUT_ABANDON"),
      ordersPlaced: orders.length,
    };

    // 6. Stats resumen
    const totalSpent = orders.reduce((s, o) => s + (o.paymentStatus === "paid" ? o.total : 0), 0);
    const paidOrders = orders.filter((o) => o.paymentStatus === "paid");
    const customer = {
      name: orders[0].customerName,
      email: orders[0].customerEmail,
      phone: decodedPhone,
      firstOrderAt: orders[orders.length - 1].createdAt,
      lastOrderAt: orders[0].createdAt,
      daysSinceLastOrder: Math.floor((Date.now() - new Date(orders[0].createdAt).getTime()) / 86400000),
    };

    return NextResponse.json({
      customer,
      stats: {
        orderCount: orders.length,
        paidOrderCount: paidOrders.length,
        totalSpent,
        avgTicket: paidOrders.length > 0 ? Math.round(totalSpent / paidOrders.length) : 0,
      },
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        orderType: o.orderType,
        total: o.total,
        createdAt: o.createdAt,
        restaurantName: o.restaurant?.name,
        items: o.items,
      })),
      topDishes,
      viewedOnlyDishes,
      funnel,
      storeEvents,
    });
  } catch (e) {
    console.error("[ecommerce-customer-detail]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || undefined;
  const days = Number(req.nextUrl.searchParams.get("days") || "30");
  const since = new Date(Date.now() - days * 86400000);

  try {
    const orderWhere: any = {
      status: { not: "CANCELLED" },
      paymentStatus: { in: ["paid", "unpaid"] },
      createdAt: { gte: since },
      ...(restaurantId ? { restaurantId } : {}),
    };

    // Orders in period
    const orders = await prisma.onlineOrder.findMany({
      where: orderWhere,
      select: {
        id: true,
        total: true,
        paymentStatus: true,
        orderType: true,
        paymentMethod: true,
        customerPhone: true,
        createdAt: true,
        guestId: true,
        items: true,
        restaurant: { select: { id: true, name: true } },
      },
    });

    // Revenue & counts
    const paidOrders = orders.filter(o => o.paymentStatus === "paid");
    const totalRevenue = paidOrders.reduce((s, o) => s + o.total, 0);
    const uniqueCustomers = new Set(orders.map(o => o.customerPhone)).size;
    const repeatCustomers = (() => {
      const counts = new Map<string, number>();
      for (const o of orders) counts.set(o.customerPhone, (counts.get(o.customerPhone) || 0) + 1);
      return Array.from(counts.values()).filter(c => c > 1).length;
    })();

    // Top dishes
    const dishCounts = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of orders) {
      const items = Array.isArray(o.items) ? o.items : [];
      for (const item of items as any[]) {
        const name: string = item.dishName || item.name || "?";
        const qty = Number(item.quantity) || 1;
        const unit = Number(item.unitTotal || item.unit_price) || 0;
        if (!dishCounts.has(name)) dishCounts.set(name, { name, qty: 0, revenue: 0 });
        const d = dishCounts.get(name)!;
        d.qty += qty;
        d.revenue += unit * qty;
      }
    }
    const topDishes = Array.from(dishCounts.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);

    // Orders by day (for chart)
    const byDay = new Map<string, { orders: number; revenue: number }>();
    for (const o of orders) {
      const day = new Date(o.createdAt).toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { orders: 0, revenue: 0 });
      const d = byDay.get(day)!;
      d.orders++;
      if (o.paymentStatus === "paid") d.revenue += o.total;
    }
    const ordersChart = Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, ...v }));

    // Peak hours
    const hourCounts = new Array(24).fill(0);
    for (const o of paidOrders) {
      hourCounts[new Date(o.createdAt).getHours()]++;
    }
    const peakHours = hourCounts.map((count, hour) => ({ hour, count }));

    // Order type breakdown
    const pickupCount = orders.filter(o => o.orderType === "PICKUP").length;
    const deliveryCount = orders.filter(o => o.orderType === "DELIVERY").length;

    // Payment method breakdown
    const byPaymentMethod: Record<string, number> = {};
    for (const o of orders) {
      byPaymentMethod[o.paymentMethod] = (byPaymentMethod[o.paymentMethod] || 0) + 1;
    }

    // By restaurant (if superadmin + no filter)
    const byRestaurant = !restaurantId
      ? (() => {
          const map = new Map<string, { name: string; orders: number; revenue: number }>();
          for (const o of orders) {
            const id = o.restaurant.id;
            if (!map.has(id)) map.set(id, { name: o.restaurant.name, orders: 0, revenue: 0 });
            const r = map.get(id)!;
            r.orders++;
            if (o.paymentStatus === "paid") r.revenue += o.total;
          }
          return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }))
            .sort((a, b) => b.revenue - a.revenue).slice(0, 10);
        })()
      : [];

    // Behavioral funnel from StatEvents
    const guestIds = [...new Set(orders.map(o => o.guestId).filter(Boolean) as string[])];
    const eventWhere: any = {
      createdAt: { gte: since },
      eventType: { in: ["STORE_VIEW", "STORE_DISH_VIEW", "STORE_CART_ADD", "STORE_CHECKOUT_START", "STORE_CHECKOUT_ABANDON", "STORE_ORDER_PLACED", "STORE_SEARCH"] as any[] },
      ...(restaurantId ? { restaurantId } : {}),
    };
    const eventCounts = await prisma.statEvent.groupBy({
      by: ["eventType"],
      where: eventWhere,
      _count: { _all: true },
    });
    const funnel: Record<string, number> = {};
    for (const e of eventCounts) funnel[e.eventType as string] = e._count._all;

    // Abandoned carts with cart contents
    const abandonEvents = await prisma.statEvent.findMany({
      where: {
        ...eventWhere,
        eventType: "STORE_CHECKOUT_ABANDON" as any,
      },
      select: { id: true, metadata: true, createdAt: true, restaurant: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const abandonedCarts = abandonEvents.map(e => {
      const meta = e.metadata as any;
      const items = meta?.items || [];
      const totalValue = items.reduce((s: number, i: any) => s + (Number(i.unit_price) || 0) * (Number(i.quantity) || 1), 0);
      return { id: e.id, restaurantName: e.restaurant?.name, totalValue, itemCount: items.length, items, createdAt: e.createdAt };
    });
    const abandonedValue = abandonedCarts.reduce((s, c) => s + c.totalValue, 0);

    // Searches with 0 results
    const searchEvents = await prisma.statEvent.findMany({
      where: { ...eventWhere, eventType: "STORE_SEARCH" as any },
      select: { metadata: true },
      take: 500,
    });
    const searchCounts = new Map<string, number>();
    for (const e of searchEvents) {
      const q = (e.metadata as any)?.query?.toLowerCase?.() || "";
      if (q) searchCounts.set(q, (searchCounts.get(q) || 0) + 1);
    }
    const topSearches = Array.from(searchCounts.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 20)
      .map(([query, count]) => ({ query, count }));

    return NextResponse.json({
      period: { days, since },
      overview: {
        totalOrders: orders.length,
        paidOrders: paidOrders.length,
        totalRevenue,
        avgTicket: paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0,
        uniqueCustomers,
        repeatCustomers,
        repeatRate: uniqueCustomers > 0 ? Math.round(repeatCustomers / uniqueCustomers * 100) : 0,
        pickupCount,
        deliveryCount,
      },
      funnel,
      topDishes,
      ordersChart,
      peakHours,
      byPaymentMethod,
      byRestaurant,
      abandonedCarts: abandonedCarts.slice(0, 20),
      abandonedValue,
      topSearches,
    });
  } catch (e) {
    console.error("[ecommerce-dashboard]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

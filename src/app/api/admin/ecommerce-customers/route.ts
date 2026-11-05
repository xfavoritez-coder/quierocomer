import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const search = req.nextUrl.searchParams.get("search") || "";
    const page = Number(req.nextUrl.searchParams.get("page") || "1");
    const limit = 40;

    // Agrupar pedidos por teléfono: stats consolidadas por cliente.
    // Usamos raw aggregation porque Prisma groupBy no permite orderBy por agregados en todos los casos.
    const where: any = {
      status: { not: "CANCELLED" },
      paymentStatus: { in: ["paid", "unpaid"] }, // excluir pedidos abortados
    };
    if (search) {
      where.OR = [
        { customerPhone: { contains: search } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
      ];
    }

    // Obtener todos los pedidos válidos para agregar (paginación manual por cliente único)
    const allOrders = await prisma.onlineOrder.findMany({
      where,
      select: {
        customerPhone: true,
        customerName: true,
        customerEmail: true,
        total: true,
        createdAt: true,
        guestId: true,
        restaurantId: true,
        restaurant: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Agrupar por teléfono en JS (más flexible que groupBy de Prisma)
    const customerMap = new Map<string, {
      phone: string; name: string | null; email: string | null;
      orderCount: number; totalSpent: number;
      firstOrderAt: Date; lastOrderAt: Date;
      guestIds: Set<string>; restaurants: Set<string>;
    }>();

    for (const o of allOrders) {
      const phone = o.customerPhone;
      if (!customerMap.has(phone)) {
        customerMap.set(phone, {
          phone,
          name: o.customerName || null,
          email: o.customerEmail || null,
          orderCount: 0,
          totalSpent: 0,
          firstOrderAt: o.createdAt,
          lastOrderAt: o.createdAt,
          guestIds: new Set(),
          restaurants: new Set(),
        });
      }
      const c = customerMap.get(phone)!;
      c.orderCount++;
      c.totalSpent += o.total;
      if (o.createdAt < c.firstOrderAt) c.firstOrderAt = o.createdAt;
      if (o.createdAt > c.lastOrderAt) c.lastOrderAt = o.createdAt;
      if (o.guestId) c.guestIds.add(o.guestId);
      if (o.restaurant?.name) c.restaurants.add(o.restaurant.name);
      // Usar el nombre y email más recientes
      if (!c.name && o.customerName) c.name = o.customerName;
      if (!c.email && o.customerEmail) c.email = o.customerEmail;
    }

    // Ordenar por último pedido (más reciente primero)
    const sorted = Array.from(customerMap.values()).sort(
      (a, b) => b.lastOrderAt.getTime() - a.lastOrderAt.getTime()
    );

    const totalCustomers = sorted.length;
    const totalRevenue = sorted.reduce((s, c) => s + c.totalSpent, 0);
    const avgTicket = totalCustomers > 0 ? Math.round(totalRevenue / allOrders.length) : 0;
    const repeatCustomers = sorted.filter((c) => c.orderCount > 1).length;

    // Paginación
    const start = (page - 1) * limit;
    const paginated = sorted.slice(start, start + limit).map((c) => ({
      phone: c.phone,
      name: c.name,
      email: c.email,
      orderCount: c.orderCount,
      totalSpent: c.totalSpent,
      avgTicket: Math.round(c.totalSpent / c.orderCount),
      firstOrderAt: c.firstOrderAt,
      lastOrderAt: c.lastOrderAt,
      guestIds: Array.from(c.guestIds),
      restaurants: Array.from(c.restaurants),
    }));

    return NextResponse.json({
      customers: paginated,
      total: totalCustomers,
      pages: Math.ceil(totalCustomers / limit),
      overview: { totalCustomers, totalRevenue, avgTicket, repeatCustomers },
    });
  } catch (e) {
    console.error("[ecommerce-customers]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

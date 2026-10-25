import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";
import { chileDayRangeUtc } from "@/lib/driver/serialize";

const ONLINE_METHODS = ["webpay", "flow", "mercadopago"];

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const restaurantId = searchParams.get("restaurantId");
  const slug = searchParams.get("slug");
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 50;

  let resId = restaurantId;
  if (!resId && slug) {
    const r = await prisma.restaurant.findUnique({ where: { slug }, select: { id: true } });
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
    resId = r.id;
  }

  const where: any = {};
  if (resId) where.restaurantId = resId;
  if (status) where.status = status;
  const and: any[] = [];
  // Por defecto oculta los intentos de pago online no completados (Webpay fallido/pendiente).
  const includeFailed = searchParams.get("includeFailed") === "1";
  if (!includeFailed) {
    and.push({ OR: [{ paymentStatus: "paid" }, { paymentMethod: { notIn: ONLINE_METHODS } }] });
  }
  // Búsqueda por cliente / teléfono / restaurante (en TODOS los pedidos, no solo la página).
  const q = (searchParams.get("q") || "").trim();
  if (q) {
    const qDigits = q.replace(/\D/g, "");
    const or: any[] = [
      { customerName: { contains: q, mode: "insensitive" } },
      { restaurant: { name: { contains: q, mode: "insensitive" } } },
    ];
    if (qDigits.length >= 3) or.push({ customerPhone: { contains: qDigits } });
    and.push({ OR: or });
  }
  if (and.length) where.AND = and;
  const month = searchParams.get("month"); // YYYY-MM
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const start = chileDayRangeUtc(`${month}-01`).start;
    const end = chileDayRangeUtc(`${month}-${String(daysInMonth).padStart(2, "0")}`).end;
    where.createdAt = { gte: start, lte: end }; // corte del mes en hora de Chile
  }

  const [orders, total] = await Promise.all([
    prisma.onlineOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { restaurant: { select: { name: true, slug: true } } },
    }),
    prisma.onlineOrder.count({ where }),
  ]);

  return NextResponse.json({ orders, total, page, pages: Math.ceil(total / limit) });
}

export async function PATCH(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { id, status } = await req.json();
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });

  const order = await prisma.onlineOrder.update({ where: { id }, data: { status } });
  return NextResponse.json(order);
}

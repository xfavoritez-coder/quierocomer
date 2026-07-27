import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

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

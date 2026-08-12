import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurantId, restaurantSlug, customerName, customerPhone, customerEmail, orderType, deliveryAddress, paymentMethod, items, total, notes } = body;

    if (!restaurantId && !restaurantSlug) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });
    if (!customerName || !customerPhone || !orderType || !paymentMethod || !items || total == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let resId = restaurantId;
    if (!resId && restaurantSlug) {
      const r = await prisma.restaurant.findUnique({ where: { slug: restaurantSlug }, select: { id: true } });
      if (!r) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
      resId = r.id;
    }

    const order = await prisma.onlineOrder.create({
      data: {
        restaurantId: resId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail?.trim() || null,
        orderType,
        deliveryAddress: deliveryAddress?.trim() || null,
        paymentMethod,
        items,
        total: Math.round(total),
        notes: notes?.trim() || null,
        status: "PENDING",
      },
    });

    return NextResponse.json({ id: order.id });
  } catch (e) {
    console.error("[POST /api/orders]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

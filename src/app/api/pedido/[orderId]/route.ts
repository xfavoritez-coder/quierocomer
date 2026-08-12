import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const order = await prisma.onlineOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerName: true,
      orderType: true,
      deliveryAddress: true,
      paymentMethod: true,
      items: true,
      total: true,
      notes: true,
      cancellationReason: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      restaurant: {
        select: {
          name: true,
          logoUrl: true,
          orderingWaitTime: true,
          whatsapp: true,
          phone: true,
        },
      },
    },
  });

  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

  return NextResponse.json({
    id: order.id,
    restaurantName: order.restaurant.name,
    restaurantLogoUrl: order.restaurant.logoUrl ?? null,
    customerName: order.customerName,
    orderType: order.orderType as "PICKUP" | "DELIVERY",
    items: order.items,
    total: order.total,
    deliveryAddress: order.deliveryAddress ?? null,
    paymentMethod: order.paymentMethod,
    status: order.status,
    notes: order.notes ?? null,
    cancellationReason: order.cancellationReason ?? null,
    estimatedTime: order.restaurant.orderingWaitTime ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    restaurantPhone: order.restaurant.whatsapp || order.restaurant.phone || null,
  });
}

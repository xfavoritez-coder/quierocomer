import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSetting } from "@/lib/platformSettings";
import { parseTrackingTexts } from "@/lib/ecommerce/trackingTexts";
import { parseStoreConfig } from "@/lib/ecommerce/store-config";

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
      orderNumber: true,
      customerName: true,
      orderType: true,
      deliveryAddress: true,
      paymentMethod: true,
      paymentStatus: true,
      paymentGateway: true,
      items: true,
      total: true,
      notes: true,
      cancellationReason: true,
      status: true,
      statusHistory: true,
      scheduledFor: true,
      createdAt: true,
      updatedAt: true,
      restaurant: {
        select: {
          name: true,
          slug: true,
          logoUrl: true,
          orderingWaitTime: true,
          whatsapp: true,
          phone: true,
          cartaColorMode: true,
          cartaAccentColor: true,
          ecommerceStoreConfig: true,
        },
      },
    },
  });

  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

  // Auto-avance: si el local lo activó, al abrir el seguimiento el pedido pasa
  // de ACCEPTED a PREPARING (solo una vez; después queda en PREPARING).
  let status = order.status;
  let statusHistory = Array.isArray(order.statusHistory) ? (order.statusHistory as unknown[]) : [];
  try {
    const cfg = parseStoreConfig(order.restaurant.ecommerceStoreConfig);
    if (cfg.autoPreparingOnTrack && order.status === "ACCEPTED") {
      status = "PREPARING";
      statusHistory = [...statusHistory, { status: "PREPARING", ts: new Date().toISOString(), auto: "track" }];
      await prisma.onlineOrder.update({ where: { id: order.id }, data: { status, statusHistory: statusHistory as unknown as object } });
    }
  } catch { /* noop: no bloquear el seguimiento por esto */ }

  // Textos configurables del seguimiento (superadmin en /admin/ajustes)
  let trackingTexts;
  try {
    const raw = await getPlatformSetting("tracking_texts");
    trackingTexts = parseTrackingTexts(raw ? JSON.parse(raw) : null);
  } catch {
    trackingTexts = parseTrackingTexts(null);
  }

  return NextResponse.json({
    trackingTexts,
    id: order.id,
    orderNumber: order.orderNumber ?? null,
    restaurantName: order.restaurant.name,
    restaurantLogoUrl: order.restaurant.logoUrl ?? null,
    restaurantFaviconUrl: parseStoreConfig(order.restaurant.ecommerceStoreConfig).faviconUrl,
    customerName: order.customerName,
    orderType: order.orderType as "PICKUP" | "DELIVERY",
    items: order.items,
    total: order.total,
    deliveryAddress: order.deliveryAddress ?? null,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus ?? null,
    paymentGateway: order.paymentGateway ?? null,
    restaurantSlug: order.restaurant.slug,
    status,
    statusHistory,
    scheduledFor: order.scheduledFor ? order.scheduledFor.toISOString() : null,
    notes: order.notes ?? null,
    cancellationReason: order.cancellationReason ?? null,
    estimatedTime: order.restaurant.orderingWaitTime ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    restaurantPhone: order.restaurant.whatsapp || order.restaurant.phone || null,
    colorMode: order.restaurant.cartaColorMode ?? "LIGHT",
    accentColor: order.restaurant.cartaAccentColor ?? null,
  });
}

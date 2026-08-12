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

    // Business hours check (Chile timezone)
    const restaurant = await prisma.restaurant.findUnique({ where: { id: resId }, select: { orderingBusinessHours: true } });
    const rawBH = (restaurant as any)?.orderingBusinessHours;
    if (rawBH && typeof rawBH === "object") {
      const chileNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
      const day = String(chileNow.getDay());
      const dayConfig = (rawBH as any)[day];
      if (!dayConfig || !dayConfig.open) {
        return NextResponse.json({ error: "El local está cerrado" }, { status: 409 });
      } else {
        const nowMins = chileNow.getHours() * 60 + chileNow.getMinutes();
        const parseMins = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
        const fromMins = parseMins(dayConfig.from || "00:00");
        const rawTo = dayConfig.to || "23:59";
        const toMins = rawTo === "00:00" ? 1440 : parseMins(rawTo);
        const isClosed = fromMins <= toMins
          ? nowMins < fromMins || nowMins >= toMins
          : nowMins < fromMins && nowMins >= toMins;
        if (isClosed) {
          return NextResponse.json({ error: "El local está cerrado" }, { status: 409 });
        }
      }
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
        statusHistory: [{ status: "PENDING", ts: new Date().toISOString() }],
      },
    });

    // Send push notifications to subscribed panel devices (non-blocking)
    prisma.orderPushSubscription.findMany({ where: { restaurantId: resId, isActive: true } })
      .then(async (subs) => {
        if (subs.length === 0) return;
        const { sendOrderNotification } = await import("@/lib/qr/utils/orderPush");
        for (const sub of subs) {
          try {
            await sendOrderNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              order.id,
              customerName.trim(),
              Math.round(total),
              orderType
            );
          } catch (e: any) {
            if (e?.statusCode === 410) {
              await prisma.orderPushSubscription.update({ where: { id: sub.id }, data: { isActive: false } });
            }
          }
        }
      })
      .catch(() => {});

    return NextResponse.json({ id: order.id });
  } catch (e) {
    console.error("[POST /api/orders]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

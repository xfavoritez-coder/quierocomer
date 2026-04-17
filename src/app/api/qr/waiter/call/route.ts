import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { restaurantId, tableId, tableName, dietType, restrictions } = await request.json();

    if (!restaurantId) {
      return NextResponse.json({ error: "Missing restaurantId" }, { status: 400 });
    }

    // 1. Save the call first — this always works
    const waiterCall = await prisma.waiterCall.create({
      data: {
        restaurantId,
        tableId: tableId && tableId !== "general" && tableId !== "test" ? tableId : null,
        tableName: tableName || "Cliente",
        dietType: dietType || null,
        restrictions: restrictions || null,
        calledAt: new Date(),
      },
    });

    // 2. Try to send push notifications (non-blocking)
    let pushSent = 0;
    let pushError = null;
    try {
      const { sendWaiterNotification } = await import("@/lib/qr/utils/webpush");

      const subs = await prisma.waiterPushSubscription.findMany({
        where: { restaurantId, isActive: true },
      });

      for (const sub of subs) {
        try {
          await sendWaiterNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            waiterCall.id,
            tableName || "Cliente",
            restaurantId
          );
          pushSent++;
        } catch (e: any) {
          if (e?.statusCode === 410) {
            await prisma.waiterPushSubscription.update({
              where: { id: sub.id },
              data: { isActive: false },
            });
          }
          pushError = e?.message || String(e);
        }
      }
    } catch (e: any) {
      pushError = e?.message || String(e);
    }

    return NextResponse.json({ ok: true, callId: waiterCall.id, pushSent, pushError, subsCount: await prisma.waiterPushSubscription.count({ where: { restaurantId, isActive: true } }) });
  } catch (error) {
    console.error("Waiter call error:", error);
    return NextResponse.json({ error: "Failed to call waiter" }, { status: 500 });
  }
}

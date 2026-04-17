import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const restaurantId = url.searchParams.get("restaurantId");
    if (!restaurantId) return NextResponse.json({ active: false });

    const count = await prisma.waiterPushSubscription.count({
      where: { restaurantId, isActive: true },
    });

    return NextResponse.json({ active: count > 0 });
  } catch {
    return NextResponse.json({ active: false });
  }
}

export async function POST(request: Request) {
  try {
    const { restaurantId, subscription } = await request.json();

    if (!restaurantId || !subscription?.endpoint || !subscription?.keys) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    await prisma.waiterPushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        isActive: true,
        restaurantId,
      },
      create: {
        restaurantId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Subscribe error:", error);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}

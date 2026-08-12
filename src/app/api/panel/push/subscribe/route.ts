import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function verifyAccess(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId.startsWith("tm_")) {
    const m = await prisma.teamMember.findUnique({ where: { id: panelId.slice(3) }, select: { restaurantId: true } });
    return m?.restaurantId === restaurantId;
  }
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

// POST: subscribe
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.restaurantId || !body?.subscription?.endpoint) {
    return NextResponse.json({ error: "restaurantId y subscription requeridos" }, { status: 400 });
  }
  const allowed = await verifyAccess(req, body.restaurantId);
  if (!allowed) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { endpoint, keys } = body.subscription;
  await prisma.orderPushSubscription.upsert({
    where: { endpoint },
    create: {
      restaurantId: body.restaurantId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      isActive: true,
    },
    update: { isActive: true, restaurantId: body.restaurantId },
  });
  return NextResponse.json({ ok: true });
}

// DELETE: unsubscribe
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.endpoint) return NextResponse.json({ error: "endpoint requerido" }, { status: 400 });
  await prisma.orderPushSubscription.updateMany({
    where: { endpoint: body.endpoint },
    data: { isActive: false },
  });
  return NextResponse.json({ ok: true });
}

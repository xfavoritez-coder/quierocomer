import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { endpoint, p256dh, auth } = await req.json();
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Missing subscription data" }, { status: 400 });
    }

    await prisma.adminPushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, p256dh, auth, isActive: true },
      update: { p256dh, auth, isActive: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Admin Push Subscribe]", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { endpoint } = await req.json();
    if (endpoint) {
      await prisma.adminPushSubscription.updateMany({
        where: { endpoint },
        data: { isActive: false },
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

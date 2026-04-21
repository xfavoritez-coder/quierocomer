import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { callId } = await request.json();

    if (!callId) {
      return NextResponse.json({ error: "Missing callId" }, { status: 400 });
    }

    // Fetch the call to verify it exists and get restaurantId
    const call = await prisma.waiterCall.findUnique({
      where: { id: callId },
      select: { id: true, restaurantId: true, answeredAt: true },
    });

    if (!call) {
      return NextResponse.json({ error: "Llamado no encontrado" }, { status: 404 });
    }

    if (call.answeredAt) {
      return NextResponse.json({ error: "Llamado ya fue respondido" }, { status: 400 });
    }

    await prisma.waiterCall.update({
      where: { id: callId },
      data: { answeredAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Answer error:", error);
    return NextResponse.json({ error: "Failed to answer" }, { status: 500 });
  }
}

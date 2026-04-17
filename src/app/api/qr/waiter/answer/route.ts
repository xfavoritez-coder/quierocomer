import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { callId } = await request.json();

    if (!callId) {
      return NextResponse.json({ error: "Missing callId" }, { status: 400 });
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

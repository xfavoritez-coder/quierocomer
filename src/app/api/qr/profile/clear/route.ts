import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { guestId } = await request.json();
    if (!guestId) return NextResponse.json({ error: "Missing guestId" }, { status: 400 });

    await prisma.guestProfile.update({
      where: { id: guestId },
      data: { preferences: {} },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Silently ignore if guest doesn't exist
  }
}

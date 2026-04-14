import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest) {
  try {
    const { userId, fotoUrl } = await req.json();
    if (!userId) return NextResponse.json({ error: "Falta userId" }, { status: 400 });

    await prisma.usuario.update({
      where: { id: userId },
      data: { fotoUrl: fotoUrl || "" },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[API usuarios/foto PUT]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

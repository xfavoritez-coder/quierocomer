import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { usuarioId, estiloAlimentario, comidasFavoritas } = await req.json();
    if (!usuarioId) return NextResponse.json({ error: "Falta usuarioId" }, { status: 400 });

    await prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        ...(estiloAlimentario !== undefined && { estiloAlimentario }),
        ...(comidasFavoritas !== undefined && { comidasFavoritas }),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const interaction = await prisma.interaction.findUnique({
      where: { id },
      select: {
        menuItem: { select: { id: true, nombre: true, imagenUrl: true } },
      },
    });
    if (!interaction) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

    return NextResponse.json({
      nombre: interaction.menuItem.nombre,
      imagenUrl: interaction.menuItem.imagenUrl,
      menuItemId: interaction.menuItem.id,
    });
  } catch {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

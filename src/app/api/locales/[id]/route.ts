import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const local = await prisma.local.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: { menuItems: { where: { isAvailable: true }, orderBy: { categoria: "asc" } } },
    });
    if (!local) return NextResponse.json({ error: "Local no encontrado" }, { status: 404 });
    const { password: _, ...safe } = local as Record<string, unknown>;
    return NextResponse.json(safe);
  } catch (error) {
    console.error("[API /locales/[id]]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const comuna = searchParams.get("comuna");

    const where: any = { activo: true };
    if (comuna) where.comuna = comuna;
    if (q) {
      where.OR = [
        { nombre: { contains: q, mode: "insensitive" } },
        { comuna: { contains: q, mode: "insensitive" } },
        { descripcion: { contains: q, mode: "insensitive" } },
      ];
    }

    const locales = await prisma.local.findMany({
      where,
      select: {
        id: true, slug: true, nombre: true, categorias: true, comuna: true,
        logoUrl: true, portadaUrl: true, direccion: true, lat: true, lng: true,
        linkPedido: true, _count: { select: { menuItems: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(locales);
  } catch (error) {
    console.error("[API /locales GET]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

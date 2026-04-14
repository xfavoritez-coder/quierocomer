import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const { isAvailable } = await req.json();

    const dish = await prisma.menuItem.update({
      where: { id },
      data: { isAvailable: !!isAvailable },
    });

    return NextResponse.json({ id: dish.id, isAvailable: dish.isAvailable });
  } catch (e) {
    console.error("[Admin dishes availability]", e);
    return NextResponse.json({ error: "Error al actualizar disponibilidad" }, { status: 500 });
  }
}

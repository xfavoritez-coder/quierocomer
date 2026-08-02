import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/admin/lead/[id]/nuke
 * Elimina completamente un lead y su cuenta asociada (owner + restaurant + cascades).
 * Usado en funnel admin para eliminar registros de spam o competencia.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  try {
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { convertedToOwnerId: true },
    });

    if (!lead) {
      return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
    }

    // If linked to an owner, delete their restaurants first (cascades dishes, sessions, etc.)
    if (lead.convertedToOwnerId) {
      const restaurants = await prisma.restaurant.findMany({
        where: { ownerId: lead.convertedToOwnerId },
        select: { id: true },
      });

      for (const r of restaurants) {
        await prisma.restaurant.delete({ where: { id: r.id } });
      }

      await prisma.restaurantOwner.delete({
        where: { id: lead.convertedToOwnerId },
      });
    }

    await prisma.lead.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[nuke] error:", err);
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 });
  }
}

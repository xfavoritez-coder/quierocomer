import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  try {
    const { id } = await params;
    await prisma.franBitacora.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[fran/bitacora DELETE]", error);
    return NextResponse.json(
      { error: "Error al eliminar entrada" },
      { status: 500 }
    );
  }
}

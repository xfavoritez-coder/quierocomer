import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) {
    return NextResponse.json({ error: "Solo super-admin puede eliminar usuarios" }, { status: 403 });
  }

  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

    const user = await prisma.qRUser.findUnique({ where: { id }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    // Unlink references (keep historical data, just disassociate)
    await prisma.guestProfile.updateMany({ where: { linkedQrUserId: id }, data: { linkedQrUserId: null, convertedToUserAt: null } });
    await prisma.session.updateMany({ where: { qrUserId: id }, data: { qrUserId: null } });
    await prisma.statEvent.updateMany({ where: { qrUserId: id }, data: { qrUserId: null } });
    await prisma.dishFavorite.updateMany({ where: { qrUserId: id }, data: { qrUserId: null } });
    await prisma.experienceSubmission.updateMany({ where: { qrUserId: id }, data: { qrUserId: null } });

    // Delete records that require the user (no FK to keep)
    await prisma.qRMagicToken.deleteMany({ where: { userId: id } });
    await prisma.qRUserInteraction.deleteMany({ where: { userId: id } });
    await prisma.campaignRecipient.deleteMany({ where: { qrUserId: id } });

    await prisma.qRUser.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("QRUser delete error:", e);
    return NextResponse.json({ error: e?.message || "Error al eliminar" }, { status: 500 });
  }
}

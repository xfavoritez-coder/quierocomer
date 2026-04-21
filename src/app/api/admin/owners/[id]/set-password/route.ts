import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

/** Superadmin sets a new password directly for an owner */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const { id } = await params;
    const { newPassword } = await req.json();

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }

    const existing = await prisma.restaurantOwner.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ error: "Owner no encontrado" }, { status: 404 });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.restaurantOwner.update({
      where: { id },
      data: { passwordHash, resetToken: null, resetTokenExpiry: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Set password error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

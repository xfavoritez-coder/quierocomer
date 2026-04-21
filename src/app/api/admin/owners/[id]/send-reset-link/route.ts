import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { sendAdminEmail, resetPasswordEmailHtml } from "@/lib/email/sendAdminEmail";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";

/** Superadmin sends a reset link to an owner (bypasses rate limit) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const { id } = await params;

    const owner = await prisma.restaurantOwner.findUnique({
      where: { id },
      select: { id: true, email: true, name: true },
    });
    if (!owner) return NextResponse.json({ error: "Owner no encontrado" }, { status: 404 });

    const rawToken = crypto.randomUUID();
    const hashedToken = await bcrypt.hash(rawToken, 10);
    const expiry = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.restaurantOwner.update({
      where: { id },
      data: { resetToken: hashedToken, resetTokenExpiry: expiry },
    });

    const resetLink = `${BASE_URL}/admin/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(owner.email)}`;
    const firstName = owner.name.split(" ")[0];

    await sendAdminEmail({
      to: owner.email,
      subject: "Recuperar contraseña · QuieroComer",
      html: resetPasswordEmailHtml(firstName, resetLink),
      purpose: "password_reset",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Send reset link error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

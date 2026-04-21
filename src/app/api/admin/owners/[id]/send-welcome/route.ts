import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { sendAdminEmail, welcomeOwnerEmailHtml } from "@/lib/email/sendAdminEmail";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";

/** Superadmin sends a welcome email with password setup link */
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

    const resetLink = `${BASE_URL}/panel/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(owner.email)}`;
    const firstName = owner.name.split(" ")[0];

    await sendAdminEmail({
      to: owner.email,
      subject: "Tu panel de administración está listo · QuieroComer",
      html: welcomeOwnerEmailHtml(firstName, owner.email, resetLink),
      purpose: "welcome",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Send welcome error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimit, RATE_LIMITS, getClientIp, formatRetryAfter } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(req);
    const rl = rateLimit(`reset:${ip}`, RATE_LIMITS.resetPassword);
    if (!rl.success) {
      return NextResponse.json(
        { error: `Demasiados intentos. Intenta de nuevo en ${formatRetryAfter(rl.retryAfterMs)}.` },
        { status: 429 },
      );
    }

    const { email, token, newPassword } = await req.json();
    if (!email || !token || !newPassword) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    // Validate password
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }
    if (!/\d/.test(newPassword)) {
      return NextResponse.json({ error: "La contraseña debe contener al menos 1 número" }, { status: 400 });
    }

    const owner = await prisma.restaurantOwner.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, resetToken: true, resetTokenExpiry: true },
    });

    if (!owner || !owner.resetToken || !owner.resetTokenExpiry) {
      return NextResponse.json({ error: "Link inválido o expirado" }, { status: 400 });
    }

    // Check expiry first
    if (new Date() > owner.resetTokenExpiry) {
      return NextResponse.json({ error: "Link expirado, solicita uno nuevo" }, { status: 400 });
    }

    // Validate token
    const tokenValid = await bcrypt.compare(token, owner.resetToken);
    if (!tokenValid) {
      return NextResponse.json({ error: "Link inválido o expirado" }, { status: 400 });
    }

    // Update password and clear token
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.restaurantOwner.update({
      where: { id: owner.id },
      data: { passwordHash, resetToken: null, resetTokenExpiry: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

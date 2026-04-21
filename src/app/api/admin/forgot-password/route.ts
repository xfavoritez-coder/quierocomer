import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { rateLimit, RATE_LIMITS, getClientIp, formatRetryAfter } from "@/lib/rateLimit";
import { sendAdminEmail, resetPasswordEmailHtml } from "@/lib/email/sendAdminEmail";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(req);
    const rl = rateLimit(`forgot:${ip}`, RATE_LIMITS.forgotPassword);
    if (!rl.success) {
      return NextResponse.json(
        { error: `Demasiados intentos. Intenta de nuevo en ${formatRetryAfter(rl.retryAfterMs)}.` },
        { status: 429 },
      );
    }

    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email requerido" }, { status: 400 });
    }

    // Generic success message — never reveal if email exists
    const genericResponse = {
      success: true,
      message: "Si el email existe, recibirás un link de recuperación.",
    };

    const owner = await prisma.restaurantOwner.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, name: true, email: true, status: true },
    });

    // Don't reveal if email doesn't exist
    if (!owner) {
      return NextResponse.json(genericResponse);
    }

    // Don't send to suspended/pending accounts (but don't reveal status)
    if (owner.status !== "ACTIVE") {
      return NextResponse.json(genericResponse);
    }

    // Generate token
    const rawToken = crypto.randomUUID();
    const hashedToken = await bcrypt.hash(rawToken, 10);
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.restaurantOwner.update({
      where: { id: owner.id },
      data: { resetToken: hashedToken, resetTokenExpiry: expiry },
    });

    // Build reset link
    const resetLink = `${BASE_URL}/admin/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(owner.email)}`;

    // Send email — wrapped in try/catch to never reveal failures to user
    const firstName = owner.name.split(" ")[0];
    try {
      await sendAdminEmail({
        to: owner.email,
        subject: "Recuperar contraseña · QuieroComer",
        html: resetPasswordEmailHtml(firstName, resetLink),
        purpose: "password_reset",
      });
    } catch (emailErr) {
      console.error("[forgot-password] Failed to send email", {
        email: owner.email,
        ownerId: owner.id,
        error: emailErr instanceof Error ? emailErr.message : String(emailErr),
        timestamp: new Date().toISOString(),
      });
      // Still return generic success — don't reveal email delivery status
    }

    return NextResponse.json(genericResponse);
  } catch (error) {
    console.error("Forgot password error:", error);
    // Even on DB errors, return generic to not leak info
    return NextResponse.json({
      success: true,
      message: "Si el email existe, recibirás un link de recuperación.",
    });
  }
}

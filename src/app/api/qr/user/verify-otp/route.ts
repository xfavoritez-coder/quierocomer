import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/qr/user/verify-otp
 * Verifica el código OTP y, si es correcto, inicia la sesión del cliente
 * seteando la cookie qr_user_id (misma sesión que el magic-link existente).
 */
export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();
    const cleanEmail = typeof email === "string" ? email.toLowerCase().trim() : "";
    const cleanCode = typeof code === "string" ? code.trim() : "";
    if (!cleanEmail || !/^\d{6}$/.test(cleanCode)) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }

    const user = await prisma.qRUser.findUnique({
      where: { email: cleanEmail },
      select: { id: true, name: true, email: true },
    });
    if (!user) return NextResponse.json({ error: "Código incorrecto o expirado" }, { status: 400 });

    const token = await prisma.qRMagicToken.findFirst({
      where: { userId: user.id, code: cleanCode, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!token) return NextResponse.json({ error: "Código incorrecto o expirado" }, { status: 400 });

    // Marca el código como usado + verifica al usuario
    await prisma.qRMagicToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
    await prisma.qRUser.update({ where: { id: user.id }, data: { verifiedAt: new Date() } });

    const res = NextResponse.json({ ok: true, user: { name: user.name, email: user.email } });
    res.cookies.set("qr_user_id", user.id, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60, // 1 año
    });
    return res;
  } catch (e) {
    console.error("verify-otp error:", e);
    return NextResponse.json({ error: "Error al verificar" }, { status: 500 });
  }
}

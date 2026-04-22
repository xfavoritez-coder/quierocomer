import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { rateLimit, RATE_LIMITS, getClientIp, formatRetryAfter } from "@/lib/rateLimit";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const IS_PROD = process.env.NODE_ENV === "production";

function setPanelCookies(
  response: NextResponse,
  token: string,
  role: string,
  id: string,
) {
  const base = { path: "/", maxAge: COOKIE_MAX_AGE, sameSite: "lax" as const, secure: IS_PROD };
  response.cookies.set("panel_token", token, { ...base, httpOnly: true });
  response.cookies.set("panel_role", role, { ...base, httpOnly: true });
  response.cookies.set("panel_id", id, { ...base, httpOnly: true });
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = rateLimit(`panel-login:${ip}`, RATE_LIMITS.login);
    if (!rl.success) {
      return NextResponse.json(
        { error: `Demasiados intentos. Intenta de nuevo en ${formatRetryAfter(rl.retryAfterMs)}.` },
        { status: 429 },
      );
    }

    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 });
    }

    const owner = await prisma.restaurantOwner.findUnique({
      where: { email },
      include: { restaurants: { select: { id: true, name: true, slug: true, logoUrl: true } } },
    });

    if (!owner) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, owner.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    if (owner.status === "SUSPENDED") {
      return NextResponse.json({ error: "Cuenta suspendida. Contacta al administrador." }, { status: 403 });
    }
    if (owner.status === "PENDING") {
      return NextResponse.json({ error: "Cuenta pendiente de aprobación." }, { status: 403 });
    }

    await prisma.restaurantOwner.update({
      where: { id: owner.id },
      data: { lastLoginAt: new Date() },
    });

    const token = crypto.randomUUID();
    const response = NextResponse.json({
      ok: true,
      role: owner.role,
      name: owner.name,
      restaurants: owner.restaurants,
    });
    setPanelCookies(response, token, owner.role, owner.id);
    return response;
  } catch (error) {
    console.error("Panel login error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

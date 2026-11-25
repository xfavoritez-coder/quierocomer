import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { rateLimit, RATE_LIMITS, getClientIp, formatRetryAfter } from "@/lib/rateLimit";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function setCookies(response: NextResponse, role: string, id: string) {
  setSessionCookie(response, { kind: "admin", id, role }, COOKIE_MAX_AGE);
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = getClientIp(req);
    const rl = rateLimit(`login:${ip}`, RATE_LIMITS.login);
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

    // 1. Check superadmin (env vars) first
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      const response = NextResponse.json({
        ok: true,
        role: "SUPERADMIN",
        name: "Super Admin",
        restaurantIds: [],
      });
      setCookies(response, "SUPERADMIN", "superadmin");
      return response;
    }

    // Admin login is superadmin only — owners use /panel/login
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

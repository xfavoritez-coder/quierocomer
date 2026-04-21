import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const IS_PROD = process.env.NODE_ENV === "production";

function setCookies(
  response: NextResponse,
  token: string,
  role: string,
  id: string,
) {
  const base = { path: "/", maxAge: COOKIE_MAX_AGE, sameSite: "lax" as const, secure: IS_PROD };
  response.cookies.set("admin_token", token, { ...base, httpOnly: true });
  response.cookies.set("admin_role", role, { ...base, httpOnly: true });
  response.cookies.set("admin_id", id, { ...base, httpOnly: true });
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña requeridos" }, { status: 400 });
    }

    // 1. Check superadmin (env vars) first
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      const token = crypto.randomUUID();
      const response = NextResponse.json({
        ok: true,
        role: "SUPERADMIN",
        name: "Super Admin",
        restaurantIds: [],
      });
      setCookies(response, token, "SUPERADMIN", "superadmin");
      return response;
    }

    // 2. Check RestaurantOwner
    const owner = await prisma.restaurantOwner.findUnique({
      where: { email },
      include: { restaurants: { select: { id: true, name: true, slug: true } } },
    });

    if (!owner) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, owner.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    // 3. Check account status
    if (owner.status === "SUSPENDED") {
      return NextResponse.json(
        { error: "Cuenta suspendida. Contacta al administrador." },
        { status: 403 },
      );
    }
    if (owner.status === "PENDING") {
      return NextResponse.json(
        { error: "Cuenta pendiente de aprobación." },
        { status: 403 },
      );
    }

    // Update lastLoginAt
    await prisma.restaurantOwner.update({
      where: { id: owner.id },
      data: { lastLoginAt: new Date() },
    });

    const token = crypto.randomUUID();
    const response = NextResponse.json({
      ok: true,
      role: owner.role,
      name: owner.name,
      restaurantIds: owner.restaurants.map((r) => r.id),
      restaurants: owner.restaurants,
    });
    setCookies(response, token, owner.role, owner.id);
    return response;
  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

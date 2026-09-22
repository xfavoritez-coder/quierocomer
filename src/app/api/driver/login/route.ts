import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { generateDriverToken } from "@/lib/driver/auth";
import { fmtChile } from "@/lib/driver/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/driver/login → { ok, token, user, expires_at } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const username = (body?.username || "").toString().trim();
  const password = (body?.password || "").toString();
  if (!username || !password) return NextResponse.json({ ok: false, error: "Usuario y contraseña requeridos." }, { status: 422 });

  // Multi-tenant: puede haber el mismo username en varios locales; gana el que verifica la clave.
  const candidates = await prisma.driver.findMany({ where: { username, active: true } });
  let matched: (typeof candidates)[number] | null = null;
  for (const d of candidates) {
    const hash = d.passwordHash.replace(/^\$2y\$/, "$2b$"); // compat hashes PHP
    if (await bcrypt.compare(password, hash)) { matched = d; break; }
  }
  if (!matched) return NextResponse.json({ ok: false, error: "Credenciales inválidas." }, { status: 401 });

  const rest = await prisma.restaurant.findUnique({ where: { id: matched.restaurantId }, select: { name: true } });
  const platform = ["android", "ios", "other"].includes((body?.platform || "").toString()) ? body.platform : "other";
  const token = generateDriverToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.driverSession.create({
    data: { driverId: matched.id, token, platform, deviceName: (body?.device_name || "").toString().slice(0, 120) || null, appVersion: (body?.app_version || "").toString().slice(0, 40) || null, lastSeenAt: new Date(), expiresAt },
  });

  return NextResponse.json({
    ok: true,
    token,
    user: { id: matched.id, username: matched.username, display_name: matched.displayName, role: matched.role, is_on_shift: matched.isOnShift, restaurant_name: rest?.name || "" },
    expires_at: fmtChile(expiresAt),
  });
}

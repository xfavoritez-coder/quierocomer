import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 40; // 40 days — cubre ciclo mensual + margen
const IS_PROD = process.env.NODE_ENV === "production";
const SECRET = process.env.AUTO_LOGIN_SECRET || "qc-auto-login-secret-2026";

/**
 * Auto-login via signed token from email links.
 * GET /api/panel/auto-login?oid=<ownerId>&sig=<signature>&t=<timestamp>
 *
 * Token is valid for 7 days from creation.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const oid = searchParams.get("oid");
  const sig = searchParams.get("sig");
  const t = searchParams.get("t");

  if (!oid || !sig || !t) {
    return NextResponse.redirect(new URL("/panel/login", req.url));
  }

  // Verify signature
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(`${oid}:${t}`)
    .digest("hex")
    .slice(0, 16);

  if (sig !== expected) {
    return NextResponse.redirect(new URL("/panel/login?error=invalid_link", req.url));
  }

  // Check expiry (7 days)
  const ts = parseInt(t, 10);
  if (isNaN(ts) || Date.now() - ts > 7 * 24 * 60 * 60 * 1000) {
    return NextResponse.redirect(new URL("/panel/login?error=expired", req.url));
  }

  const owner = await prisma.restaurantOwner.findUnique({
    where: { id: oid },
    select: { id: true, role: true, status: true },
  });

  if (!owner || owner.status !== "ACTIVE") {
    return NextResponse.redirect(new URL("/panel/login", req.url));
  }

  await prisma.restaurantOwner.update({ where: { id: oid }, data: { lastLoginAt: new Date() } });

  const token = crypto.randomUUID();
  const base = { path: "/", maxAge: COOKIE_MAX_AGE, sameSite: "lax" as const, secure: IS_PROD };

  // Respetar redirect param (ej. desde emails con ?renew=1&plan=PREMIUM)
  const redirect = searchParams.get("redirect");
  const destination = redirect && redirect.startsWith("/panel") ? redirect : "/panel";
  const response = NextResponse.redirect(new URL(destination, req.url));
  response.cookies.set("panel_token", token, { ...base, httpOnly: true });
  response.cookies.set("panel_role", owner.role, { ...base, httpOnly: true });
  response.cookies.set("panel_id", owner.id, { ...base, httpOnly: true });

  return response;
}

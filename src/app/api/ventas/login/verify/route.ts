import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashLoginToken, signSession, sessionCookieOptions, VENTAS_COOKIE } from "@/lib/ventas/session";

export const runtime = "nodejs";

/** GET /api/ventas/login/verify?sid=&t=  — consume el enlace de un solo uso y abre la sesión. */
export async function GET(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get("sid") || "";
  const token = req.nextUrl.searchParams.get("t") || "";
  const fail = NextResponse.redirect(new URL("/ventas/login?error=enlace", req.url));
  if (!sid || !token) return fail;

  const seller = await prisma.seller.findUnique({ where: { id: sid }, select: { id: true, active: true, loginTokenHash: true, loginTokenExpiresAt: true } });
  if (!seller?.active || !seller.loginTokenHash || !seller.loginTokenExpiresAt || seller.loginTokenExpiresAt.getTime() < Date.now()) return fail;
  const a = Buffer.from(hashLoginToken(token)), b = Buffer.from(seller.loginTokenHash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return fail;

  // Un solo uso: se invalida el token antes de abrir la sesión.
  await prisma.seller.update({ where: { id: seller.id }, data: { loginTokenHash: null, loginTokenExpiresAt: null, lastLoginAt: new Date() } });

  const res = NextResponse.redirect(new URL("/ventas", req.url));
  res.cookies.set(VENTAS_COOKIE, signSession(seller.id), sessionCookieOptions);
  return res;
}

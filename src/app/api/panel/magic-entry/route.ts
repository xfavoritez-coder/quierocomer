import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPanelMagicToken } from "@/lib/magicLink";
import crypto from "crypto";

const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 días

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t");
  const redirectTo = req.nextUrl.searchParams.get("r") || "/panel/exportar";

  if (!token) {
    return NextResponse.redirect(new URL("/panel/login", req.url));
  }

  const payload = verifyPanelMagicToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL("/panel/login?error=link_expired", req.url));
  }

  const owner = await prisma.restaurantOwner.findUnique({
    where: { id: payload.id },
    select: { id: true, role: true, status: true },
  });

  if (!owner || owner.status === "SUSPENDED") {
    return NextResponse.redirect(new URL("/panel/login?error=invalid", req.url));
  }

  // Magic entry (WhatsApp link) also verifies email
  await prisma.restaurantOwner.update({
    where: { id: owner.id },
    data: {
      lastLoginAt: new Date(),
      emailVerificado: true,
      emailVerificadoAt: new Date(),
    },
  });

  const panelToken = crypto.randomUUID();
  const base = { path: "/", maxAge: COOKIE_MAX_AGE, sameSite: "lax" as const, secure: IS_PROD };

  const response = NextResponse.redirect(new URL(redirectTo, "https://quierocomer.com"));
  response.cookies.set("panel_token", panelToken, { ...base, httpOnly: true });
  response.cookies.set("panel_role", owner.role, { ...base, httpOnly: true });
  response.cookies.set("panel_id", owner.id, { ...base, httpOnly: true });
  response.cookies.set("panel_ev", "1", { ...base, httpOnly: true });
  response.cookies.set("panel_logged", "1", { ...base, httpOnly: false });

  return response;
}

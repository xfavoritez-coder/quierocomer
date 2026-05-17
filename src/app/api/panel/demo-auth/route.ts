import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const COOKIE_MAX_AGE = 60 * 60 * 4; // 4 hours for demo sessions
const IS_PROD = process.env.NODE_ENV === "production";

/**
 * GET /api/panel/demo-auth?slug=xxx
 * Auto-authenticates into the panel for demo restaurants (no login needed).
 * Sets cookies and redirects to /panel.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.redirect(new URL("/panel/login", req.url));

  // Find demo restaurant and its owner
  const restaurant = await prisma.restaurant.findFirst({
    where: { slug, isDemo: true },
    select: { id: true, ownerId: true },
  });

  if (!restaurant || !restaurant.ownerId) {
    return NextResponse.redirect(new URL("/panel/login", req.url));
  }

  const owner = await prisma.restaurantOwner.findUnique({
    where: { id: restaurant.ownerId },
    select: { id: true, role: true, status: true },
  });

  if (!owner || owner.status !== "ACTIVE") {
    return NextResponse.redirect(new URL("/panel/login", req.url));
  }

  // Create demo session token
  const token = `demo_${crypto.randomUUID()}`;
  const base = { path: "/", maxAge: COOKIE_MAX_AGE, sameSite: "lax" as const, secure: IS_PROD };

  const response = NextResponse.redirect(new URL("/panel", req.url));
  response.cookies.set("panel_token", token, { ...base, httpOnly: true });
  response.cookies.set("panel_role", owner.role, { ...base, httpOnly: true });
  response.cookies.set("panel_id", owner.id, { ...base, httpOnly: true });
  response.cookies.set("panel_demo", "1", { ...base, httpOnly: false }); // client-readable flag

  return response;
}

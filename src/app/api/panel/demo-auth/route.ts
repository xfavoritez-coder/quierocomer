import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const COOKIE_MAX_AGE = 60 * 60 * 4; // 4 hours for demo sessions
const IS_PROD = process.env.NODE_ENV === "production";

/**
 * GET /api/panel/demo-auth?slug=xxx
 * Auto-authenticates into the panel for demo restaurants (no login needed).
 * Works with or without an owner assigned.
 * Sets cookies and redirects to /panel.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.redirect(new URL("/panel/login", req.url));

  // Find demo restaurant
  const restaurant = await prisma.restaurant.findFirst({
    where: { slug, isDemo: true },
    select: { id: true, ownerId: true },
  });

  if (!restaurant) {
    return NextResponse.redirect(new URL("/panel/login", req.url));
  }

  let ownerId = "demo";
  let ownerRole = "OWNER";

  // If restaurant has a real owner, use their info
  if (restaurant.ownerId) {
    const owner = await prisma.restaurantOwner.findUnique({
      where: { id: restaurant.ownerId },
      select: { id: true, role: true, status: true },
    });
    if (owner) {
      ownerId = owner.id;
      ownerRole = owner.role;
    }
  }

  // Create demo session token — encode slug for ownerless demo sessions
  const token = `demo_${crypto.randomUUID()}`;
  const base = { path: "/", maxAge: COOKIE_MAX_AGE, sameSite: "lax" as const, secure: IS_PROD };

  const response = NextResponse.redirect(new URL("/panel", req.url));
  response.cookies.set("panel_token", token, { ...base, httpOnly: true });
  response.cookies.set("panel_role", ownerRole, { ...base, httpOnly: true });
  response.cookies.set("panel_id", ownerId, { ...base, httpOnly: true });
  response.cookies.set("panel_demo", "1", { ...base, httpOnly: false }); // client-readable flag
  response.cookies.set("panel_demo_slug", slug, { ...base, httpOnly: true }); // which demo restaurant

  return response;
}

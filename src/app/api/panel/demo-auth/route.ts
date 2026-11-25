import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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

  // If an owner token is present, consume it now (owner is entering the panel)
  const ot = req.nextUrl.searchParams.get("ot");
  if (ot) {
    prisma.restaurant.updateMany({
      where: { slug, ownerViewToken: ot, ownerViewTokenUsedAt: null },
      data: { ownerViewTokenUsedAt: new Date() },
    }).catch(() => {});
  }

  // Find restaurant (demo or recently activated)
  const restaurant = await prisma.restaurant.findFirst({
    where: { slug },
    select: { id: true, ownerId: true, isDemo: true },
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

  const base = { path: "/", maxAge: COOKIE_MAX_AGE, sameSite: "lax" as const, secure: IS_PROD };

  // Track panel visit in Lead funnel + invalidar cache ISR del QR
  prisma.lead.updateMany({
    where: { generatedSlug: slug, panelVisitedAt: null },
    data: { panelVisitedAt: new Date() },
  }).then(() => { revalidatePath(`/qr/${slug}`); revalidatePath(`/${slug}`); }).catch(() => {});

  const nextPage = req.nextUrl.searchParams.get("next");
  const redirectTo = nextPage ? `/panel/${nextPage}` : "/panel";
  const response = NextResponse.redirect(new URL(redirectTo, req.url));
  // Sesión firmada. Para la demo sin dueño (id "demo") el slug va dentro de la firma.
  setSessionCookie(
    response,
    { kind: "panel", id: ownerId, role: ownerRole, demoSlug: ownerId === "demo" ? slug : undefined, demo: true },
    COOKIE_MAX_AGE,
  );
  response.cookies.set("panel_demo", restaurant.isDemo ? "1" : "0", { ...base, httpOnly: false });

  return response;
}

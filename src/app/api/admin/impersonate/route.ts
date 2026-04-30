import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import crypto from "crypto";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const IS_PROD = process.env.NODE_ENV === "production";

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) {
    return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });
  }

  try {
    const { ownerId } = await req.json();
    if (!ownerId) return NextResponse.json({ error: "ownerId requerido" }, { status: 400 });

    const owner = await prisma.restaurantOwner.findUnique({
      where: { id: ownerId },
      include: { restaurants: { select: { id: true, name: true, slug: true, logoUrl: true } } },
    });

    if (!owner) return NextResponse.json({ error: "Owner no encontrado" }, { status: 404 });

    const token = crypto.randomUUID();
    const base = { path: "/", maxAge: COOKIE_MAX_AGE, sameSite: "lax" as const, secure: IS_PROD };
    const response = NextResponse.json({ ok: true, slug: owner.restaurants[0]?.slug });
    response.cookies.set("panel_token", token, { ...base, httpOnly: true });
    response.cookies.set("panel_role", owner.role, { ...base, httpOnly: true });
    response.cookies.set("panel_id", owner.id, { ...base, httpOnly: true });

    return response;
  } catch (e) {
    console.error("Impersonate error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

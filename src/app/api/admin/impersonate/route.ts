import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

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

    const response = NextResponse.json({ ok: true, slug: owner.restaurants[0]?.slug });
    setSessionCookie(response, { kind: "panel", id: owner.id, role: owner.role }, COOKIE_MAX_AGE);

    return response;
  } catch (e) {
    console.error("Impersonate error:", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

/**
 * POST { email } → reasigna este local a un dueño YA existente (por correo).
 * No crea ni renombra dueños: solo apunta restaurant.ownerId al dueño encontrado.
 * Solo superadmin.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const email = (body?.email || "").toString().trim();
  if (!email) return NextResponse.json({ error: "Falta el correo" }, { status: 400 });

  const owner = await prisma.restaurantOwner.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, name: true, email: true },
  });
  if (!owner) return NextResponse.json({ error: "No existe un dueño con ese correo. Revísalo o créalo primero." }, { status: 404 });

  await prisma.restaurant.update({ where: { id }, data: { ownerId: owner.id } });
  return NextResponse.json({ ok: true, owner });
}

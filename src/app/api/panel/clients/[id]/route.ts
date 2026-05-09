import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";

/**
 * PATCH /api/panel/clients/:id?restaurantId=xxx
 *   Edita name / email / birthDate / dietType de un cliente.
 *
 * DELETE /api/panel/clients/:id?restaurantId=xxx
 *   Desactiva al cliente de este local (isActive=false en RestaurantClient).
 *   NO borra el QRUser — el historial se mantiene para analytics.
 */
async function ensureClientInRestaurant(userId: string, restaurantId: string) {
  const rc = await prisma.restaurantClient.findUnique({
    where: { qrUserId_restaurantId: { qrUserId: userId, restaurantId } },
    select: { id: true, isActive: true },
  });
  if (!rc) {
    const err: any = new Error("Cliente no pertenece a este local");
    err.status = 404;
    throw err;
  }
  return rc;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    await requireRestaurantForOwner(req, restaurantId);
    await ensureClientInRestaurant(id, restaurantId);

    const body = await req.json();
    const data: any = {};
    if (typeof body.name === "string") data.name = body.name.trim() || null;
    if (typeof body.email === "string") {
      const email = body.email.trim().toLowerCase();
      if (!email.includes("@")) return NextResponse.json({ error: "Email invalido" }, { status: 400 });
      data.email = email;
    }
    if (body.birthDate === null || body.birthDate === "") {
      data.birthDate = null;
    } else if (typeof body.birthDate === "string") {
      const d = new Date(body.birthDate);
      if (isNaN(d.getTime())) return NextResponse.json({ error: "Fecha invalida" }, { status: 400 });
      data.birthDate = d;
    }
    if (body.dietType === null || body.dietType === "") {
      data.dietType = null;
    } else if (typeof body.dietType === "string") {
      data.dietType = body.dietType;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
    }

    try {
      const updated = await prisma.qRUser.update({
        where: { id },
        data,
        select: { id: true, name: true, email: true, birthDate: true, dietType: true },
      });
      return NextResponse.json({ ok: true, user: updated });
    } catch (e: any) {
      if (e.code === "P2002") {
        return NextResponse.json({ error: "Ese email ya esta usado por otro cliente" }, { status: 409 });
      }
      throw e;
    }
  } catch (e: any) {
    if (e.status === 400 || e.status === 403 || e.status === 404) return authErrorResponse(e);
    console.error("[Panel clients PATCH]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const restaurantId = req.nextUrl.searchParams.get("restaurantId");
    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    await requireRestaurantForOwner(req, restaurantId);
    await ensureClientInRestaurant(id, restaurantId);

    // Soft-delete: desactivar, no borrar
    await prisma.restaurantClient.update({
      where: { qrUserId_restaurantId: { qrUserId: id, restaurantId } },
      data: { isActive: false, unsubscribedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403 || e.status === 404) return authErrorResponse(e);
    console.error("[Panel clients DELETE]", e);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

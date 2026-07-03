import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";

/** GET /api/admin/control/insumos?restaurantId=X */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });

  try {
    await requireRestaurantForOwner(req, restaurantId);
  } catch (e) {
    return authErrorResponse(e);
  }

  const insumos = await prisma.insumo.findMany({
    where: { restaurantId, activo: true },
    orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
    include: { maestro: { select: { id: true, nombre: true } } },
  });

  return NextResponse.json(insumos);
}

/** POST /api/admin/control/insumos — crear un insumo manual */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { restaurantId, nombre, categoria, unidadBase, maestroId, esCritico } = await req.json();

    if (!restaurantId || !nombre || !categoria || !unidadBase) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }

    await requireRestaurantForOwner(req, restaurantId);

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { controlEnabled: true },
    });
    if (!restaurant?.controlEnabled) {
      return NextResponse.json({ error: "Módulo Control no habilitado" }, { status: 403 });
    }

    const insumo = await prisma.insumo.create({
      data: {
        restaurantId,
        nombre,
        categoria,
        unidadBase,
        maestroId: maestroId || null,
        esCritico: esCritico || false,
      },
    });

    return NextResponse.json(insumo);
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un insumo con ese nombre" }, { status: 409 });
    }
    console.error("[control/insumos POST]", e);
    return NextResponse.json({ error: "Error al crear insumo" }, { status: 500 });
  }
}

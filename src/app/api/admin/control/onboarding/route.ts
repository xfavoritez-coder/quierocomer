import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, requireRestaurantForOwner, authErrorResponse } from "@/lib/adminAuth";

interface InsumoInput {
  maestroId?: string;
  nombre: string;
  categoria: string;
  unidadBase: string;
  esCritico: boolean;
  ordenConteo?: number;
}

/**
 * POST /api/admin/control/onboarding
 * Guarda el resultado del wizard: crea todos los insumos del restaurante en batch.
 * Si ya existen insumos, los reemplaza (permite re-hacer el wizard).
 */
export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const { restaurantId, insumos }: { restaurantId: string; insumos: InsumoInput[] } = await req.json();

    if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });
    if (!Array.isArray(insumos) || insumos.length === 0) {
      return NextResponse.json({ error: "Debes seleccionar al menos un insumo" }, { status: 400 });
    }

    await requireRestaurantForOwner(req, restaurantId);

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { controlEnabled: true },
    });
    if (!restaurant?.controlEnabled) {
      return NextResponse.json({ error: "Módulo Control no habilitado" }, { status: 403 });
    }

    // Soft-delete los insumos existentes y crear los nuevos en transacción
    const created = await prisma.$transaction(async (tx) => {
      // Desactivar todos los insumos anteriores
      await tx.insumo.updateMany({
        where: { restaurantId },
        data: { activo: false },
      });

      // Crear nuevos en batch
      const results = [];
      for (const insumo of insumos) {
        const record = await tx.insumo.create({
          data: {
            restaurantId,
            nombre: insumo.nombre,
            categoria: insumo.categoria as any,
            unidadBase: insumo.unidadBase as any,
            maestroId: insumo.maestroId || null,
            esCritico: insumo.esCritico,
            ordenConteo: insumo.esCritico ? (insumo.ordenConteo ?? null) : null,
            activo: true,
          },
        });
        results.push(record);
      }
      return results;
    });

    return NextResponse.json({ count: created.length, insumos: created });
  } catch (e: any) {
    if (e.status) return authErrorResponse(e);
    console.error("[control/onboarding POST]", e);
    return NextResponse.json({ error: "Error al guardar insumos" }, { status: 500 });
  }
}

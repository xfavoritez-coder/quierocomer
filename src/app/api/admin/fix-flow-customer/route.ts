import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.CRON_SECRET;

/**
 * POST /api/admin/fix-flow-customer
 * Body: { restaurantId, flowCustomerId }
 * Header: Authorization: Bearer <ADMIN_SECRET>
 *
 * Guarda manualmente el customerId de Flow en la BD para un restaurante.
 * Útil cuando el cliente ya existe en Flow pero no lo tenemos guardado.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!ADMIN_SECRET || auth !== `Bearer ${ADMIN_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { restaurantId?: string; flowCustomerId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { restaurantId, flowCustomerId } = body;
  if (!restaurantId || !flowCustomerId) {
    return NextResponse.json({ error: "Faltan restaurantId o flowCustomerId" }, { status: 400 });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, flowCustomerId: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { flowCustomerId },
  });

  return NextResponse.json({
    ok: true,
    restaurant: restaurant.name,
    prev: restaurant.flowCustomerId,
    now: flowCustomerId,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveKdsRestaurant } from "@/lib/kds/liteServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Regresa un pedido a "Pendientes" desde la KDS liviana (cualquier etapa → preparing).
// Limpia la marca de "listo" y la asignación del repartidor, igual que el PATCH del
// Centro de pedidos al mover un pedido hacia atrás. Se refleja por Supabase Realtime.
export async function POST(req: NextRequest) {
  const token = req.cookies.get("kds_token")?.value || "";
  const rest = token ? await resolveKdsRestaurant(token) : null;
  if (!rest) return NextResponse.json({ ok: false, error: "No vinculado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ ok: false, error: "Falta id" }, { status: 400 });

  const r = await prisma.posOrder.updateMany({
    where: { id, restaurantId: rest.id, opsStage: { not: "preparing" }, posStatus: { not: "canceled" } },
    data: { opsStage: "preparing", opsReadyForDeliveryAt: null, assignedDriverId: null, assignedTo: null, isAssigned: false },
  });
  return NextResponse.json({ ok: r.count > 0 });
}

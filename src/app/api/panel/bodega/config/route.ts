import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureOwnBodega } from "@/lib/bodega/provision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) {
    const m = await prisma.teamMember.findUnique({ where: { id: panelId.slice(3) }, select: { restaurantId: true } });
    return m?.restaurantId === restaurantId;
  }
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

/** GET /api/panel/bodega/config?restaurantId=X → configuración de la bodega. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const bodegaId = await ensureOwnBodega(restaurantId);
  const bodega = await prisma.bodega.findUnique({ where: { id: bodegaId }, select: { ingresoManualEnabled: true, mostrarPreciosConIva: true } });
  return NextResponse.json({ ingresoManualEnabled: bodega?.ingresoManualEnabled ?? true, mostrarPreciosConIva: bodega?.mostrarPreciosConIva ?? true });
}

/** PUT /api/panel/bodega/config → actualiza la configuración de la bodega. */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const bodegaId = await ensureOwnBodega(restaurantId);
  const data: Record<string, any> = {};
  if (typeof body?.ingresoManualEnabled === "boolean") data.ingresoManualEnabled = body.ingresoManualEnabled;
  if (typeof body?.mostrarPreciosConIva === "boolean") data.mostrarPreciosConIva = body.mostrarPreciosConIva;

  const bodega = await prisma.bodega.update({ where: { id: bodegaId }, data, select: { ingresoManualEnabled: true, mostrarPreciosConIva: true } });
  return NextResponse.json({ ingresoManualEnabled: bodega.ingresoManualEnabled, mostrarPreciosConIva: bodega.mostrarPreciosConIva });
}

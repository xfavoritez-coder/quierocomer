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

const SELECT = {
  id: true, nombre: true, razonSocial: true, telefono: true, correo: true, direccion: true, web: true,
  _count: { select: { compras: true } },
} as const;

function clean(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** GET /api/panel/bodega/proveedores?restaurantId=X */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { bodegaEnabled: true } });
  if (!r?.bodegaEnabled) return NextResponse.json({ error: "Bodega no habilitada" }, { status: 404 });

  const bodegaId = await ensureOwnBodega(restaurantId);
  const proveedores = await prisma.proveedor.findMany({
    where: { bodegaId, activo: true }, orderBy: { nombre: "asc" }, select: SELECT,
  });
  return NextResponse.json({ proveedores });
}

/** POST /api/panel/bodega/proveedores → crea un proveedor. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { bodegaEnabled: true } });
  if (!r?.bodegaEnabled) return NextResponse.json({ error: "Bodega no habilitada" }, { status: 404 });

  const nombre = (body?.nombre || "").toString().trim();
  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });

  const bodegaId = await ensureOwnBodega(restaurantId);
  try {
    const proveedor = await prisma.proveedor.create({
      data: {
        bodegaId, nombre,
        razonSocial: clean(body?.razonSocial), telefono: clean(body?.telefono),
        correo: clean(body?.correo), direccion: clean(body?.direccion), web: clean(body?.web),
      },
      select: SELECT,
    });
    return NextResponse.json({ proveedor });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "Ya existe un proveedor con ese nombre" }, { status: 409 });
    console.error("[panel/bodega/proveedores POST]", e);
    return NextResponse.json({ error: "Error al crear el proveedor" }, { status: 500 });
  }
}

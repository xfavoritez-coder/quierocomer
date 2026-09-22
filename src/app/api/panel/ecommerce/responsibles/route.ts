import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

/** GET → responsables del local (roster para reasignaciones). */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const responsibles = await prisma.deliveryResponsible.findMany({ where: { restaurantId }, orderBy: { name: "asc" }, select: { id: true, name: true, roleLabel: true, active: true } });
  return NextResponse.json({ responsibles });
}

/** POST → crea { restaurantId, name, roleLabel? } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const name = (body?.name || "").toString().trim();
  if (!name) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  const responsible = await prisma.deliveryResponsible.create({
    data: { restaurantId, name, roleLabel: (body?.roleLabel || "").toString().trim() || null },
    select: { id: true, name: true, roleLabel: true, active: true },
  });
  return NextResponse.json({ responsible });
}

/** PATCH → edita { restaurantId, id, name?, roleLabel?, active? } */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  const id = (body?.id || "").toString();
  if (!restaurantId || !id) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const ex = await prisma.deliveryResponsible.findUnique({ where: { id }, select: { restaurantId: true } });
  if (!ex || ex.restaurantId !== restaurantId) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const data: any = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (body.roleLabel !== undefined) data.roleLabel = (body.roleLabel || "").toString().trim() || null;
  if (typeof body.active === "boolean") data.active = body.active;
  const responsible = await prisma.deliveryResponsible.update({ where: { id }, data, select: { id: true, name: true, roleLabel: true, active: true } });
  return NextResponse.json({ responsible });
}

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
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

/** GET → repartidores del local. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const drivers = await prisma.driver.findMany({
    where: { restaurantId }, orderBy: { displayName: "asc" },
    select: { id: true, username: true, displayName: true, role: true, active: true, isOnShift: true },
  });
  return NextResponse.json({ drivers });
}

/** POST → crea repartidor { restaurantId, username, displayName, password, role? } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const username = (body?.username || "").toString().trim();
  const displayName = (body?.displayName || "").toString().trim();
  const password = (body?.password || "").toString();
  const role = body?.role === "admin" ? "admin" : "driver";
  if (!username || !displayName || !password) return NextResponse.json({ error: "Usuario, nombre y clave son obligatorios" }, { status: 400 });
  if (password.length < 4) return NextResponse.json({ error: "La clave debe tener al menos 4 caracteres" }, { status: 400 });

  try {
    const driver = await prisma.driver.create({
      data: { restaurantId, username, displayName, passwordHash: await bcrypt.hash(password, 10), role },
      select: { id: true, username: true, displayName: true, role: true, active: true, isOnShift: true },
    });
    return NextResponse.json({ driver });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "Ya existe un repartidor con ese usuario" }, { status: 409 });
    return NextResponse.json({ error: "No se pudo crear" }, { status: 500 });
  }
}

/** PATCH → edita { restaurantId, id, displayName?, role?, active?, password? } */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  const id = (body?.id || "").toString();
  if (!restaurantId || !id) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const d = await prisma.driver.findUnique({ where: { id }, select: { restaurantId: true } });
  if (!d || d.restaurantId !== restaurantId) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const data: any = {};
  if (typeof body.displayName === "string" && body.displayName.trim()) data.displayName = body.displayName.trim();
  if (body.role === "admin" || body.role === "driver") data.role = body.role;
  if (typeof body.active === "boolean") data.active = body.active;
  if (typeof body.password === "string" && body.password) {
    if (body.password.length < 4) return NextResponse.json({ error: "La clave debe tener al menos 4 caracteres" }, { status: 400 });
    data.passwordHash = await bcrypt.hash(body.password, 10);
  }
  const driver = await prisma.driver.update({ where: { id }, data, select: { id: true, username: true, displayName: true, role: true, active: true, isOnShift: true } });
  return NextResponse.json({ driver });
}

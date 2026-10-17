import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 40; // 40 días
const IS_PROD = process.env.NODE_ENV === "production";

/**
 * POST /api/panel/switch-branch  { restaurantId }
 * Cambia la sucursal activa de un usuario de equipo con acceso multi-sucursal.
 * Reasigna la cookie panel_id a la fila TeamMember de esa sucursal (mismo email
 * + mismo dueño), de modo que la autorización por local del resto del panel
 * sigue funcionando sin cambios. Para dueños no hace nada (ya acceden a todos).
 */
export async function POST(req: NextRequest) {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const restaurantId = (body?.restaurantId || "").toString();
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });

  // Dueño: no necesita cambiar cookie (autoriza por ownerId).
  if (!panelId.startsWith("tm_")) return NextResponse.json({ ok: true, ownerSession: true });

  const current = await prisma.teamMember.findUnique({
    where: { id: panelId.slice(3) },
    select: { email: true, restaurant: { select: { ownerId: true } } },
  });
  if (!current) return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });

  const ownerId = current.restaurant?.ownerId || null;
  const target = await prisma.teamMember.findFirst({
    where: {
      email: { equals: current.email, mode: "insensitive" },
      status: "ACTIVE",
      restaurantId,
      ...(ownerId ? { restaurant: { ownerId } } : {}),
    },
    select: { id: true, role: true },
  });
  if (!target) return NextResponse.json({ error: "No tienes acceso a esa sucursal" }, { status: 403 });

  const res = NextResponse.json({ ok: true, memberId: target.id });
  const base = { path: "/", maxAge: COOKIE_MAX_AGE, sameSite: "lax" as const, secure: IS_PROD };
  res.cookies.set("panel_id", `tm_${target.id}`, { ...base, httpOnly: true });
  res.cookies.set("panel_role", target.role, { ...base, httpOnly: true });
  return res;
}

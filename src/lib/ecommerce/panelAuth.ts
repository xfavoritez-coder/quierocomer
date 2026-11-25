import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPanelId, readPanelSession } from "@/lib/session";

/**
 * Sesión demo sin dueño (panel_id "demo"): solo puede tocar SU local demo
 * (el slug va dentro de la sesión firmada). Antes devolvía true para cualquier local.
 */
export async function demoSessionCanAccess(req: NextRequest, restaurantId: string): Promise<boolean> {
  const s = readPanelSession(req);
  if (!s || s.id !== "demo" || !s.demoSlug || !restaurantId) return false;
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { slug: true, isDemo: true } });
  return !!r && r.isDemo && r.slug === s.demoSlug;
}

/**
 * ¿El miembro de equipo `memberId` puede acceder al restaurante `restaurantId`?
 * Un usuario de equipo puede tener acceso a VARIAS sucursales (una fila TeamMember
 * por local, mismo email, del mismo dueño). El panel_id de la sesión apunta a UNA
 * sola fila, así que además del match directo se verifica si el MISMO email tiene
 * una membresía ACTIVA para el restaurante pedido, bajo el mismo dueño. Esto hace
 * que un admin multi-sucursal (p.ej. dueño de Kojo Recoleta + La Florida) vea los
 * datos de ambas, no solo la de su fila de sesión. Misma lógica que /api/panel/me.
 */
export async function teamMemberCanAccess(memberId: string, restaurantId: string): Promise<boolean> {
  const m = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: { email: true, status: true, restaurantId: true, restaurant: { select: { ownerId: true } } },
  });
  if (!m || m.status !== "ACTIVE") return false;
  if (m.restaurantId === restaurantId) return true;
  const ownerId = m.restaurant?.ownerId;
  const sibling = await prisma.teamMember.findFirst({
    where: {
      email: { equals: m.email, mode: "insensitive" },
      status: "ACTIVE",
      restaurantId,
      ...(ownerId ? { restaurant: { ownerId } } : {}),
    },
    select: { id: true },
  });
  return !!sibling;
}

/** Verifica que el panel_id (sesión firmada) sea dueño o miembro (multi-sucursal) del restaurante. */
export async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = getPanelId(req);
  if (!panelId) return false;
  if (panelId === "demo") return demoSessionCanAccess(req, restaurantId);
  if (panelId.startsWith("tm_")) {
    return teamMemberCanAccess(panelId.slice(3), restaurantId);
  }
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

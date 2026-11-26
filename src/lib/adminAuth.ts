import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readAdminSession, readPanelSession } from "@/lib/session";

/**
 * Checks admin auth via sesión firmada (ver src/lib/session.ts).
 * Acepta la sesión de superadmin (/admin) o la del panel de dueño.
 * Returns null if authenticated, or a 401 response.
 */
export function checkAdminAuth(req: NextRequest): NextResponse | null {
  if (readAdminSession(req) || readPanelSession(req)) return null;
  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}

/** Rol verificado (sesión admin primero, luego panel). */
export function getAdminRole(req: NextRequest): string | null {
  return readAdminSession(req)?.role || readPanelSession(req)?.role || null;
}

/** ID verificado (sesión admin primero, luego panel). */
export function getAdminId(req: NextRequest): string | null {
  return readAdminSession(req)?.id || readPanelSession(req)?.id || null;
}

/** Returns true if the current user is SUPERADMIN */
export function isSuperAdmin(req: NextRequest): boolean {
  return getAdminRole(req) === "SUPERADMIN";
}

/**
 * Returns the list of restaurant IDs owned by the current admin.
 * Returns null for SUPERADMIN (meaning "all restaurants").
 * Handles both RestaurantOwner (panel_id) and TeamMember (panel_id = "tm_<id>").
 */
export async function getOwnedRestaurantIds(req: NextRequest): Promise<string[] | null> {
  if (isSuperAdmin(req)) return null;

  const rawId = getAdminId(req);
  if (!rawId) return [];

  // Sesión demo: solo el local demo de la sesión firmada.
  if (rawId === "demo") {
    const slug = readPanelSession(req)?.demoSlug;
    if (!slug) return [];
    const r = await prisma.restaurant.findFirst({ where: { slug, isDemo: true }, select: { id: true } });
    return r ? [r.id] : [];
  }

  // Team member: panel_id is prefixed with "tm_"
  if (rawId.startsWith("tm_")) {
    const memberId = rawId.slice(3);
    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      select: { restaurantId: true, email: true, restaurant: { select: { ownerId: true } } },
    });
    if (!member?.restaurantId) return [];
    // Acceso multi-sucursal: mismo email + mismo dueño + ACTIVE (misma lógica
    // que /api/panel/me y teamMemberCanAccess). La sucursal de la sesión siempre se incluye.
    const ownerId = member.restaurant?.ownerId;
    const siblings = ownerId
      ? await prisma.teamMember.findMany({
          where: { email: { equals: member.email, mode: "insensitive" }, status: "ACTIVE", restaurant: { ownerId } },
          select: { restaurantId: true },
        })
      : [];
    return Array.from(new Set([member.restaurantId, ...siblings.map((x) => x.restaurantId)]));
  }

  const owner = await prisma.restaurantOwner.findUnique({
    where: { id: rawId },
    include: { restaurants: { select: { id: true } } },
  });

  return owner?.restaurants.map((r) => r.id) ?? [];
}

/**
 * Verifies that the authenticated user owns the given restaurant.
 * SUPERADMIN always passes. OWNER must have the restaurant in their list.
 * Throws an error with a message suitable for the client.
 */
export async function assertOwnsRestaurant(req: NextRequest, restaurantId: string): Promise<void> {
  if (isSuperAdmin(req)) return;

  const ownedIds = await getOwnedRestaurantIds(req);
  if (!ownedIds || !ownedIds.includes(restaurantId)) {
    const err: any = new Error("No tienes permisos para este restaurant");
    err.status = 403;
    throw err;
  }
}

/**
 * For GET endpoints: ensures OWNER provides a restaurantId and owns it.
 * SUPERADMIN can pass null (gets all) or a specific one.
 * Returns the validated restaurantId or null (for superadmin with no filter).
 */
export async function requireRestaurantForOwner(
  req: NextRequest,
  restaurantId: string | null,
): Promise<string | null> {
  if (isSuperAdmin(req)) {
    // Superadmin can optionally filter
    return restaurantId;
  }

  // Owner MUST provide restaurantId
  if (!restaurantId) {
    const err: any = new Error("Debes especificar un restaurant");
    err.status = 400;
    throw err;
  }

  await assertOwnsRestaurant(req, restaurantId);
  return restaurantId;
}

/**
 * Helper to catch assertOwnsRestaurant / requireRestaurantForOwner errors
 * and return the appropriate HTTP response.
 */
export function authErrorResponse(err: any): NextResponse {
  const status = err.status || 500;
  const message = err.message || "Error de autorización";
  return NextResponse.json({ error: message }, { status });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Checks admin auth via cookie-based auth (admin_token + admin_id).
 * Returns null if authenticated, or a 401 response.
 */
export function checkAdminAuth(req: NextRequest): NextResponse | null {
  const adminToken = req.cookies.get("admin_token")?.value;
  const adminId = req.cookies.get("admin_id")?.value;
  if (adminToken && adminId) return null; // authenticated

  return NextResponse.json({ error: "No autorizado" }, { status: 401 });
}

/** Get admin role from cookies */
export function getAdminRole(req: NextRequest): string | null {
  return req.cookies.get("admin_role")?.value || null;
}

/** Get admin ID from cookies */
export function getAdminId(req: NextRequest): string | null {
  return req.cookies.get("admin_id")?.value || null;
}

/** Returns true if the current user is SUPERADMIN */
export function isSuperAdmin(req: NextRequest): boolean {
  return getAdminRole(req) === "SUPERADMIN";
}

/**
 * Returns the list of restaurant IDs owned by the current admin.
 * Returns null for SUPERADMIN (meaning "all restaurants").
 */
export async function getOwnedRestaurantIds(req: NextRequest): Promise<string[] | null> {
  if (isSuperAdmin(req)) return null;

  const ownerId = getAdminId(req);
  if (!ownerId) return [];

  const owner = await prisma.restaurantOwner.findUnique({
    where: { id: ownerId },
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

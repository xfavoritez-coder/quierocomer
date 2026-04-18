import { NextRequest, NextResponse } from "next/server";

/**
 * Checks admin auth via:
 * 1. New cookie-based auth (admin_token + admin_id)
 * 2. Legacy header-based auth (x-admin-token = ADMIN_PASSWORD)
 */
export function checkAdminAuth(req: NextRequest): NextResponse | null {
  // New: cookie-based auth
  const adminToken = req.cookies.get("admin_token")?.value;
  const adminId = req.cookies.get("admin_id")?.value;
  if (adminToken && adminId) return null; // authenticated

  // Legacy: header-based auth
  const token = req.headers.get("x-admin-token");
  const expected = process.env.ADMIN_PASSWORD;
  if (token && expected && token === expected) return null; // authenticated

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

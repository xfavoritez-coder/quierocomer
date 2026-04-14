import { NextRequest, NextResponse } from "next/server";

export function checkAdminAuth(req: NextRequest): NextResponse | null {
  const token = req.headers.get("x-admin-token");
  const expected = process.env.ADMIN_PASSWORD;
  if (!token || !expected || token !== expected) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return null;
}

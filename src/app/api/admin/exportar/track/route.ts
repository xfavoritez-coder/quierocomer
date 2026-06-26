import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, getAdminId } from "@/lib/adminAuth";
import { logActivity } from "@/lib/admin/logActivity";

export async function POST(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const { restaurantId, action, ...details } = await req.json();
  if (!restaurantId || !action) return NextResponse.json({ ok: false }, { status: 400 });

  logActivity(restaurantId, action, details, getAdminId(req) || undefined);
  return NextResponse.json({ ok: true });
}

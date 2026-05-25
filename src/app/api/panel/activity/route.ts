import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/admin/logActivity";

/**
 * POST /api/panel/activity
 * Body: { restaurantId, action, details? }
 *
 * Lightweight endpoint for tracking panel navigation and actions.
 * Fire-and-forget — always returns 200.
 */
export async function POST(req: NextRequest) {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return NextResponse.json({ ok: true });

  try {
    const { restaurantId, action, details } = await req.json();
    if (restaurantId && action) {
      logActivity(restaurantId, action, details || undefined, panelId);
    }
  } catch {}

  return NextResponse.json({ ok: true });
}

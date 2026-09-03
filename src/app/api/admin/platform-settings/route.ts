import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { getPlatformSetting, setPlatformSetting } from "@/lib/platformSettings";

export const runtime = "nodejs";

/**
 * Ajustes globales de plataforma (API keys de integraciones). Solo superadmin.
 * GET → { googleApiKey }
 * PUT { googleApiKey } → guarda
 */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const googleApiKey = (await getPlatformSetting("google_api_key")) || "";
  return NextResponse.json({ googleApiKey });
}

export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (body?.googleApiKey !== undefined) {
    await setPlatformSetting("google_api_key", String(body.googleApiKey || "").trim() || null);
  }
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { getPlatformSetting, setPlatformSetting } from "@/lib/platformSettings";
import { parseTrackingTexts, DEFAULT_TRACKING_TEXTS, type TrackingTexts } from "@/lib/ecommerce/trackingTexts";

export const runtime = "nodejs";

/**
 * Textos de la página de seguimiento del pedido (/pedido/[id]). Solo superadmin.
 * GET → TrackingTexts (fusionado con defaults)
 * PUT TrackingTexts → guarda el JSON en PlatformSetting("tracking_texts")
 */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const raw = await getPlatformSetting("tracking_texts");
  let texts: TrackingTexts;
  try { texts = parseTrackingTexts(raw ? JSON.parse(raw) : null); } catch { texts = parseTrackingTexts(null); }
  return NextResponse.json(texts);
}

export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const body = await req.json().catch(() => null);
  // Solo guardamos las claves conocidas (fusionadas sobre defaults), como strings limpios.
  const merged = parseTrackingTexts(body);
  const toStore: Partial<TrackingTexts> = {};
  for (const k of Object.keys(DEFAULT_TRACKING_TEXTS) as (keyof TrackingTexts)[]) {
    toStore[k] = merged[k];
  }
  await setPlatformSetting("tracking_texts", JSON.stringify(toStore));
  return NextResponse.json({ ok: true });
}

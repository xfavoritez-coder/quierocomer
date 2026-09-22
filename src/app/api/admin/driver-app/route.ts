import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";
import { getPlatformSetting, setPlatformSetting } from "@/lib/platformSettings";

export const runtime = "nodejs";

const K = {
  apk: "driver_app_apk_url",
  latest: "driver_app_latest_version",
  min: "driver_app_min_version",
  notes: "driver_app_release_notes",
};

/** GET → config de la app de repartidores (QuieroComer Delivery). Solo superadmin. */
export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const [apkUrl, latestVersion, minVersion, releaseNotes] = await Promise.all([
    getPlatformSetting(K.apk), getPlatformSetting(K.latest), getPlatformSetting(K.min), getPlatformSetting(K.notes),
  ]);
  return NextResponse.json({ apkUrl: apkUrl || "", latestVersion: latestVersion || "", minVersion: minVersion || "", releaseNotes: releaseNotes || "" });
}

/** PUT { apkUrl?, latestVersion?, minVersion?, releaseNotes? } → guarda. Solo superadmin. */
export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "Solo superadmin" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (body?.apkUrl !== undefined) await setPlatformSetting(K.apk, String(body.apkUrl || "").trim() || null);
  if (body?.latestVersion !== undefined) await setPlatformSetting(K.latest, String(body.latestVersion || "").trim() || null);
  if (body?.minVersion !== undefined) await setPlatformSetting(K.min, String(body.minVersion || "").trim() || null);
  if (body?.releaseNotes !== undefined) await setPlatformSetting(K.notes, String(body.releaseNotes || "").trim() || null);
  return NextResponse.json({ ok: true });
}

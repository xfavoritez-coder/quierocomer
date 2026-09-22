import { NextResponse } from "next/server";
import { getPlatformSetting } from "@/lib/platformSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/driver/app-config → { ok, config } (público, control de versión de la app).
 *  Se administra desde /admin → Ajustes → App de repartidores. */
export async function GET() {
  const [apk, latest, min, notes] = await Promise.all([
    getPlatformSetting("driver_app_apk_url"),
    getPlatformSetting("driver_app_latest_version"),
    getPlatformSetting("driver_app_min_version"),
    getPlatformSetting("driver_app_release_notes"),
  ]);
  return NextResponse.json({
    ok: true,
    config: {
      latest_version: latest || "1.0.0",
      min_required_version: min || "1.0.0",
      apk_url: apk || "",
      release_notes: notes || "",
    },
  });
}

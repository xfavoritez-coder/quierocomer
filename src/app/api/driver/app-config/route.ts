import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/driver/app-config → { ok, config } (público, control de versión de la app). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    config: {
      latest_version: process.env.DRIVER_APP_LATEST_VERSION || "1.0.0",
      min_required_version: process.env.DRIVER_APP_MIN_VERSION || "1.0.0",
      apk_url: process.env.DRIVER_APP_APK_URL || "",
      release_notes: process.env.DRIVER_APP_RELEASE_NOTES || "",
    },
  });
}

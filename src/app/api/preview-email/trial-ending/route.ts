import { NextResponse } from "next/server";
import { trialEndingSoonEmailHtml } from "@/lib/email/sendAdminEmail";

/**
 * GET /api/preview-email/trial-ending
 * Preview the trial-ending-soon email in browser.
 */
export async function GET() {
  const html = trialEndingSoonEmailHtml(
    "Daniel",
    "El Menú de la Esquina",
    2,
    "https://quierocomer.com/panel",
    "https://quierocomer.com/panel/suscripcion",
    "el-menu-de-la-esquina",
  );

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

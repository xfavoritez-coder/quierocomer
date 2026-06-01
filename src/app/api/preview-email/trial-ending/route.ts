import { NextResponse } from "next/server";
import { trialEndingSoonEmailHtml } from "@/lib/email/sendAdminEmail";

/**
 * GET /api/preview-email/trial-ending
 * Preview the trial-ending-soon email in browser.
 */
export async function GET() {
  const html = trialEndingSoonEmailHtml(
    "Daniel",
    "Sushi Master",
    2,
    "https://quierocomer.cl/panel",
    "https://quierocomer.cl/panel/suscripcion",
  );

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

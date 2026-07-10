import { NextResponse } from "next/server";
import { trialExpiredEmailHtml } from "@/lib/email/sendAdminEmail";

/**
 * GET /api/preview-email/trial-expired
 * Preview the trial-expired email in browser.
 */
export async function GET() {
  const html = trialExpiredEmailHtml(
    "Daniel",
    "Sushi Master",
    "https://quierocomer.com/panel/suscripcion",
    "https://quierocomer.com/sushi-master",
  );

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

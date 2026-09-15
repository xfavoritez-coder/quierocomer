import { NextResponse } from "next/server";

/**
 * Badge snapshot cron — Toteat integration removed.
 * BadgeSnapshot model no longer exists; this cron is a no-op.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ ok: true, capturedAt: new Date().toISOString(), skipped: true });
}

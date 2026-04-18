import { NextResponse } from "next/server";

/** @deprecated Use /api/qr/sessions/heartbeat with isFinal=true instead */
export async function POST() {
  return NextResponse.json({ ok: true, deprecated: true });
}

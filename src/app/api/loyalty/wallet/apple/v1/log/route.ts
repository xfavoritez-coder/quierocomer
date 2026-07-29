import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// POST → Apple envía logs de diagnóstico del web service.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.logs) console.log("[Apple Wallet log]", JSON.stringify(body.logs).slice(0, 500));
  } catch {
    /* noop */
  }
  return new NextResponse(null, { status: 200 });
}

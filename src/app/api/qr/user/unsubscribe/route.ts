import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  try {
    await prisma.qRUser.update({
      where: { id: userId },
      data: { unsubscribedAt: new Date() },
    });

    // Show a simple confirmation page
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Desuscrito</title></head>
    <body style="font-family:system-ui;background:#0a0a0a;color:white;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
    <div style="text-align:center;padding:32px"><p style="font-size:2rem;margin-bottom:12px">✅</p><h1 style="font-size:1.3rem;font-weight:400;margin-bottom:8px">Te has desuscrito</h1><p style="color:#888;font-size:0.9rem">No recibirás más emails de QuieroComer.</p></div></body></html>`;
    return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
  } catch {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const status = req.nextUrl.searchParams.get("status") || "failed";
  const dismissed = req.nextUrl.searchParams.get("dismissed") === "1";

  const logs = await prisma.emailLog.findMany({
    where: {
      status,
      ...(dismissed ? {} : { dismissed: false }),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ logs });
}

export async function PUT(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { ids, action } = await req.json();

  if (action === "dismiss" && Array.isArray(ids)) {
    await prisma.emailLog.updateMany({
      where: { id: { in: ids } },
      data: { dismissed: true },
    });
    return NextResponse.json({ success: true });
  }

  if (action === "dismiss_all") {
    await prisma.emailLog.updateMany({
      where: { status: "failed", dismissed: false },
      data: { dismissed: true },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

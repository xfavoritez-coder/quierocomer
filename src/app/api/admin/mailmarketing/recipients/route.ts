import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const purpose = req.nextUrl.searchParams.get("purpose");
  if (!purpose) return NextResponse.json({ error: "Missing purpose" }, { status: 400 });

  const rows = await prisma.emailLog.findMany({
    where: { purpose },
    select: { id: true, to: true, openedAt: true, clickedAt: true, createdAt: true },
    orderBy: [{ openedAt: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ recipients: rows });
}

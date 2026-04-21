import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth, isSuperAdmin } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;
  if (!isSuperAdmin(req)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h

    const [counts, lastFailure] = await Promise.all([
      prisma.emailLog.groupBy({
        by: ["status"],
        where: { createdAt: { gte: since } },
        _count: { id: true },
      }),
      prisma.emailLog.findFirst({
        where: { status: "failed" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, errorMsg: true, to: true, purpose: true },
      }),
    ]);

    const sent = counts.find((c) => c.status === "sent")?._count.id || 0;
    const failed = counts.find((c) => c.status === "failed")?._count.id || 0;

    return NextResponse.json({
      provider: "resend",
      configured: !!(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "re_placeholder"),
      lastFailure: lastFailure
        ? {
            at: lastFailure.createdAt,
            error: lastFailure.errorMsg,
            to: lastFailure.to,
            purpose: lastFailure.purpose,
          }
        : null,
      failuresLast24h: failed,
      successesLast24h: sent,
    });
  } catch (error) {
    console.error("Email health error:", error);
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

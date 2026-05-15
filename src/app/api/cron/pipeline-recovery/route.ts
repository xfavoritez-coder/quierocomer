import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

  // Find all leads stuck in PROCESSING for more than 10 minutes
  const stuckLeads = await prisma.lead.findMany({
    where: {
      cartaStatus: "PROCESSING",
      updatedAt: { lt: tenMinutesAgo },
    },
    select: { id: true, updatedAt: true, localName: true },
  });

  if (stuckLeads.length === 0) {
    return NextResponse.json({ recovered: 0, message: "No stuck leads found" });
  }

  const results: { id: string; stuckMinutes: number; action: string }[] = [];

  for (const lead of stuckLeads) {
    const stuckMs = now.getTime() - lead.updatedAt.getTime();
    const stuckMinutes = Math.round(stuckMs / 60000);

    if (lead.updatedAt < thirtyMinutesAgo) {
      // Stuck for > 30 minutes → reset to PENDING (can be manually retried)
      await prisma.lead.update({
        where: { id: lead.id },
        data: { cartaStatus: "PENDING" },
      });
      console.log(`[Pipeline Recovery] Lead ${lead.id} (${lead.localName}) stuck ${stuckMinutes}m → PENDING (abandoned)`);
      results.push({ id: lead.id, stuckMinutes, action: "PENDING_ABANDONED" });
    } else {
      // Stuck for 10–30 minutes → reset to PENDING for retry
      await prisma.lead.update({
        where: { id: lead.id },
        data: { cartaStatus: "PENDING" },
      });
      console.log(`[Pipeline Recovery] Lead ${lead.id} (${lead.localName}) stuck ${stuckMinutes}m → PENDING`);
      results.push({ id: lead.id, stuckMinutes, action: "PENDING" });
    }
  }

  return NextResponse.json({
    recovered: results.length,
    results,
  });
}

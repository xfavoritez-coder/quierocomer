import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { getVisitorMetrics, getFunnelConversion, getFailedSearches, getGenioImpact, getAverageTicketByWeek } from "@/lib/admin/analyticsQueries";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  const type = req.nextUrl.searchParams.get("type") || "metrics";
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || null;
  const fromStr = req.nextUrl.searchParams.get("from");
  const toStr = req.nextUrl.searchParams.get("to");

  const to = toStr ? new Date(toStr) : new Date();
  const from = fromStr ? new Date(fromStr) : new Date(to.getTime() - 28 * 24 * 60 * 60 * 1000); // 4 weeks default

  try {
    if (type === "metrics") {
      const data = await getVisitorMetrics(restaurantId, from, to);
      return NextResponse.json(data);
    }
    if (type === "funnel") {
      const data = await getFunnelConversion(restaurantId, from, to);
      return NextResponse.json(data);
    }
    if (type === "searches") {
      const data = await getFailedSearches(restaurantId, from, to);
      return NextResponse.json(data);
    }
    if (type === "genio") {
      const data = await getGenioImpact(restaurantId, from, to);
      return NextResponse.json(data);
    }
    if (type === "ticket-trend" && restaurantId) {
      const weeks = parseInt(req.nextUrl.searchParams.get("weeks") || "12");
      const data = await getAverageTicketByWeek(restaurantId, weeks);
      return NextResponse.json(data);
    }
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("[Analytics]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

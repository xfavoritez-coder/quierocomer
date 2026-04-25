import { NextRequest, NextResponse } from "next/server";
import {
  checkAdminAuth,
  requireRestaurantForOwner,
  authErrorResponse,
} from "@/lib/adminAuth";
import { getVisitorMetrics, getFunnelConversion, getFailedSearches, getGenioImpact, getAverageTicketByWeek, getPersonalizationMetrics, getTopAttentionDishes } from "@/lib/admin/analyticsQueries";

export async function GET(req: NextRequest) {
  const authErr = checkAdminAuth(req);
  if (authErr) return authErr;

  try {
    const type = req.nextUrl.searchParams.get("type") || "metrics";
    const restaurantIdParam = req.nextUrl.searchParams.get("restaurantId") || null;
    const fromStr = req.nextUrl.searchParams.get("from");
    const toStr = req.nextUrl.searchParams.get("to");

    // OWNER must provide restaurantId; SUPERADMIN can pass null for global
    const restaurantId = await requireRestaurantForOwner(req, restaurantIdParam);

    const to = toStr ? new Date(toStr) : new Date();
    const from = fromStr ? new Date(fromStr) : new Date(to.getTime() - 28 * 24 * 60 * 60 * 1000);

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
    if (type === "personalization") {
      const data = await getPersonalizationMetrics(restaurantId, from, to);
      return NextResponse.json(data);
    }
    if (type === "attention") {
      const data = await getTopAttentionDishes(restaurantId, from, to);
      return NextResponse.json(data);
    }
    if (type === "ticket-trend" && restaurantId) {
      const weeks = parseInt(req.nextUrl.searchParams.get("weeks") || "12");
      const data = await getAverageTicketByWeek(restaurantId, weeks);
      return NextResponse.json(data);
    }
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (e: any) {
    if (e.status === 400 || e.status === 403) return authErrorResponse(e);
    console.error("[Analytics]", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
